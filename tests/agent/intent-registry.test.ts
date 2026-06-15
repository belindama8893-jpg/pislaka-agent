import { describe, expect, it } from "vitest";
import { agentIntentRegistry } from "../../lib/agent/registry/intents";
import type { AgentAction } from "../../lib/agent/types";

const expectedIntents = [
  "create_listing_draft",
  "create_lead",
  "update_listing_draft",
  "publish_listing",
  "generate_social_copy",
  "create_campaign_links",
  "list_today_followups",
  "record_lead_followup",
  "create_followup_from_chat",
  "list_leads",
  "draft_lead_reply",
  "create_schedule_event",
  "list_schedule_events",
  "update_lead_status",
  "update_lead_details",
  "update_lead_listing",
  "show_basic_attribution",
  "general_reply"
] satisfies AgentAction["intent"][];

describe("agentIntentRegistry", () => {
  it("defines every supported action intent", () => {
    expect(Object.keys(agentIntentRegistry).sort()).toEqual([...expectedIntents].sort());
  });

  it("keeps follow-up records on conditional confirmation", () => {
    expect(agentIntentRegistry.record_lead_followup).toMatchObject({
      requiredEntities: ["lead"],
      confirmation: "conditional",
      audit: "trace_confirm_and_write"
    });
  });
});
