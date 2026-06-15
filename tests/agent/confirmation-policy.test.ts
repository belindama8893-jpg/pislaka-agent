import { describe, expect, it } from "vitest";
import { requiresConfirmationForAgentAction } from "../../lib/agent/confirmation-policy";
import type { AgentAction } from "../../lib/agent/types";

function action(intent: AgentAction["intent"], payload: AgentAction["payload"] = {}) {
  return { intent, payload };
}

describe("requiresConfirmationForAgentAction", () => {
  it.each([
    "list_leads",
    "list_today_followups",
    "list_schedule_events",
    "show_basic_attribution",
    "general_reply",
    "create_listing_draft",
    "draft_lead_reply",
    "generate_social_copy"
  ] satisfies AgentAction["intent"][])("%s does not require confirmation by default", (intent) => {
    expect(requiresConfirmationForAgentAction(action(intent))).toBe(false);
  });

  it.each([
    "create_lead",
    "update_listing_draft",
    "publish_listing",
    "create_campaign_links",
    "create_followup_from_chat",
    "create_schedule_event",
    "update_lead_status",
    "update_lead_details",
    "update_lead_listing"
  ] satisfies AgentAction["intent"][])("%s requires confirmation", (intent) => {
    expect(requiresConfirmationForAgentAction(action(intent))).toBe(true);
  });

  it("does not require another confirmation for message_sent follow-up records", () => {
    expect(
      requiresConfirmationForAgentAction(
        action("record_lead_followup", {
          activity_type: "message_sent"
        })
      )
    ).toBe(false);
  });

  it("requires confirmation for status-changing follow-up records", () => {
    expect(
      requiresConfirmationForAgentAction(
        action("record_lead_followup", {
          activity_type: "status_changed"
        })
      )
    ).toBe(true);
  });

  it("requires confirmation for follow-up records unless they are explicitly message_sent", () => {
    expect(requiresConfirmationForAgentAction(action("record_lead_followup"))).toBe(true);
  });
});
