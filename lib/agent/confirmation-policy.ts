import type { AgentAction, LeadOperationPayload } from "@/lib/agent/types";
import { getAgentIntentDefinition } from "@/lib/agent/registry/intents";

function isLeadOperationPayload(payload: AgentAction["payload"]): payload is LeadOperationPayload {
  return Boolean(payload && typeof payload === "object");
}

export function requiresConfirmationForAgentAction(action: Pick<AgentAction, "intent" | "payload">) {
  const intentDefinition = getAgentIntentDefinition(action.intent);

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
}
