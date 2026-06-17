import { describe, expect, it } from "vitest";
import { agentActionSchema } from "../../lib/agent/types";

describe("agent semantic action schema", () => {
  it("keeps existing action JSON compatible when routing metadata is absent", () => {
    const action = agentActionSchema.parse({
      intent: "create_campaign_links",
      requires_confirmation: true,
      response: "Please confirm before I generate promotion links.",
      payload: {
        query: "Promote this listing on WhatsApp"
      }
    });

    expect(action.intent).toBe("create_campaign_links");
    expect(action.confidence).toBeUndefined();
    expect(action.alternative_intents).toBeUndefined();
  });

  it("accepts bounded semantic routing metadata on the same action response", () => {
    const action = agentActionSchema.parse({
      intent: "create_campaign_links",
      requires_confirmation: true,
      response: "Please confirm before I generate promotion links.",
      payload: {
        channel: "whatsapp",
        query: "Promote this listing on WhatsApp"
      },
      confidence: 0.91,
      alternative_intents: [
        {
          intent: "generate_social_copy",
          confidence: 0.42,
          reason: "The broker mentioned WhatsApp, but asked to promote the listing rather than draft copy."
        }
      ],
      missing_slots: ["listing target"],
      is_follow_up_to_workflow: true,
      route_reason: "The broker referred to the active listing preview and requested WhatsApp promotion."
    });

    expect(action.confidence).toBe(0.91);
    expect(action.alternative_intents?.[0]?.intent).toBe("generate_social_copy");
    expect(action.missing_slots).toEqual(["listing target"]);
    expect(action.is_follow_up_to_workflow).toBe(true);
  });

  it("rejects invented alternative intents", () => {
    expect(() =>
      agentActionSchema.parse({
        intent: "create_campaign_links",
        requires_confirmation: true,
        response: "Please confirm before I generate promotion links.",
        payload: {},
        alternative_intents: [
          {
            intent: "send_whatsapp_message",
            confidence: 0.7
          }
        ]
      })
    ).toThrow();
  });

  it("rejects out-of-range routing confidence", () => {
    expect(() =>
      agentActionSchema.parse({
        intent: "draft_lead_reply",
        requires_confirmation: false,
        response: "I drafted a reply.",
        payload: {},
        confidence: 1.3
      })
    ).toThrow();
  });
});
