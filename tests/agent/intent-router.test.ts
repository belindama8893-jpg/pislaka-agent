import { describe, expect, it } from "vitest";
import {
  classifyLocalIntent,
  extractLeadName,
  extractLeadStatus,
  extractLeadStatusFilter,
  type LocalIntentKind
} from "../../lib/agent/intent-router";

describe("classifyLocalIntent", () => {
  const cases: Array<{ message: string; intent: LocalIntentKind }> = [
    {
      message: "Reply to Ahmed on WhatsApp",
      intent: "lead_reply"
    },
    {
      message: "Promote this listing on WhatsApp",
      intent: "promotion"
    },
    {
      message: "Share this listing to Facebook",
      intent: "promotion"
    },
    {
      message: "Publish it to WhatsApp",
      intent: "promotion"
    },
    {
      message: "Who should I follow up today?",
      intent: "today_followups"
    },
    {
      message: "follow up",
      intent: "today_followups"
    },
    {
      message: "Show new leads from WhatsApp",
      intent: "lead_query"
    },
    {
      message: "Show hot leads",
      intent: "lead_query"
    },
    {
      message: "I sent message to Ahmed",
      intent: "lead_followup_record"
    },
    {
      message: "Mark Ahmed as hot lead",
      intent: "lead_status_update"
    },
    {
      message: "Update lead Sara phone to 0300 9998887",
      intent: "lead_details_update"
    },
    {
      message: "Attach Sara buyer to this DHA Phase 6 listing",
      intent: "lead_listing_update"
    },
    {
      message: "Schedule viewing with Ahmed tomorrow at 4pm",
      intent: "schedule_event"
    },
    {
      message: "What do I have tomorrow?",
      intent: "schedule_query"
    },
    {
      message: "Create listing for sale: 1 kanal house in DHA Phase 6 Lahore, demand 8.5 crore",
      intent: "listing_draft"
    },
    {
      message: "Change this listing price to 8.3 crore",
      intent: "listing_update"
    }
  ];

  it.each(cases)("$message -> $intent", ({ message, intent }) => {
    expect(classifyLocalIntent(message)).toBe(intent);
  });
});

describe("lead extraction helpers", () => {
  it("extracts lead names from reply requests without treating channels as intents", () => {
    expect(extractLeadName("Reply to Ahmed on WhatsApp")).toBe("Ahmed");
  });

  it("maps hot lead language to qualified with high urgency", () => {
    expect(extractLeadStatus("Ahmed is a hot lead now")).toEqual({
      status: "qualified",
      urgency: "high"
    });
  });

  it("maps hot lead list filters to qualified instead of a write intent", () => {
    expect(extractLeadStatusFilter("Show hot leads")).toBe("qualified");
  });
});
