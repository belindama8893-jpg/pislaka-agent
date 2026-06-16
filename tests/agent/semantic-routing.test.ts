import { describe, expect, it } from "vitest";
import {
  applySemanticRouteConfidenceGate,
  getSemanticRouteClarificationReason
} from "../../lib/agent/semantic-routing";
import type { AgentAction } from "../../lib/agent/types";

function makeAction(overrides: Partial<AgentAction> = {}): AgentAction {
  return {
    intent: "create_campaign_links",
    requires_confirmation: true,
    response: "Please confirm before I generate promotion links.",
    payload: {
      query: "Promote this listing on WhatsApp"
    },
    ...overrides
  };
}

describe("semantic route confidence gate", () => {
  it("does not gate actions without semantic confidence metadata", () => {
    const action = makeAction();

    expect(getSemanticRouteClarificationReason(action)).toBeNull();
    expect(applySemanticRouteConfidenceGate(action)).toBe(action);
  });

  it("does not gate high-confidence semantic routes", () => {
    const action = makeAction({
      confidence: 0.91,
      alternative_intents: [
        {
          intent: "generate_social_copy",
          confidence: 0.3
        }
      ]
    });

    expect(getSemanticRouteClarificationReason(action)).toBeNull();
    expect(applySemanticRouteConfidenceGate(action)).toBe(action);
  });

  it("turns low-confidence routes into a clarification response", () => {
    const action = makeAction({
      confidence: 0.39,
      alternative_intents: [
        {
          intent: "draft_lead_reply",
          confidence: 0.35
        }
      ],
      route_reason: "WhatsApp is present, but the requested workflow is unclear."
    });
    const gatedAction = applySemanticRouteConfidenceGate(action);

    expect(gatedAction.intent).toBe("general_reply");
    expect(gatedAction.requires_confirmation).toBe(false);
    expect(gatedAction.response).toContain("choose the right workflow");
    expect(gatedAction.payload["semantic_route"]).toMatchObject({
      original_intent: "create_campaign_links",
      confidence: 0.39,
      clarification_reason: "low_confidence"
    });
  });

  it("asks for clarification when two semantic routes are too close", () => {
    const action = makeAction({
      confidence: 0.7,
      alternative_intents: [
        {
          intent: "generate_social_copy",
          confidence: 0.62
        }
      ]
    });
    const gatedAction = applySemanticRouteConfidenceGate(action);

    expect(gatedAction.intent).toBe("general_reply");
    expect(gatedAction.response).toContain("create campaign links or generate social copy");
    expect(gatedAction.payload["semantic_route"]).toMatchObject({
      clarification_reason: "close_alternative"
    });
  });

  it("asks for missing slots when a route is plausible but incomplete", () => {
    const action = makeAction({
      confidence: 0.68,
      missing_slots: ["listing target"]
    });
    const gatedAction = applySemanticRouteConfidenceGate(action);

    expect(gatedAction.intent).toBe("general_reply");
    expect(gatedAction.response).toContain("listing target");
    expect(gatedAction.payload["semantic_route"]).toMatchObject({
      clarification_reason: "missing_slots",
      missing_slots: ["listing target"]
    });
  });

  it("never gates an explicit general reply", () => {
    const action = makeAction({
      intent: "general_reply",
      requires_confirmation: false,
      confidence: 0.2
    });

    expect(applySemanticRouteConfidenceGate(action)).toBe(action);
  });
});
