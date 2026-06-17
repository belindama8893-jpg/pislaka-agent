import type { AgentAction, LeadOperationPayload } from "@/lib/agent/types";
import { getAgentIntentDefinition } from "@/lib/agent/registry/intents";

function isLeadOperationPayload(payload: AgentAction["payload"]): payload is LeadOperationPayload {
  return Boolean(payload && typeof payload === "object");
}

export function getAgentActionPolicy(action: Pick<AgentAction, "intent" | "payload">) {
  const intentDefinition = getAgentIntentDefinition(action.intent);
  const requiresConfirmation = (() => {
    if (intentDefinition.confirmation === "never") {
      return false;
    }

    if (intentDefinition.confirmation === "always") {
      return true;
    }

    if (action.intent === "record_lead_followup") {
      if (isLeadOperationPayload(action.payload) && action.payload.activity_type === "message_sent") {
        return false;
      }

      return true;
    }

    return true;
  })();

  return {
    audit: intentDefinition.audit,
    confirmation: intentDefinition.confirmation,
    requiresAuthForWrite: intentDefinition.availability.requiresAuthForWrite,
    requiresConfirmation,
    risk: intentDefinition.policy.risk,
    uiCard: intentDefinition.uiCard
  };
}

export function requiresConfirmationForAgentAction(action: Pick<AgentAction, "intent" | "payload">) {
  return getAgentActionPolicy(action).requiresConfirmation;
}

export function applyAgentActionPolicy<Action extends Pick<AgentAction, "intent" | "payload">>(
  action: Action
): Action & Pick<AgentAction, "requires_confirmation"> {
  return {
    ...action,
    requires_confirmation: requiresConfirmationForAgentAction(action)
  };
}
