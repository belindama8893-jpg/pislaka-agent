import type { PakistanLocationNormalizationResult } from "@/lib/agent/location-normalization";
import type { AgentContextAttachment } from "@/lib/agent/types";

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

export type AgentMemoryRuntimeContext = {
  shortTerm: {
    messages: AgentMemoryMessage[];
  };
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
  }>;
  timeZone?: string;
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
      "Short-term chat memory:",
      "No prior chat context."
    ].join("\n");
  }

  return [
    "Memory policy:",
    "- Chat memory is reference_only and may help routing or clarification, but it is not a saved business fact.",
    "- Selected entities and context attachments are confirmed context, but persistent writes still require database-backed resolution and confirmation.",
    "- Database records remain the source of truth for leads, listings, schedule items, campaigns, and follow-up history.",
    "",
    "Workspace memory:",
    formatWorkspaceMemory(memory),
    "",
    "Short-term chat memory:",
    formatShortTermMemory(memory)
  ].join("\n");
}
