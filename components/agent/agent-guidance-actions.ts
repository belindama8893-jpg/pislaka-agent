import {
  CalendarClock,
  Globe2,
  House,
  Megaphone,
  MessageCircle,
  Sparkles,
  UserPlus
} from "lucide-react";
import type { AgentComposerAction } from "@/components/agent/AgentComposer";
import type { AgentGuidanceSuggestion } from "@/lib/agent/guidance";
import type { AgentAction } from "@/lib/agent/types";

const guidanceActionIcons: Partial<Record<AgentAction["intent"], AgentComposerAction["icon"]>> = {
  create_listing_draft: House,
  create_lead: MessageCircle,
  create_campaign_links: Megaphone,
  list_today_followups: CalendarClock,
  draft_lead_reply: MessageCircle,
  create_schedule_event: CalendarClock,
  list_schedule_events: CalendarClock,
  show_basic_attribution: Globe2,
  update_lead_status: UserPlus
};

export function createAgentGuidanceComposerActions(
  suggestions: AgentGuidanceSuggestion[],
  appendAssistantMessage: (message: { content: string }) => void
): AgentComposerAction[] {
  return suggestions.map((suggestion) => ({
    icon: guidanceActionIcons[suggestion.intent] ?? Sparkles,
    label: suggestion.label,
    onClick: () =>
      appendAssistantMessage({
        content: suggestion.prompt
      })
  }));
}
