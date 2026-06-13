import type { AgentAction, LeadOperationPayload } from "@/lib/agent/types";

const readOnlyIntents = new Set<AgentAction["intent"]>([
  "list_leads",
  "list_today_followups",
  "list_schedule_events",
  "show_basic_attribution",
  "general_reply"
]);

const draftOnlyIntents = new Set<AgentAction["intent"]>([
  "create_listing_draft",
  "draft_lead_reply"
]);

const alwaysConfirmIntents = new Set<AgentAction["intent"]>([
  "create_lead",
  "update_listing_draft",
  "publish_listing",
  "create_campaign_links",
  "create_followup_from_chat",
  "create_schedule_event",
  "update_lead_status",
  "update_lead_details",
  "update_lead_listing"
]);

function isLeadOperationPayload(payload: AgentAction["payload"]): payload is LeadOperationPayload {
  return Boolean(payload && typeof payload === "object");
}

export function requiresConfirmationForAgentAction(action: Pick<AgentAction, "intent" | "payload">) {
  if (readOnlyIntents.has(action.intent) || draftOnlyIntents.has(action.intent)) {
    return false;
  }

  if (action.intent === "record_lead_followup") {
    if (isLeadOperationPayload(action.payload) && action.payload.activity_type === "message_sent") {
      return false;
    }

    return true;
  }

  if (alwaysConfirmIntents.has(action.intent)) {
    return true;
  }

  return true;
}
