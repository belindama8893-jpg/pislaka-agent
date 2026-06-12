import type { AgentAction, ScheduleEventListPayload } from "@/lib/agent/types";

export type AgentResponseLanguage = "english" | "urdu" | "roman_urdu" | "chinese";

const urduScriptPattern = /[\u0600-\u06ff]/u;
const chineseScriptPattern = /[\u3400-\u9fff]/u;

export function detectAgentResponseLanguage(message: string): AgentResponseLanguage {
  if (urduScriptPattern.test(message)) {
    return "urdu";
  }

  if (chineseScriptPattern.test(message)) {
    return "chinese";
  }

  if (
    /\b(?:kya|kia|kal|aaj|mera|mere|meri|hain|hai|batao|dikhao|chahiye|karna|karo|mujhe|ap|aap)\b/i.test(
      message
    )
  ) {
    return "roman_urdu";
  }

  return "english";
}

export function formatScheduleQueryResponse(
  payload: Pick<ScheduleEventListPayload, "date_filter">,
  sourceMessage: string
) {
  const language = detectAgentResponseLanguage(sourceMessage);
  const dateFilter = payload.date_filter;

  if (language === "urdu") {
    if (dateFilter === "tomorrow") {
      return "کل کے لیے آپ کے شیڈول آئٹمز یہ ہیں۔";
    }
    if (dateFilter === "week") {
      return "اس ہفتے کے لیے آپ کے شیڈول آئٹمز یہ ہیں۔";
    }
    if (dateFilter === "all") {
      return "آپ کے تمام شیڈول آئٹمز یہ ہیں۔";
    }
    return "آج کے لیے آپ کے شیڈول آئٹمز یہ ہیں۔";
  }

  if (language === "roman_urdu") {
    if (dateFilter === "tomorrow") {
      return "Kal ke liye aap ke schedule items yeh hain.";
    }
    if (dateFilter === "week") {
      return "Is haftay ke liye aap ke schedule items yeh hain.";
    }
    if (dateFilter === "all") {
      return "Aap ke tamam schedule items yeh hain.";
    }
    return "Aaj ke liye aap ke schedule items yeh hain.";
  }

  if (language === "chinese") {
    if (dateFilter === "tomorrow") {
      return "这是你明天的日程。";
    }
    if (dateFilter === "week") {
      return "这是你本周的日程。";
    }
    if (dateFilter === "all") {
      return "这是你的全部日程。";
    }
    return "这是你今天的日程。";
  }

  if (dateFilter === "tomorrow") {
    return "Here are your schedule items for tomorrow.";
  }
  if (dateFilter === "week") {
    return "Here are your schedule items for this week.";
  }
  if (dateFilter === "all") {
    return "Here are all your schedule items.";
  }
  return "Here are your schedule items for today.";
}

export function localizeAgentActionResponse(action: AgentAction, sourceMessage: string): AgentAction {
  if (action.intent === "list_schedule_events") {
    return {
      ...action,
      response: formatScheduleQueryResponse(action.payload as ScheduleEventListPayload, sourceMessage)
    };
  }

  return action;
}
