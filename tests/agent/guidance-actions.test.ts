import { describe, expect, it, vi } from "vitest";
import { createAgentGuidanceComposerActions } from "../../components/agent/agent-guidance-actions";
import type { AgentGuidanceSuggestion } from "../../lib/agent/guidance";

function suggestion(overrides: Partial<AgentGuidanceSuggestion> = {}): AgentGuidanceSuggestion {
  return {
    id: "home:create_listing_draft",
    intent: "create_listing_draft",
    surface: "home",
    priority: 100,
    label: "List from Link",
    prompt: "Send me a property link or details.",
    reason: "The broker has no saved listings yet.",
    uiCard: "listing_draft",
    confirmationRequired: false,
    ...overrides
  };
}

describe("agent guidance composer actions", () => {
  it("turns guidance suggestions into composer actions", () => {
    const appendAssistantMessage = vi.fn();
    const actions = createAgentGuidanceComposerActions([suggestion()], appendAssistantMessage);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      label: "List from Link"
    });

    actions[0]?.onClick();

    expect(appendAssistantMessage).toHaveBeenCalledWith({
      content: "Send me a property link or details."
    });
  });
});
