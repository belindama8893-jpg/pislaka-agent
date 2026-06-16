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

export function inferAgentWorkflowState(messages: ChatWorkflowMessageRef[]): AgentWorkflowStateInput | undefined {
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && !message.isProgress && message.content.trim());

  if (!latestAssistantMessage) {
    return undefined;
  }

  if (latestAssistantMessage.entitySelection) {
    return {
      stage: "needs_selection",
      awaiting: "selection",
      pending_slots: ["target_entity"],
      source_message: latestAssistantMessage.sourceMessage,
      summary: "Waiting for the broker to choose the correct entity before continuing."
    };
  }

  for (const [field, intent, summary] of awaitingConfirmationFields) {
    if (latestAssistantMessage[field]) {
      return {
        stage: "awaiting_confirmation",
        active_intent: intent,
        awaiting: "confirmation",
        pending_slots: [],
        source_message: latestAssistantMessage.sourceMessage,
        summary: `Waiting for broker confirmation: ${summary}.`
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
      source_message: latestAssistantMessage.sourceMessage,
      summary: "Waiting for one more detail from the broker."
    };
  }

  return undefined;
}
