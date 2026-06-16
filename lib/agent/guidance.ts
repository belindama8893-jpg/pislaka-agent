import { getAgentIntentDefinition, type AgentIntentUiCard } from "@/lib/agent/registry/intents";
import type { AgentAction } from "@/lib/agent/types";

export type AgentGuidanceSurface =
  | "home"
  | "composer_placeholder"
  | "composer_action"
  | "after_card"
  | "nudge";

export type AgentGuidanceBrokerState = {
  hasListings: boolean;
  hasLeads: boolean;
  recentListingCount?: number;
  recentLeadCount?: number;
  todayFollowupCount?: number;
  overdueFollowupCount?: number;
};

export type AgentGuidanceConversationState = {
  hasStarted: boolean;
  isWhatsAppImportMode?: boolean;
  activeIntent?: AgentAction["intent"];
  lastCompletedIntent?: AgentAction["intent"];
  activeLeadId?: string | null;
  activeListingId?: string | null;
};

export type AgentGuidanceContext = {
  brokerState: AgentGuidanceBrokerState;
  conversationState: AgentGuidanceConversationState;
};

export type AgentGuidanceSuggestion = {
  id: string;
  intent: AgentAction["intent"];
  surface: AgentGuidanceSurface;
  priority: number;
  label: string;
  prompt: string;
  reason: string;
  uiCard: AgentIntentUiCard;
  confirmationRequired: boolean;
};

export type AgentGuidanceLeadInput = {
  next_follow_up_at?: string | null;
};

export type AgentGuidanceContextInput = {
  leads: AgentGuidanceLeadInput[];
  listingCount: number;
  sessionListingCount?: number;
  hasStarted: boolean;
  isWhatsAppImportMode?: boolean;
  activeLeadId?: string | null;
  activeListingId?: string | null;
  timeZone?: string;
  now?: Date;
};

type RankedIntent = {
  intent: AgentAction["intent"];
  reason: string;
  priorityBoost: number;
};

const DEFAULT_PLACEHOLDER =
  getAgentIntentDefinition("general_reply").ui.placeholder ?? "Paste a listing link, WhatsApp chat, or ask anything...";

function isIntentAvailable(intent: AgentAction["intent"], context: AgentGuidanceContext) {
  const definition = getAgentIntentDefinition(intent);
  return context.brokerState.hasLeads || definition.availability.guest || definition.availability.broker;
}

function buildSuggestion(
  rankedIntent: RankedIntent,
  surface: AgentGuidanceSurface
): AgentGuidanceSuggestion | null {
  const definition = getAgentIntentDefinition(rankedIntent.intent);
  const label = surface === "home" ? definition.ui.emptyStateLabel : definition.ui.actionLabel;
  const prompt = definition.ui.starterPrompt ?? definition.ui.placeholder ?? definition.input.examples[0];

  if (!label || !prompt) {
    return null;
  }

  return {
    id: `${surface}:${rankedIntent.intent}`,
    intent: rankedIntent.intent,
    surface,
    priority: definition.routing.priority + rankedIntent.priorityBoost,
    label,
    prompt,
    reason: rankedIntent.reason,
    uiCard: definition.uiCard,
    confirmationRequired: definition.confirmation !== "never"
  };
}

function rankedHomeIntents(context: AgentGuidanceContext): RankedIntent[] {
  const { brokerState, conversationState } = context;
  const ranked: RankedIntent[] = [];

  if ((brokerState.overdueFollowupCount ?? 0) > 0 || (brokerState.todayFollowupCount ?? 0) > 0) {
    ranked.push({
      intent: "list_today_followups",
      reason: "Follow-ups are due in this broker workspace.",
      priorityBoost: 40
    });
  }

  if (!brokerState.hasListings) {
    ranked.push({
      intent: "create_listing_draft",
      reason: "The broker has no saved listings yet.",
      priorityBoost: 35
    });
  }

  if (brokerState.hasListings || conversationState.activeListingId) {
    ranked.push({
      intent: "create_campaign_links",
      reason: "Saved or selected listings can be promoted next.",
      priorityBoost: 25
    });
  }

  if (!brokerState.hasLeads) {
    ranked.push({
      intent: "create_lead",
      reason: "The broker has no saved leads yet.",
      priorityBoost: 20
    });
  }

  ranked.push(
    {
      intent: "create_listing_draft",
      reason: "Listing creation is the fastest first broker workflow.",
      priorityBoost: 0
    },
    {
      intent: "create_lead",
      reason: "Lead capture is a common broker starting point.",
      priorityBoost: 0
    },
    {
      intent: "list_today_followups",
      reason: "Daily follow-up review keeps broker work moving.",
      priorityBoost: 0
    },
    {
      intent: "create_campaign_links",
      reason: "Promotion is the next step after a listing exists.",
      priorityBoost: 0
    }
  );

  return ranked;
}

function getDayKey(date: Date, timeZone?: string) {
  return date.toLocaleDateString("en-CA", timeZone ? { timeZone } : undefined);
}

function getFollowupCounts(leads: AgentGuidanceLeadInput[], timeZone?: string, now = new Date()) {
  const todayKey = getDayKey(now, timeZone);
  const nowTime = now.getTime();

  return leads.reduce(
    (counts, lead) => {
      if (!lead.next_follow_up_at) {
        return counts;
      }

      const followupDate = new Date(lead.next_follow_up_at);
      const followupTime = followupDate.getTime();
      if (Number.isNaN(followupTime)) {
        return counts;
      }

      if (followupTime <= nowTime) {
        counts.overdue += 1;
      }

      if (getDayKey(followupDate, timeZone) === todayKey) {
        counts.today += 1;
      }

      return counts;
    },
    { overdue: 0, today: 0 }
  );
}

export function buildAgentGuidanceContext(input: AgentGuidanceContextInput): AgentGuidanceContext {
  const listingCount = input.listingCount + (input.sessionListingCount ?? 0);
  const followupCounts = getFollowupCounts(input.leads, input.timeZone, input.now);

  return {
    brokerState: {
      hasListings: listingCount > 0,
      hasLeads: input.leads.length > 0,
      recentListingCount: listingCount,
      recentLeadCount: input.leads.length,
      todayFollowupCount: followupCounts.today,
      overdueFollowupCount: followupCounts.overdue
    },
    conversationState: {
      hasStarted: input.hasStarted,
      isWhatsAppImportMode: input.isWhatsAppImportMode,
      activeLeadId: input.activeLeadId,
      activeListingId: input.activeListingId
    }
  };
}

export function getAgentGuidanceSuggestions(
  context: AgentGuidanceContext,
  options: { surface?: AgentGuidanceSurface; limit?: number } = {}
) {
  const surface = options.surface ?? "home";
  const limit = options.limit ?? 4;
  const seen = new Set<AgentAction["intent"]>();

  return rankedHomeIntents(context)
    .filter((item) => {
      if (seen.has(item.intent) || !isIntentAvailable(item.intent, context)) {
        return false;
      }

      seen.add(item.intent);
      return true;
    })
    .map((item) => buildSuggestion(item, surface))
    .filter((item): item is AgentGuidanceSuggestion => Boolean(item))
    .sort((left, right) => right.priority - left.priority)
    .slice(0, limit);
}

export function getAgentComposerPlaceholder(context: AgentGuidanceContext) {
  const { brokerState, conversationState } = context;

  if (conversationState.isWhatsAppImportMode) {
    return (
      getAgentIntentDefinition("create_followup_from_chat").ui.placeholder ??
      "Paste WhatsApp chat or drop a .txt/.zip export..."
    );
  }

  if (conversationState.activeLeadId) {
    return getAgentIntentDefinition("draft_lead_reply").ui.placeholder ?? DEFAULT_PLACEHOLDER;
  }

  if (conversationState.activeListingId) {
    return getAgentIntentDefinition("create_campaign_links").ui.placeholder ?? DEFAULT_PLACEHOLDER;
  }

  if ((brokerState.overdueFollowupCount ?? 0) > 0 || (brokerState.todayFollowupCount ?? 0) > 0) {
    return getAgentIntentDefinition("list_today_followups").ui.placeholder ?? DEFAULT_PLACEHOLDER;
  }

  if (!brokerState.hasListings) {
    return getAgentIntentDefinition("create_listing_draft").ui.placeholder ?? DEFAULT_PLACEHOLDER;
  }

  return DEFAULT_PLACEHOLDER;
}
