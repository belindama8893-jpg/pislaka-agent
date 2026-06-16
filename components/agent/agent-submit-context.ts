import { summarizeAgentFileAttachments } from "@/components/agent/agent-composer-files";
import type { AgentAction, AgentWorkflowStateInput } from "@/lib/agent/types";

type ChatContextAttachmentRef = {
  entity_id: string;
  type: "listing" | "lead";
};

type ChatMessageRef = {
  content: string;
  role: "user" | "assistant";
};

type ChatWorkflowMessageRef = ChatMessageRef &
  Partial<Record<string, unknown>> & {
    isProgress?: boolean;
    sourceMessage?: string;
  };

type WorkflowRelatedEntity = NonNullable<AgentWorkflowStateInput["related_entities"]>[number];

type BuildAgentTurnContentOptions<FileAttachment> = {
  fileAttachments: FileAttachment[];
  mediaCount: number;
  message: string;
};

export function getSelectedAgentContextEntityId(
  contextAttachments: ChatContextAttachmentRef[],
  type: ChatContextAttachmentRef["type"]
) {
  return [...contextAttachments].reverse().find((item) => item.type === type)?.entity_id;
}

export function createRecentAgentContextMessages(messages: ChatMessageRef[], limit = 20): ChatMessageRef[] {
  return messages
    .filter((message) => message.content.trim())
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

export function buildAgentTurnContent<FileAttachment extends { file: { name: string } }>({
  fileAttachments,
  mediaCount,
  message
}: BuildAgentTurnContentOptions<FileAttachment>) {
  const mediaSummary = mediaCount
    ? `Attached ${mediaCount} listing media file${mediaCount === 1 ? "" : "s"}.`
    : "";
  const fileSummary = summarizeAgentFileAttachments(fileAttachments);
  const userMessageContent = message || mediaSummary;
  const visibleUserMessageContent = [userMessageContent, fileSummary].filter(Boolean).join("\n\n");
  const agentMessageContent = [message, mediaSummary, fileSummary].filter(Boolean).join("\n\n");

  return {
    agentMessageContent,
    fileSummary,
    mediaSummary,
    userMessageContent,
    visibleUserMessageContent
  };
}

const awaitingConfirmationFields: Array<[string, AgentAction["intent"], string]> = [
  ["draft", "create_listing_draft", "listing draft confirmation"],
  ["scheduleEvent", "create_schedule_event", "schedule confirmation"],
  ["leadCreate", "create_lead", "lead creation confirmation"],
  ["leadDetailsUpdate", "update_lead_details", "lead details confirmation"],
  ["leadListingUpdate", "update_lead_listing", "lead listing confirmation"],
  ["leadStatusUpdate", "update_lead_status", "lead status confirmation"],
  ["leadBatchStatusUpdate", "update_lead_status", "lead status confirmation"],
  ["listingUpdate", "update_listing_draft", "listing update confirmation"],
  ["promotionTarget", "create_campaign_links", "promotion confirmation"]
];

const completedFields: Array<[string, AgentAction["intent"], string]> = [
  ["listingSaved", "create_listing_draft", "Listing was saved."],
  ["promotion", "create_campaign_links", "Promotion output was generated."],
  ["leadResults", "list_leads", "Lead results were shown."],
  ["leadReply", "draft_lead_reply", "Lead reply draft was prepared."],
  ["scheduleEvents", "list_schedule_events", "Schedule results were shown."],
  ["analyticsSummary", "show_basic_attribution", "Attribution summary was shown."]
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function relatedEntityFromValue(type: WorkflowRelatedEntity["type"], value: unknown): WorkflowRelatedEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id : undefined;
  const label =
    typeof value.full_name === "string"
      ? value.full_name
      : typeof value.title === "string"
        ? value.title
        : typeof value.label === "string"
          ? value.label
          : undefined;

  if (!id && !label) {
    return null;
  }

  return {
    type,
    entity_id: id,
    label
  };
}

function formatDraftWorkflowSummary(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const title = typeof value.title === "string" ? value.title : undefined;
  const location = [value.location_area, value.city].filter((item): item is string => typeof item === "string" && item.trim().length > 0).join(", ");
  const area =
    typeof value.area_value === "number" && typeof value.area_unit === "string"
      ? `${value.area_value} ${value.area_unit}`
      : undefined;
  const propertyType = typeof value.property_type === "string" ? value.property_type : undefined;
  const listingType = typeof value.listing_type === "string" ? value.listing_type : undefined;
  const price =
    typeof value.price_amount === "number"
      ? `PKR ${value.price_amount.toLocaleString("en-US")}`
      : undefined;
  const bedrooms = typeof value.bedrooms === "number" ? `${value.bedrooms} bedrooms` : undefined;
  const bathrooms = typeof value.bathrooms === "number" ? `${value.bathrooms} bathrooms` : undefined;
  const propertyDetails = [area, propertyType, listingType, price, bedrooms, bathrooms].filter(Boolean).join(" | ");

  return [
    title ? `Current listing draft: ${title}.` : "Current listing draft is awaiting confirmation.",
    location ? `Location: ${location}.` : null,
    propertyDetails ? `Property details: ${propertyDetails}.` : null
  ]
    .filter(Boolean)
    .join(" ");
}

function getWorkflowRelatedEntities(message: ChatWorkflowMessageRef): WorkflowRelatedEntity[] {
  const entities: WorkflowRelatedEntity[] = [];
  const push = (entity: WorkflowRelatedEntity | null) => {
    if (!entity) {
      return;
    }

    if (entities.some((item) => item.type === entity.type && item.entity_id === entity.entity_id && item.label === entity.label)) {
      return;
    }

    entities.push(entity);
  };

  const leadDetailsUpdate = isRecord(message.leadDetailsUpdate) ? message.leadDetailsUpdate : null;
  push(relatedEntityFromValue("lead", leadDetailsUpdate?.lead));

  const leadListingUpdate = isRecord(message.leadListingUpdate) ? message.leadListingUpdate : null;
  push(relatedEntityFromValue("lead", leadListingUpdate?.lead));
  push(relatedEntityFromValue("listing", leadListingUpdate?.listing));

  const leadStatusUpdate = isRecord(message.leadStatusUpdate) ? message.leadStatusUpdate : null;
  push(relatedEntityFromValue("lead", leadStatusUpdate?.lead));

  const listingUpdate = isRecord(message.listingUpdate) ? message.listingUpdate : null;
  push(relatedEntityFromValue("listing", listingUpdate?.listing));

  push(relatedEntityFromValue("listing", message.draft));
  push(relatedEntityFromValue("listing", message.promotionTarget));

  return entities;
}

export function inferAgentWorkflowState(messages: ChatWorkflowMessageRef[]): AgentWorkflowStateInput | undefined {
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && !message.isProgress && message.content.trim());

  if (!latestAssistantMessage) {
    return undefined;
  }

  const relatedEntities = getWorkflowRelatedEntities(latestAssistantMessage);

  if (latestAssistantMessage.entitySelection) {
    return {
      stage: "needs_selection",
      awaiting: "selection",
      pending_slots: ["target_entity"],
      related_entities: relatedEntities,
      source_message: latestAssistantMessage.sourceMessage,
      summary: "Waiting for the broker to choose the correct entity before continuing."
    };
  }

  for (const [field, intent, summary] of awaitingConfirmationFields) {
    if (latestAssistantMessage[field]) {
      const draftSummary =
        field === "draft" ? formatDraftWorkflowSummary(latestAssistantMessage[field]) : null;
      return {
        stage: "awaiting_confirmation",
        active_intent: intent,
        awaiting: "confirmation",
        pending_slots: [],
        related_entities: relatedEntities,
        source_message: latestAssistantMessage.sourceMessage,
        summary: draftSummary ?? `Waiting for broker confirmation: ${summary}.`
      };
    }
  }

  for (const [field, intent, summary] of completedFields) {
    if (latestAssistantMessage[field]) {
      return {
        stage: "completed",
        active_intent: intent,
        awaiting: "none",
        pending_slots: [],
        related_entities: relatedEntities,
        source_message: latestAssistantMessage.sourceMessage,
        summary
      };
    }
  }

  if (latestAssistantMessage.content.trim().endsWith("?")) {
    return {
      stage: "collecting_info",
      awaiting: "details",
      pending_slots: ["next_detail"],
      related_entities: relatedEntities,
      source_message: latestAssistantMessage.sourceMessage,
      summary: "Waiting for one more detail from the broker."
    };
  }

  return undefined;
}
