import type { AgentAction } from "@/lib/agent/types";

export const semanticRouteThresholds = {
  lowConfidence: 0.45,
  highConfidence: 0.75,
  closeAlternativeDelta: 0.12
};

export type SemanticRouteClarificationReason = "low_confidence" | "close_alternative" | "missing_slots";

type Thresholds = typeof semanticRouteThresholds;

function getAlternativeConfidence(action: AgentAction) {
  return action.alternative_intents?.find((alternative) => typeof alternative.confidence === "number")?.confidence;
}

export function getSemanticRouteClarificationReason(
  action: AgentAction,
  thresholds: Thresholds = semanticRouteThresholds
): SemanticRouteClarificationReason | null {
  if (action.intent === "general_reply" || typeof action.confidence !== "number") {
    return null;
  }

  if (action.confidence < thresholds.lowConfidence) {
    return "low_confidence";
  }

  const alternativeConfidence = getAlternativeConfidence(action);
  if (
    typeof alternativeConfidence === "number" &&
    action.confidence < thresholds.highConfidence &&
    action.confidence - alternativeConfidence <= thresholds.closeAlternativeDelta
  ) {
    return "close_alternative";
  }

  if (action.confidence < thresholds.highConfidence && action.missing_slots?.length) {
    return "missing_slots";
  }

  return null;
}

function formatIntentLabel(intent: string) {
  return intent.replace(/_/g, " ");
}

function uniqueIntentOptions(action: AgentAction) {
  const options = [action.intent, ...(action.alternative_intents ?? []).map((alternative) => alternative.intent)];
  return Array.from(new Set(options)).slice(0, 3).map(formatIntentLabel);
}

function buildClarificationResponse(action: AgentAction, reason: SemanticRouteClarificationReason) {
  if (reason === "missing_slots" && action.missing_slots?.length) {
    return `I can help with ${formatIntentLabel(action.intent)}, but I need ${action.missing_slots.join(", ")} before I continue.`;
  }

  const options = uniqueIntentOptions(action);
  if (options.length > 1) {
    return `I want to make sure I choose the right workflow. Do you mean ${options.join(" or ")}?`;
  }

  return "I want to make sure I choose the right workflow. Can you clarify what you want me to do next?";
}

export function applySemanticRouteConfidenceGate(action: AgentAction): AgentAction {
  const clarificationReason = getSemanticRouteClarificationReason(action);

  if (!clarificationReason) {
    return action;
  }

  return {
    ...action,
    intent: "general_reply",
    requires_confirmation: false,
    response: buildClarificationResponse(action, clarificationReason),
    payload: {
      query: action.payload.query,
      semantic_route: {
        original_intent: action.intent,
        confidence: action.confidence,
        alternative_intents: action.alternative_intents ?? [],
        missing_slots: action.missing_slots ?? [],
        is_follow_up_to_workflow: action.is_follow_up_to_workflow ?? false,
        route_reason: action.route_reason,
        clarification_reason: clarificationReason
      }
    }
  };
}
