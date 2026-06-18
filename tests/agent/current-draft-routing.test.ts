import { describe, expect, it } from "vitest";
import { routeAgentMessage } from "../../lib/agent/deepseek";
import { compileAgentMemoryContext } from "../../lib/agent/memory";

describe("current listing draft routing context", () => {
  it("routes ordinary WhatsApp promotion wording to social copy, not campaign links", async () => {
    const action = await routeAgentMessage("Promote this listing on WhatsApp");

    expect(action.intent).toBe("generate_social_copy");
    expect(action.requires_confirmation).toBe(false);
  });

  it("keeps explicit tracking-link requests on campaign links", async () => {
    const action = await routeAgentMessage("Create campaign links for this listing on WhatsApp");

    expect(action.intent).toBe("create_campaign_links");
    expect(action.requires_confirmation).toBe(true);
  });

  it("does not mistake lead pages for manual lead creation", async () => {
    const action = await routeAgentMessage(
      "I want to promote a 10 marla house in DHA Phase 5 Lahore. It has 4 bedrooms, 5 bathrooms, demand is 4.35 crore, near park, renovated kitchen, ready possession, suitable for a family buyer. Create WhatsApp and Facebook promotion copy, tracking links, and a lead page."
    );

    expect(action.intent).toBe("create_listing_draft");
  });

  it("extracts absolute reminder dates into reminder_at", async () => {
    const action = await routeAgentMessage("Remind me on June 22, 2026 at 10 AM to reply to Omar.", {
      timeZone: "Asia/Karachi"
    });

    expect(action.intent).toBe("create_schedule_event");
    expect(action.payload).toMatchObject({
      event_category: "reminder",
      event_type: "follow_up",
      reminder_at: expect.any(String)
    });
    expect(action.payload.start_at).toBeUndefined();
  });

  it("keeps follow-up reminder times when normalizing from start_at", async () => {
    const action = await routeAgentMessage("Remind me next Monday at 10 AM to reply to Omar.", {
      timeZone: "Asia/Karachi"
    });

    expect(action.intent).toBe("create_schedule_event");
    expect(action.payload).toMatchObject({
      event_category: "reminder",
      event_type: "follow_up",
      reminder_at: expect.any(String)
    });
  });

  it("uses the current draft workflow summary for social copy follow-ups", async () => {
    const memory = compileAgentMemoryContext({
      workflowState: {
        stage: "awaiting_confirmation",
        active_intent: "create_listing_draft",
        awaiting: "confirmation",
        pending_slots: [],
        related_entities: [
          {
            type: "listing",
            label: "1 kanal House in DHA Phase 6"
          }
        ],
        summary:
          "Current listing draft: 1 kanal House in DHA Phase 6. Location: DHA Phase 6, Lahore. Property details: 1 kanal | house | sale | PKR 85,000,000."
      }
    });

    const action = await routeAgentMessage("Write WhatsApp copy for this listing", { memory });
    const promotion = action.payload.promotion as { cards?: Array<{ body?: string }> } | undefined;
    const body = promotion?.cards?.[0]?.body ?? "";

    expect(action.intent).toBe("generate_social_copy");
    expect(body).toContain("DHA Phase 6");
    expect(body).toContain("1 kanal");
  });
});
