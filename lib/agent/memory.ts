import type { PakistanLocationNormalizationResult } from "@/lib/agent/location-normalization";
import type { AgentAction, AgentContextAttachment, AgentWorkflowStateInput } from "@/lib/agent/types";

export type AgentMemorySource =
  | "chat"
  | "database"
  | "explicit_selection"
  | "context_attachment"
  | "location_normalization"
  | "runtime";

export type AgentMemoryTrustLevel = "reference_only" | "confirmed" | "source_of_truth";

export type AgentMemoryAllowedUse = "routing" | "guidance" | "prompt" | "entity_resolution";

export type AgentMemoryExpiry = "turn" | "session" | "conversation" | "permanent";

export type AgentMemoryMetadata = {
  source: AgentMemorySource;
  trustLevel: AgentMemoryTrustLevel;
  allowedUse: AgentMemoryAllowedUse[];
  expires: AgentMemoryExpiry;
};

export type AgentMemoryMessage = AgentMemoryMetadata & {
  role: "user" | "assistant";
  content: string;
};

export type AgentMemorySelectedEntity = AgentMemoryMetadata & {
  entityId: string;
  type: AgentContextAttachment["type"];
};

export type AgentMemoryContextAttachment = AgentMemoryMetadata & AgentContextAttachment;

export type AgentWorkflowStage = AgentWorkflowStateInput["stage"];

export type AgentMemoryWorkflowState = AgentMemoryMetadata & {
  activeIntent?: AgentAction["intent"];
  awaiting?: AgentWorkflowStateInput["awaiting"];
  pendingSlots: string[];
  relatedEntities: NonNullable<AgentWorkflowStateInput["related_entities"]>;
  sourceMessage?: string;
  stage: AgentWorkflowStage;
  summary?: string;
};

export type AgentMemoryRuntimeContext = {
  shortTerm: {
    messages: AgentMemoryMessage[];
  };
  workflow?: AgentMemoryWorkflowState;
  workspace: {
    currentLead?: AgentMemorySelectedEntity;
    currentListing?: AgentMemorySelectedEntity;
    attachments: AgentMemoryContextAttachment[];
  };
  runtime: {
    timeZone?: string;
    locationContext?: PakistanLocationNormalizationResult;
  };
};

export type CompileAgentMemoryContextInput = {
  contextAttachments?: AgentContextAttachment[];
  currentLeadId?: string;
  currentListingId?: string;
  locationContext?: PakistanLocationNormalizationResult;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
    structured_payload?: Record<string, unknown>;
    structuredPayload?: Record<string, unknown> | null;
  }>;
  timeZone?: string;
  workflowState?: AgentWorkflowStateInput;
};

const shortTermMessageMemory: AgentMemoryMetadata = {
  source: "chat",
  trustLevel: "reference_only",
  allowedUse: ["routing", "guidance", "prompt"],
  expires: "conversation"
};

const selectedEntityMemory: AgentMemoryMetadata = {
  source: "explicit_selection",
  trustLevel: "confirmed",
  allowedUse: ["routing", "guidance", "prompt", "entity_resolution"],
  expires: "turn"
};

const attachmentMemory: AgentMemoryMetadata = {
  source: "context_attachment",
  trustLevel: "confirmed",
  allowedUse: ["routing", "guidance", "prompt", "entity_resolution"],
  expires: "turn"
};

const workflowMemory: AgentMemoryMetadata = {
  source: "runtime",
  trustLevel: "confirmed",
  allowedUse: ["routing", "guidance", "prompt"],
  expires: "conversation"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getPayloadUi(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.ui)) {
    return null;
  }

  return payload.ui;
}

function workflowStateFromInput(state: AgentWorkflowStateInput): AgentMemoryWorkflowState {
  return {
    ...workflowMemory,
    activeIntent: state.active_intent,
    awaiting: state.awaiting,
    pendingSlots: state.pending_slots ?? [],
    relatedEntities: state.related_entities ?? [],
    sourceMessage: state.source_message,
    stage: state.stage,
    summary: state.summary
  };
}

function workflowStateFromUiPayload(
  ui: Record<string, unknown>,
  content: string,
  relatedEntities: AgentMemoryWorkflowState["relatedEntities"]
): AgentMemoryWorkflowState | null {
  if (ui.entitySelection) {
    return {
      ...workflowMemory,
      awaiting: "selection",
      pendingSlots: ["target_entity"],
      relatedEntities,
      sourceMessage: typeof ui.sourceMessage === "string" ? ui.sourceMessage : undefined,
      stage: "needs_selection",
      summary: "Waiting for the broker to choose the correct entity before continuing."
    };
  }

  const awaitingConfirmationMap: Array<[keyof typeof ui, AgentAction["intent"], string]> = [
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

  for (const [key, intent, summary] of awaitingConfirmationMap) {
    if (ui[key]) {
      return {
        ...workflowMemory,
        activeIntent: intent,
        awaiting: "confirmation",
        pendingSlots: [],
        relatedEntities,
        sourceMessage: typeof ui.sourceMessage === "string" ? ui.sourceMessage : undefined,
        stage: "awaiting_confirmation",
        summary: `Waiting for broker confirmation: ${summary}.`
      };
    }
  }

  const completedMap: Array<[keyof typeof ui, AgentAction["intent"], string]> = [
    ["listingSaved", "create_listing_draft", "Listing was saved."],
    ["promotion", "create_campaign_links", "Promotion output was generated."],
    ["leadResults", "list_leads", "Lead results were shown."],
    ["leadReply", "draft_lead_reply", "Lead reply draft was prepared."],
    ["scheduleEvents", "list_schedule_events", "Schedule results were shown."],
    ["analyticsSummary", "show_basic_attribution", "Attribution summary was shown."]
  ];

  for (const [key, intent, summary] of completedMap) {
    if (ui[key]) {
      return {
        ...workflowMemory,
        activeIntent: intent,
        awaiting: "none",
        pendingSlots: [],
        relatedEntities,
        sourceMessage: typeof ui.sourceMessage === "string" ? ui.sourceMessage : undefined,
        stage: "completed",
        summary
      };
    }
  }

  if (content.trim().endsWith("?")) {
    return {
      ...workflowMemory,
      awaiting: "details",
      pendingSlots: ["next_detail"],
      relatedEntities,
      stage: "collecting_info",
      summary: "Waiting for one more detail from the broker."
    };
  }

  return null;
}

function inferWorkflowState(input: CompileAgentMemoryContextInput): AgentMemoryWorkflowState | undefined {
  const relatedEntities = getWorkspaceRelatedEntities(input);

  if (input.workflowState) {
    const explicitState = workflowStateFromInput(input.workflowState);
    return explicitState.relatedEntities.length
      ? explicitState
      : {
          ...explicitState,
          relatedEntities
        };
  }

  const messages = [...(input.recentMessages ?? [])].reverse();
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const ui = getPayloadUi(message.structured_payload ?? message.structuredPayload);
    const workflow = ui
      ? workflowStateFromUiPayload(ui, message.content, relatedEntities)
      : workflowStateFromUiPayload({}, message.content, relatedEntities);
    if (workflow) {
      return workflow;
    }
  }

  return undefined;
}

function getWorkspaceRelatedEntities(input: CompileAgentMemoryContextInput): AgentMemoryWorkflowState["relatedEntities"] {
  const entities: AgentMemoryWorkflowState["relatedEntities"] = [];

  if (input.currentLeadId) {
    entities.push({ type: "lead", entity_id: input.currentLeadId });
  }

  if (input.currentListingId) {
    entities.push({ type: "listing", entity_id: input.currentListingId });
  }

  for (const attachment of input.contextAttachments ?? []) {
    if (entities.some((entity) => entity.type === attachment.type && entity.entity_id === attachment.entity_id)) {
      continue;
    }

    entities.push({
      type: attachment.type,
      entity_id: attachment.entity_id,
      label: attachment.label
    });
  }

  return entities.slice(0, 10);
}

export function compileAgentMemoryContext(input: CompileAgentMemoryContextInput): AgentMemoryRuntimeContext {
  return {
    shortTerm: {
      messages: (input.recentMessages ?? [])
        .filter((message) => message.content.trim())
        .slice(-20)
        .map((message) => ({
          ...shortTermMessageMemory,
          role: message.role,
          content: message.content
        }))
    },
    workflow: inferWorkflowState(input),
    workspace: {
      currentLead: input.currentLeadId
        ? {
            ...selectedEntityMemory,
            entityId: input.currentLeadId,
            type: "lead"
          }
        : undefined,
      currentListing: input.currentListingId
        ? {
            ...selectedEntityMemory,
            entityId: input.currentListingId,
            type: "listing"
          }
        : undefined,
      attachments: (input.contextAttachments ?? []).map((attachment) => ({
        ...attachment,
        ...attachmentMemory
      }))
    },
    runtime: {
      timeZone: input.timeZone,
      locationContext: input.locationContext
    }
  };
}

export function getAgentMemoryRecentMessages(memory?: AgentMemoryRuntimeContext) {
  return (
    memory?.shortTerm.messages.map((message) => ({
      role: message.role,
      content: message.content
    })) ?? []
  );
}

function formatWorkspaceMemory(memory: AgentMemoryRuntimeContext) {
  const parts: string[] = [];

  if (memory.workspace.currentLead) {
    parts.push(
      `Current lead selected: ${memory.workspace.currentLead.entityId} (${memory.workspace.currentLead.trustLevel}, ${memory.workspace.currentLead.expires}).`
    );
  }

  if (memory.workspace.currentListing) {
    parts.push(
      `Current listing selected: ${memory.workspace.currentListing.entityId} (${memory.workspace.currentListing.trustLevel}, ${memory.workspace.currentListing.expires}).`
    );
  }

  for (const attachment of memory.workspace.attachments.slice(-5)) {
    const summary = attachment.summary ? ` - ${attachment.summary}` : "";
    parts.push(
      `Attached ${attachment.type}: ${attachment.label ?? attachment.entity_id}${summary} (${attachment.trustLevel}, ${attachment.expires}).`
    );
  }

  return parts.length ? parts.join("\n") : "No selected lead/listing context.";
}

function formatShortTermMemory(memory: AgentMemoryRuntimeContext) {
  if (!memory.shortTerm.messages.length) {
    return "No prior chat context.";
  }

  return memory.shortTerm.messages
    .map((message) => `${message.role === "user" ? "Broker" : "Assistant"}: ${message.content.slice(0, 500)}`)
    .join("\n");
}

function formatWorkflowMemory(memory: AgentMemoryRuntimeContext) {
  if (!memory.workflow) {
    return "No active workflow state.";
  }

  const parts = [
    `Stage: ${memory.workflow.stage}`,
    memory.workflow.activeIntent ? `Active intent: ${memory.workflow.activeIntent}` : null,
    memory.workflow.awaiting ? `Awaiting: ${memory.workflow.awaiting}` : null,
    memory.workflow.pendingSlots.length ? `Pending slots: ${memory.workflow.pendingSlots.join(", ")}` : null,
    memory.workflow.relatedEntities.length
      ? `Related entities: ${memory.workflow.relatedEntities
          .map((entity) => [entity.type, entity.label ?? entity.entity_id].filter(Boolean).join(":"))
          .join(", ")}`
      : null,
    memory.workflow.summary ? `Summary: ${memory.workflow.summary}` : null
  ].filter(Boolean);

  return parts.join("\n");
}

export function formatAgentMemoryForPrompt(memory?: AgentMemoryRuntimeContext) {
  if (!memory) {
    return [
      "Memory policy:",
      "- No compiled memory context was provided.",
      "- Do not infer saved business facts from chat text.",
      "",
      "Workspace memory:",
      "No selected lead/listing context.",
      "",
      "Workflow memory:",
      "No active workflow state.",
      "",
      "Short-term chat memory:",
      "No prior chat context."
    ].join("\n");
  }

  return [
    "Memory policy:",
    "- Chat memory is reference_only and may help routing or clarification, but it is not a saved business fact.",
    "- Workflow memory may help continue multi-turn tasks, choose the next question, or interpret short follow-ups such as confirm/send/continue.",
    "- Selected entities and context attachments are confirmed context, but persistent writes still require database-backed resolution and confirmation.",
    "- Database records remain the source of truth for leads, listings, schedule items, campaigns, and follow-up history.",
    "",
    "Workspace memory:",
    formatWorkspaceMemory(memory),
    "",
    "Workflow memory:",
    formatWorkflowMemory(memory),
    "",
    "Short-term chat memory:",
    formatShortTermMemory(memory)
  ].join("\n");
}
