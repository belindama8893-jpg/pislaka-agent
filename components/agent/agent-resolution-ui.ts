import type { AgentAction } from "@/lib/agent/types";

export type AgentResolutionFailureStatus = "no_match" | "ambiguous" | "needs_clarification";

export type AgentResolutionFailureActionType = "fallback_list" | "retry_input" | "select_candidate";

export type AgentResolutionFailureCandidate = {
  displayLabel: string;
  id: string;
};

export type AgentResolutionFailureUi = {
  actions: Array<{
    label: string;
    type: AgentResolutionFailureActionType;
  }>;
  candidates?: AgentResolutionFailureCandidate[];
  message: {
    detail?: string;
    headline: string;
  };
  status: AgentResolutionFailureStatus;
};

type ResolutionTargetType = NonNullable<AgentAction["resolution"]>["target_type"];
type ResolutionCandidate = NonNullable<NonNullable<AgentAction["resolution"]>["matched"]>;

function targetLabel(targetType: ResolutionTargetType) {
  switch (targetType) {
    case "listing":
      return "listing";
    case "schedule_event":
      return "schedule item";
    case "lead":
    default:
      return "lead";
  }
}

function displayCandidate(candidate: ResolutionCandidate) {
  return [
    candidate.label,
    candidate.phone,
    candidate.email,
    [candidate.listing_title, candidate.listing_area, candidate.listing_city].filter(Boolean).join(", ") || null,
    [candidate.area_value, candidate.area_unit].filter(Boolean).join(" ") || null,
    candidate.location_area ?? candidate.listing_area
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildAgentResolutionFailureUi(
  resolution: AgentAction["resolution"],
  options: {
    requestedLabel?: string;
    targetType?: ResolutionTargetType;
  } = {}
): AgentResolutionFailureUi | null {
  if (!resolution || resolution.status === "matched") {
    return null;
  }

  const status = resolution.status;
  const targetType = resolution.target_type ?? options.targetType ?? "lead";
  const label = targetLabel(targetType);
  const requested = options.requestedLabel?.trim();
  const requestedText = requested ? ` "${requested}"` : "";

  if (status === "ambiguous") {
    const candidates = (resolution.candidates ?? []).map((candidate) => ({
      id: candidate.id,
      displayLabel: displayCandidate(candidate)
    }));

    return {
      status,
      message: {
        headline: `Choose the right ${label}`,
        detail: candidates.length
          ? `I found ${candidates.length} possible ${label}${candidates.length === 1 ? "" : "s"}${requestedText}.`
          : `I found more than one possible ${label}${requestedText}.`
      },
      actions: [{ label: `Select ${label}`, type: "select_candidate" }],
      candidates
    };
  }

  if (status === "needs_clarification") {
    return {
      status,
      message: {
        headline: `I need one more detail`,
        detail:
          targetType === "listing"
            ? "Add the listing title, area, size, or open a listing card before I continue."
            : targetType === "schedule_event"
              ? "Add the missing schedule detail before I continue."
              : "Add the buyer name, phone number, or open a lead card before I continue."
      },
      actions: [{ label: "Add detail", type: "retry_input" }]
    };
  }

  return {
    status,
    message: {
      headline: `Couldn't find this ${label}`,
      detail:
        targetType === "listing"
          ? `No saved listing matches${requestedText || " that request"}. Add the exact title, area, or use a listing card.`
          : `No saved lead matches${requestedText || " that request"}. Check the buyer name or phone number.`
    },
    actions: [
      { label: targetType === "listing" ? "Show listings" : "Show recent leads", type: "fallback_list" },
      { label: "Try again", type: "retry_input" }
    ]
  };
}

export function formatAgentResolutionFailureMessage(ui: AgentResolutionFailureUi) {
  return [ui.message.headline, ui.message.detail].filter(Boolean).join(" ");
}
