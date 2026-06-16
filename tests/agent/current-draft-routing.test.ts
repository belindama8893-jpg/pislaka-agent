import { describe, expect, it } from "vitest";
import { routeAgentMessage } from "../../lib/agent/deepseek";
import { compileAgentMemoryContext } from "../../lib/agent/memory";

describe("current listing draft routing context", () => {
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
