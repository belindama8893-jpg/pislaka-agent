import { env, requireServerEnv } from "@/lib/env";
import { leadReplyDraftSchema, type LeadReplyDraft } from "@/lib/leads/reply-types";
import type { LeadListItem } from "@/lib/leads/types";

export type ChatFollowUpSummary = {
  detected_customer_name: string | null;
  detected_phone: string | null;
  chat_summary: string;
  customer_needs: string[];
  interested_area: string | null;
  interested_listing_text: string | null;
  budget: {
    min: number | null;
    max: number | null;
    text: string | null;
  };
  viewing_intent: string | null;
  main_objections: string[];
  status_suggestion: "new" | "contacted" | "qualified" | "closed" | "lost";
  urgency_suggestion: "low" | "normal" | "high";
  next_action_suggestion: string;
  reply_draft: LeadReplyDraft;
};

type ChatImportContext = {
  text: string;
  lead?: LeadListItem | null;
};

const chatImportSystemPrompt = `
You are Pislaka Agent, a WhatsApp chat follow-up summarizer for Pakistani real estate brokers.
Return only JSON. Do not return markdown.

The broker manually pasted or uploaded WhatsApp chat text. This is not WhatsApp API access.
Generate a preview only. Do not claim anything was saved, sent, or updated.

Output shape:
{
  "detected_customer_name": "Ahmed or null",
  "detected_phone": "+923001234567 or null",
  "chat_summary": "Short factual follow-up summary",
  "customer_needs": ["needs DHA Phase 5 villa"],
  "interested_area": "DHA Phase 5 or null",
  "interested_listing_text": "DHA Phase 5 villa or null",
  "budget": { "min": 85000000, "max": null, "text": "8.5 crore" },
  "viewing_intent": "Wants to visit tomorrow after 5 or null",
  "main_objections": ["final price"],
  "status_suggestion": "qualified",
  "urgency_suggestion": "high",
  "next_action_suggestion": "Confirm viewing time",
  "reply_draft": {
    "reply_text": "WhatsApp-ready reply text",
    "tone": "friendly and professional",
    "next_step": "Suggested next step"
  }
}

Rules:
- Keep summaries concise and factual.
- Do not invent property facts, availability, discounts, or guarantees.
- If buyer wants a visit, suggest qualified + high urgency.
- If buyer says no/not interested, suggest lost.
- If unclear, suggest contacted + normal urgency.
- Reply draft must be short enough for WhatsApp.
`;

function cleanLine(line: string) {
  return line
    .replace(/^\uFEFF/, "")
    .replace(/[\u200E\u200F]/g, "")
    .trim();
}

export function normalizeWhatsAppChatText(text: string) {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => {
      if (!line) {
        return false;
      }

      return !/messages and calls are end-to-end encrypted|media omitted|image omitted|video omitted|audio omitted|sticker omitted|document omitted/i.test(
        line
      );
    })
    .join("\n")
    .slice(0, 24_000);
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?92|0)\d[\d\s().-]{7,}\d/);
  return match?.[0]?.replace(/[^\d+]/g, "") ?? null;
}

function extractName(text: string) {
  const lineMatch = text.match(/(?:\]\s*|-\s*)?([\p{L}][\p{L}\p{N} .'’-]{1,40}):\s+/u);
  const name = lineMatch?.[1]?.trim();

  if (!name || /^(me|broker|customer|buyer|you)$/i.test(name)) {
    return null;
  }

  return name;
}

function extractArea(text: string) {
  return (
    text.match(/DHA\s*Phase\s*\d+/i)?.[0] ??
    text.match(/Bahria\s*Town|Gulberg|Lakecity|Askari\s*\d*|Model\s*Town/i)?.[0] ??
    null
  );
}

function parsePriceText(text: string) {
  const croreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr|karor)/i);
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*lakh/i);

  if (croreMatch) {
    return {
      min: Math.round(Number(croreMatch[1]) * 10_000_000),
      max: null,
      text: croreMatch[0]
    };
  }

  if (lakhMatch) {
    return {
      min: Math.round(Number(lakhMatch[1]) * 100_000),
      max: null,
      text: lakhMatch[0]
    };
  }

  return { min: null, max: null, text: null };
}

function fallbackReply(summary: string, lead?: LeadListItem | null): LeadReplyDraft {
  const name = lead?.full_name?.trim() || "there";

  return {
    reply_text: `Hi ${name}, thanks for the update. ${summary} Would you like me to confirm the next step for you?`,
    tone: "friendly and professional",
    next_step: "Confirm buyer interest and next action."
  };
}

function fallbackSummary(context: ChatImportContext): ChatFollowUpSummary {
  const text = normalizeWhatsAppChatText(context.text);
  const area = extractArea(text);
  const budget = parsePriceText(text);
  const hasViewingIntent = /visit|viewing|see|come|tomorrow|today|after\s+\d|看房|参观/i.test(text);
  const notInterested = /not interested|no longer interested|not now|不感兴趣|没兴趣/i.test(text);
  const interested = hasViewingIntent || /available|final price|interested|预算|价格|visit|看房/i.test(text);
  const detectedName = extractName(text);
  const detectedPhone = extractPhone(text);
  const summaryParts = [
    detectedName ? `${detectedName} discussed the property` : "Customer discussed the property",
    area ? `in ${area}` : null,
    budget.text ? `around ${budget.text}` : null,
    hasViewingIntent ? "and asked about a possible visit" : null
  ].filter(Boolean);
  const chatSummary = `${summaryParts.join(" ")}.`;
  const statusSuggestion = notInterested ? "lost" : interested ? "qualified" : "contacted";

  return {
    detected_customer_name: detectedName,
    detected_phone: detectedPhone,
    chat_summary: chatSummary,
    customer_needs: [area ? `Interested in ${area}` : "Needs follow-up based on WhatsApp chat"].filter(Boolean),
    interested_area: area,
    interested_listing_text: area ? `${area} property` : null,
    budget,
    viewing_intent: hasViewingIntent ? "Customer mentioned a possible visit or timing." : null,
    main_objections: /final price|discount|negotiat/i.test(text) ? ["Asked about final price"] : [],
    status_suggestion: statusSuggestion,
    urgency_suggestion: statusSuggestion === "qualified" ? "high" : "normal",
    next_action_suggestion: hasViewingIntent ? "Confirm viewing availability." : "Send a short WhatsApp follow-up.",
    reply_draft: fallbackReply(chatSummary, context.lead)
  };
}

function formatPromptContext(context: ChatImportContext) {
  return {
    lead: context.lead
      ? {
          full_name: context.lead.full_name,
          phone: context.lead.phone,
          status: context.lead.status,
          urgency: context.lead.urgency,
          listing_title: context.lead.listing_title,
          listing_area: context.lead.listing_area,
          last_note: context.lead.last_note
        }
      : null,
    chat_text: normalizeWhatsAppChatText(context.text)
  };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Chat import response was not a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function coerceSummary(value: unknown, fallback: ChatFollowUpSummary): ChatFollowUpSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const replyDraft = leadReplyDraftSchema.safeParse(record.reply_draft);
  const budgetRecord =
    record.budget && typeof record.budget === "object" && !Array.isArray(record.budget)
      ? (record.budget as Record<string, unknown>)
      : {};
  const status = record.status_suggestion;
  const urgency = record.urgency_suggestion;

  return {
    detected_customer_name:
      typeof record.detected_customer_name === "string" ? record.detected_customer_name : fallback.detected_customer_name,
    detected_phone: typeof record.detected_phone === "string" ? record.detected_phone : fallback.detected_phone,
    chat_summary: typeof record.chat_summary === "string" ? record.chat_summary : fallback.chat_summary,
    customer_needs: Array.isArray(record.customer_needs)
      ? record.customer_needs.filter((item): item is string => typeof item === "string").slice(0, 8)
      : fallback.customer_needs,
    interested_area: typeof record.interested_area === "string" ? record.interested_area : fallback.interested_area,
    interested_listing_text:
      typeof record.interested_listing_text === "string"
        ? record.interested_listing_text
        : fallback.interested_listing_text,
    budget: {
      min: typeof budgetRecord.min === "number" ? budgetRecord.min : fallback.budget.min,
      max: typeof budgetRecord.max === "number" ? budgetRecord.max : fallback.budget.max,
      text: typeof budgetRecord.text === "string" ? budgetRecord.text : fallback.budget.text
    },
    viewing_intent: typeof record.viewing_intent === "string" ? record.viewing_intent : fallback.viewing_intent,
    main_objections: Array.isArray(record.main_objections)
      ? record.main_objections.filter((item): item is string => typeof item === "string").slice(0, 8)
      : fallback.main_objections,
    status_suggestion:
      status === "new" || status === "contacted" || status === "qualified" || status === "closed" || status === "lost"
        ? status
        : fallback.status_suggestion,
    urgency_suggestion: urgency === "low" || urgency === "normal" || urgency === "high" ? urgency : fallback.urgency_suggestion,
    next_action_suggestion:
      typeof record.next_action_suggestion === "string"
        ? record.next_action_suggestion
        : fallback.next_action_suggestion,
    reply_draft: replyDraft.success ? replyDraft.data : fallback.reply_draft
  };
}

export async function generateChatFollowUpSummary(context: ChatImportContext): Promise<ChatFollowUpSummary> {
  const fallback = fallbackSummary(context);

  if (!env.deepseekApiKey) {
    return fallback;
  }

  const apiKey = requireServerEnv("deepseekApiKey");

  try {
    const response = await fetch(`${env.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.deepseekModel,
        response_format: { type: "json_object" },
        temperature: 0.18,
        messages: [
          { role: "system", content: chatImportSystemPrompt },
          { role: "user", content: JSON.stringify(formatPromptContext(context)) }
        ]
      })
    });

    if (!response.ok) {
      return fallback;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return fallback;
    }

    return coerceSummary(JSON.parse(extractJsonObject(content)), fallback);
  } catch {
    return fallback;
  }
}
