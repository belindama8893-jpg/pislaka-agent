import { describe, expect, it } from "vitest";
import {
  buildAgentGuidanceContext,
  getAgentComposerPlaceholder,
  getAgentGuidanceSuggestions,
  type AgentGuidanceBrokerState,
  type AgentGuidanceContext,
  type AgentGuidanceConversationState
} from "../../lib/agent/guidance";

function baseContext(
  overrides: {
    brokerState?: Partial<AgentGuidanceBrokerState>;
    conversationState?: Partial<AgentGuidanceConversationState>;
  } = {}
): AgentGuidanceContext {
  return {
    brokerState: {
      hasListings: false,
      hasLeads: false,
      recentListingCount: 0,
      recentLeadCount: 0,
      todayFollowupCount: 0,
      overdueFollowupCount: 0,
      ...overrides.brokerState
    },
    conversationState: {
      hasStarted: false,
      ...overrides.conversationState
    }
  };
}

describe("agent guidance", () => {
  it("prioritizes listing creation for an empty workspace", () => {
    const suggestions = getAgentGuidanceSuggestions(baseContext(), { surface: "home", limit: 2 });

    expect(suggestions[0]).toMatchObject({
      intent: "create_listing_draft",
      label: "Listing Builder",
      confirmationRequired: false
    });
  });

  it("builds guidance context from broker workspace state", () => {
    const context = buildAgentGuidanceContext({
      leads: [
        { next_follow_up_at: "2026-06-16T08:00:00.000Z" },
        { next_follow_up_at: "2026-06-15T23:00:00.000Z" },
        { next_follow_up_at: "not-a-date" },
        {}
      ],
      listingCount: 0,
      sessionListingCount: 1,
      hasStarted: true,
      activeLeadId: "lead-1",
      activeListingId: null,
      isWhatsAppImportMode: false,
      timeZone: "Asia/Shanghai",
      now: new Date("2026-06-16T06:00:00.000Z")
    });

    expect(context).toMatchObject({
      brokerState: {
        hasListings: true,
        hasLeads: true,
        recentListingCount: 1,
        recentLeadCount: 4,
        todayFollowupCount: 2,
        overdueFollowupCount: 1
      },
      conversationState: {
        hasStarted: true,
        activeLeadId: "lead-1"
      }
    });
  });

  it("keeps the recommended Agent skills in the product-defined order", () => {
    const suggestions = getAgentGuidanceSuggestions(
      baseContext({
        brokerState: {
          hasListings: true,
          hasLeads: true,
          todayFollowupCount: 2,
          overdueFollowupCount: 1
        }
      }),
      { surface: "home", limit: 4 }
    );

    expect(suggestions.map((suggestion) => suggestion.intent)).toEqual([
      "create_listing_draft",
      "create_campaign_links",
      "list_today_followups",
      "create_schedule_event"
    ]);
  });

  it("uses contextual placeholders for import, lead, and listing states", () => {
    expect(
      getAgentComposerPlaceholder(
        baseContext({
          conversationState: {
            hasStarted: false,
            isWhatsAppImportMode: true
          }
        })
      )
    ).toContain("WhatsApp chat");

    expect(
      getAgentComposerPlaceholder(
        baseContext({
          conversationState: {
            hasStarted: true,
            activeLeadId: "lead-1"
          }
        })
      )
    ).toContain("selected lead");

    expect(
      getAgentComposerPlaceholder(
        baseContext({
          brokerState: {
            hasListings: true,
            hasLeads: true
          },
          conversationState: {
            hasStarted: true,
            activeListingId: "listing-1"
          }
        })
      )
    ).toContain("property and channel");
  });
});
