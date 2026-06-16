import { describe, expect, it, vi } from "vitest";
import {
  createAgentActionResponseHandlers,
  handleAgentActionResponse,
  type AgentActionResponseHandlerDependencies
} from "../../components/agent/agent-action-response-handlers";
import type { AgentAction } from "../../lib/agent/types";

function action(intent: AgentAction["intent"], payload: AgentAction["payload"] = {}): AgentAction {
  return {
    intent,
    payload,
    requires_confirmation: false,
    response: "Action response"
  };
}

function dependencies(): AgentActionResponseHandlerDependencies {
  return {
    appendAssistantMessage: vi.fn(),
    draftReplyForLead: vi.fn().mockResolvedValue(undefined),
    looksLikeExternalChannelPromotion: vi.fn(() => false),
    proposeLeadCreate: vi.fn(),
    proposeLeadDetailsUpdate: vi.fn(),
    proposeLeadFollowUpRecord: vi.fn(),
    proposeLeadListingUpdate: vi.fn(),
    proposeLeadStatusUpdate: vi.fn(),
    proposeListingUpdateFromMessage: vi.fn(),
    proposePromotionFromMessage: vi.fn(),
    showAnalyticsSummary: vi.fn().mockResolvedValue(undefined),
    showLeadResults: vi.fn(),
    showScheduleResolutionMessage: vi.fn(() => false),
    showScheduleResults: vi.fn().mockResolvedValue(undefined),
    showTodayFollowUps: vi.fn().mockResolvedValue(undefined)
  };
}

describe("agent action response handlers", () => {
  it("routes campaign links to the promotion preview handler", async () => {
    const deps = dependencies();
    const handlers = createAgentActionResponseHandlers(deps);
    const handled = await handleAgentActionResponse(
      handlers,
      action("create_campaign_links", { listing_id: "listing-1" }),
      "Promote this listing on WhatsApp"
    );

    expect(handled).toBe(true);
    expect(deps.proposePromotionFromMessage).toHaveBeenCalledWith(
      "Promote this listing on WhatsApp",
      undefined
    );
  });

  it("does not treat publish_listing as promotion without an external channel cue", async () => {
    const deps = dependencies();
    const handlers = createAgentActionResponseHandlers(deps);
    const handled = await handleAgentActionResponse(
      handlers,
      action("publish_listing", { listing_id: "listing-1" }),
      "Publish this listing"
    );

    expect(handled).toBe(false);
    expect(deps.proposePromotionFromMessage).not.toHaveBeenCalled();
  });

  it("allows publish_listing fallback to promotion only when external channel cue is present", async () => {
    const deps = dependencies();
    vi.mocked(deps.looksLikeExternalChannelPromotion).mockReturnValue(true);
    const handlers = createAgentActionResponseHandlers(deps);
    const handled = await handleAgentActionResponse(
      handlers,
      action("publish_listing", { listing_id: "listing-1" }),
      "Post this listing on Facebook"
    );

    expect(handled).toBe(true);
    expect(deps.proposePromotionFromMessage).toHaveBeenCalledWith(
      "Post this listing on Facebook",
      undefined
    );
  });

  it("returns false when no handler exists for the intent", async () => {
    const deps = dependencies();
    const handlers = createAgentActionResponseHandlers(deps);
    const handled = await handleAgentActionResponse(
      handlers,
      action("general_reply", {}),
      "Hello"
    );

    expect(handled).toBe(false);
  });

  it("returns the schedule resolution handler result so card fallback can continue", async () => {
    const deps = dependencies();
    vi.mocked(deps.showScheduleResolutionMessage).mockReturnValue(false);
    const handlers = createAgentActionResponseHandlers(deps);
    const handled = await handleAgentActionResponse(
      handlers,
      action("create_schedule_event", { title: "Viewing with Ahmed" }),
      "Schedule viewing with Ahmed tomorrow"
    );

    expect(handled).toBe(false);
    expect(deps.showScheduleResolutionMessage).toHaveBeenCalled();
  });

  it("shows generated social copy inside the assistant message", async () => {
    const deps = dependencies();
    const handlers = createAgentActionResponseHandlers(deps);
    const promotion = { channels: [] };
    const handled = await handleAgentActionResponse(
      handlers,
      action("generate_social_copy", { promotion }),
      "Write Facebook copy"
    );

    expect(handled).toBe(true);
    expect(deps.appendAssistantMessage).toHaveBeenCalledWith({
      content: "Action response",
      promotion
    });
  });
});
