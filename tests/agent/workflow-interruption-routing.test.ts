import { describe, expect, it } from "vitest";
import { routeAgentMessage } from "../../lib/agent/deepseek";
import { compileAgentMemoryContext } from "../../lib/agent/memory";

describe("workflow interruption routing", () => {
  it("lets an explicit new lead update interrupt an awaiting confirmation workflow", async () => {
    const memory = compileAgentMemoryContext({
      workflowState: {
        stage: "awaiting_confirmation",
        active_intent: "create_campaign_links",
        awaiting: "confirmation",
        summary: "Waiting for broker confirmation: promotion confirmation."
      }
    });

    const action = await routeAgentMessage("Update lead Ahmed phone to 0300 9998887", {
      memory,
      recentMessages: [{ role: "assistant", content: "Confirm before I generate promotion links." }]
    });

    expect(action.intent).toBe("update_lead_details");
    expect(action.payload).toMatchObject({
      lead_name: "Ahmed",
      phone: "03009998887"
    });
    expect(action.requires_confirmation).toBe(true);
  });
});
