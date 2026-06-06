import { env, requireServerEnv } from "@/lib/env";
import {
  agentActionSchema,
  leadOperationPayloadSchema,
  listingDraftPayloadSchema,
  scheduleEventActionPayloadSchema,
  type AgentAction
} from "@/lib/agent/types";
import {
  classifyLocalIntent,
  extractLeadName,
  extractLeadStatus,
  extractLeadStatusFilter
} from "@/lib/agent/intent-router";

const systemPrompt = `
You are Pislaka Agent, an AI assistant for real estate brokers in Pakistan.
Return only JSON. Do not return markdown.

Your job:
- Understand English, Urdu, and Roman Urdu real estate requests.
- Convert user messages into structured workflow actions.
- Never claim a listing is saved, published, shared, or sent unless a backend tool result says so.
- High-risk actions must require user confirmation.
- For listing drafts, extract only facts present in the user message or obvious Pakistan real estate defaults.
- For schedule events, extract appointment/reminder/recurring details. Use ISO 8601 timestamps with timezone offset when the user gives a clear date/time.
- Pakistan brokers usually operate in Asia/Karachi time. If the user says tomorrow/next week, interpret it from the current date provided by the user message context.
- Convert prices into numeric PKR. Examples: 8.5 crore = 85000000, 2 lakh = 200000.
- Normalize area units to kanal, marla, sqft, or sqm.
- Use short practical English in response text.
- If a required listing detail is missing, still return a draft with known fields and mention what is missing in response.

Supported intents:
- create_listing_draft
- update_listing_draft
- publish_listing
- create_campaign_links
- list_leads
- draft_lead_reply
- create_schedule_event
- list_schedule_events
- update_lead_status
- show_basic_attribution
- general_reply

Listing output shape:
{
  "intent": "create_listing_draft",
  "requires_confirmation": true,
  "response": "Short user-facing response",
  "payload": {
    "title": "short title",
    "description": "broker-ready description",
    "city": "Lahore",
    "location_area": "DHA Phase 6",
    "property_type": "house",
    "listing_type": "sale",
    "price_amount": 85000000,
    "price_currency": "PKR",
    "area_value": 1,
    "area_unit": "kanal",
    "bedrooms": 5,
    "bathrooms": 6,
    "features": ["corner", "near park"]
  }
}

Schedule output shape:
{
  "intent": "create_schedule_event",
  "requires_confirmation": true,
  "response": "I prepared a schedule item. Please confirm before I add it.",
  "payload": {
    "event_category": "appointment",
    "event_type": "viewing",
    "title": "Viewing with Ahmed",
    "description": "Show DHA Phase 5 villa to Ahmed.",
    "start_at": "2026-06-07T15:00:00+05:00",
    "end_at": "2026-06-07T16:00:00+05:00",
    "reminder_at": "2026-06-07T14:00:00+05:00",
    "lead_name": "Ahmed",
    "listing_reference": "DHA Phase 5 villa",
    "location_text": "DHA Phase 5, Lahore"
  }
}

Schedule classification:
- appointment: viewing, contract_signing, handover
- reminder: follow_up, offer_deadline, document_expiry
- recurring: weekly_review, monthly_client_review

Lead operation output shape:
{
  "intent": "update_lead_status",
  "requires_confirmation": true,
  "response": "I found a lead status change. Please confirm before I update it.",
  "payload": {
    "lead_name": "Ahmed",
    "status": "contacted",
    "urgency": "high"
  }
}

Lead rules:
- Use list_leads when the user asks who/which leads/customers/buyers to follow up, new leads, hot leads, or today's leads.
- Use draft_lead_reply when the user asks to reply to a lead/customer/buyer.
- Use update_lead_status when the user asks to mark/change/update a lead status.
- If the user says hot lead, set status to qualified and urgency to high.
- Never update a lead without confirmation.

Rules:
- Return only one JSON object.
- Do not include null values. Omit unknown fields.
- Do not include markdown fences.
`;

function getPakistanDate(offsetDays: number, hour = 10) {
  const now = new Date();
  const pakistanNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  pakistanNow.setDate(pakistanNow.getDate() + offsetDays);
  pakistanNow.setHours(hour, 0, 0, 0);

  const year = pakistanNow.getFullYear();
  const month = String(pakistanNow.getMonth() + 1).padStart(2, "0");
  const day = String(pakistanNow.getDate()).padStart(2, "0");
  const hours = String(pakistanNow.getHours()).padStart(2, "0");
  const minutes = String(pakistanNow.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:00+05:00`;
}

function addHours(isoDate: string, hours: number) {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + hours);

  const pakistanDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  const year = pakistanDate.getFullYear();
  const month = String(pakistanDate.getMonth() + 1).padStart(2, "0");
  const day = String(pakistanDate.getDate()).padStart(2, "0");
  const dateHours = String(pakistanDate.getHours()).padStart(2, "0");
  const minutes = String(pakistanDate.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${dateHours}:${minutes}:00+05:00`;
}

function parseLocalLeadStatusUpdate(message: string): AgentAction {
  const leadName = extractLeadName(message);
  const status = extractLeadStatus(message);

  return {
    intent: "update_lead_status",
    requires_confirmation: true,
    response: "I prepared a lead status update. Please confirm before I change your lead record.",
    payload: {
      lead_name: leadName,
      ...status,
      query: message
    }
  };
}

function parseLocalLeadReplyRequest(message: string): AgentAction {
  return {
    intent: "draft_lead_reply",
    requires_confirmation: false,
    response: "I will find the matching lead and draft a WhatsApp reply for review.",
    payload: {
      lead_name: extractLeadName(message),
      query: message
    }
  };
}

function parseLocalLeadQuery(message: string): AgentAction {
  return {
    intent: "list_leads",
    requires_confirmation: false,
    response: "Here are the matching leads from your inbox.",
    payload: {
      query: message,
      status_filter: extractLeadStatusFilter(message)
    }
  };
}

function extractScheduleTime(message: string) {
  const lower = message.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = 10;

  if (timeMatch) {
    hour = Number(timeMatch[1]);
    if (timeMatch[3] === "pm" && hour < 12) {
      hour += 12;
    }
    if (timeMatch[3] === "am" && hour === 12) {
      hour = 0;
    }
  } else if (/afternoon|下午/i.test(message)) {
    hour = 15;
  } else if (/evening|tonight|晚上/i.test(message)) {
    hour = 19;
  }

  if (/tomorrow|明天/i.test(message)) {
    return getPakistanDate(1, hour);
  }

  if (/next week|下周/i.test(message)) {
    return getPakistanDate(7, hour);
  }

  if (/today|tonight|今天|今晚/i.test(message)) {
    return getPakistanDate(0, hour);
  }

  return undefined;
}

function parseLocalScheduleEvent(message: string): AgentAction {
  const lower = message.toLowerCase();
  const startAt = extractScheduleTime(message);
  const leadName = extractLeadName(message);
  const listingMatch = message.match(/DHA\s*Phase\s*\d+[^,.，。]*/i);
  const listingReference = listingMatch?.[0]?.trim();
  const isRecurring = /weekly|monthly|每周|每月/i.test(message);
  const isAppointment = /viewing|visit|showing|看房|appointment|contract|sign|handover|签约|合同|交房/i.test(message);
  const eventCategory = isRecurring ? "recurring" : isAppointment ? "appointment" : "reminder";
  const eventType = /contract|sign|合同|签约/i.test(message)
    ? "contract_signing"
    : /handover|delivery|交房/i.test(message)
      ? "handover"
      : /deadline|报价截止/i.test(message)
        ? "offer_deadline"
        : /document|文件/i.test(message)
          ? "document_expiry"
          : /monthly|每月/i.test(message)
            ? "monthly_client_review"
            : /weekly|每周/i.test(message)
              ? "weekly_review"
              : /viewing|visit|showing|看房/i.test(message)
                ? "viewing"
                : "follow_up";
  const titleSubject = leadName ? ` with ${leadName}` : "";
  const title =
    eventType === "viewing"
      ? `Viewing${titleSubject}`
      : eventType === "follow_up"
        ? `Follow up${titleSubject}`
        : eventType.replace(/_/g, " ");

  return {
    intent: "create_schedule_event",
    requires_confirmation: true,
    response: "I prepared a schedule item. Please confirm before I add it to your calendar.",
    payload: {
      event_category: eventCategory,
      event_type: eventType,
      title,
      description: message,
      start_at: eventCategory === "appointment" ? startAt : undefined,
      end_at: eventCategory === "appointment" && startAt ? addHours(startAt, 1) : undefined,
      reminder_at: eventCategory !== "appointment" ? startAt : startAt ? addHours(startAt, -1) : undefined,
      recurrence_rule:
        eventType === "weekly_review"
          ? "FREQ=WEEKLY"
          : eventType === "monthly_client_review"
            ? "FREQ=MONTHLY"
            : undefined,
      lead_name: leadName,
      listing_reference: listingReference,
      location_text: listingReference ? `${listingReference}, Lahore` : undefined,
      source_payload: {
        source: "local_schedule_parser",
        original_message: message
      }
    }
  };
}

function parseLocalListingDraft(message: string): AgentAction {
  const lower = message.toLowerCase();
  const croreMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr|karor)/);
  const kanalMatch = lower.match(/(\d+(?:\.\d+)?)\s*kanal/);
  const marlaMatch = lower.match(/(\d+(?:\.\d+)?)\s*marla/);
  const bedMatch = lower.match(/(\d+)\s*(?:bed|beds|bedroom|bedrooms)/);
  const bathMatch = lower.match(/(\d+)\s*(?:bath|baths|bathroom|bathrooms)/);
  const dhaMatch = message.match(/DHA\s*Phase\s*\d+/i);
  const bahriaMatch = message.match(/Bahria\s*Town/i);
  const locationArea = dhaMatch?.[0] ?? bahriaMatch?.[0] ?? undefined;
  const listingType = /\b(rent|rental|lease)\b/i.test(message) ? "rent" : "sale";
  const propertyType = /\b(apartment|flat)\b/i.test(message)
    ? "apartment"
    : /\b(plot|plots)\b/i.test(message)
      ? "plot"
      : /\b(shop|commercial)\b/i.test(message)
        ? "commercial"
        : "house";
  const areaValue = kanalMatch ? Number(kanalMatch[1]) : marlaMatch ? Number(marlaMatch[1]) : undefined;
  const areaUnit = kanalMatch ? "kanal" : marlaMatch ? "marla" : undefined;
  const priceAmount = croreMatch ? Math.round(Number(croreMatch[1]) * 10000000) : undefined;
  const city = /\bkarachi\b/i.test(message) ? "Karachi" : /\bislamabad\b/i.test(message) ? "Islamabad" : "Lahore";
  const titleParts = [
    areaValue && areaUnit ? `${areaValue} ${areaUnit}` : undefined,
    propertyType === "house" ? "House" : propertyType[0].toUpperCase() + propertyType.slice(1),
    locationArea ? `in ${locationArea}` : undefined
  ].filter(Boolean);

  return {
    intent: "create_listing_draft",
    requires_confirmation: true,
    response: "I drafted a listing preview from your message. Please review and confirm before adding it to your library.",
    payload: {
      title: titleParts.join(" ") || "New Property Listing",
      description: locationArea
        ? `A ${areaValue && areaUnit ? `${areaValue} ${areaUnit} ` : ""}${propertyType} located in ${locationArea}, ${city}. Review the details and add photos or video before publishing.`
        : "A property listing drafted from your message. Review details before publishing.",
      city,
      location_area: locationArea,
      property_type: propertyType,
      listing_type: listingType,
      price_amount: priceAmount,
      price_currency: "PKR",
      area_value: areaValue,
      area_unit: areaUnit,
      bedrooms: bedMatch ? Number(bedMatch[1]) : undefined,
      bathrooms: bathMatch ? Number(bathMatch[1]) : undefined,
      features: []
    }
  };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("DeepSeek response was not a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function normalizeAgentAction(action: AgentAction, message: string): AgentAction {
  if (action.intent === "create_schedule_event") {
    const parsedPayload = scheduleEventActionPayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return parseLocalScheduleEvent(message);
    }

    return {
      ...action,
      requires_confirmation: true,
      payload: {
        ...parsedPayload.data,
        source_payload: {
          ...(parsedPayload.data.source_payload ?? {}),
          original_message: message
        }
      }
    };
  }

  if (
    action.intent === "list_leads" ||
    action.intent === "draft_lead_reply" ||
    action.intent === "update_lead_status"
  ) {
    const parsedPayload = leadOperationPayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      if (action.intent === "update_lead_status") {
        return parseLocalLeadStatusUpdate(message);
      }

      if (action.intent === "draft_lead_reply") {
        return parseLocalLeadReplyRequest(message);
      }

      return parseLocalLeadQuery(message);
    }

    return {
      ...action,
      requires_confirmation: action.intent === "update_lead_status",
      payload: parsedPayload.data
    };
  }

  if (action.intent !== "create_listing_draft") {
    return action;
  }

  const parsedPayload = listingDraftPayloadSchema.safeParse(action.payload);
  if (!parsedPayload.success) {
    return parseLocalListingDraft(message);
  }

  return {
    ...action,
    requires_confirmation: true,
    payload: {
      ...parsedPayload.data,
      price_currency: parsedPayload.data.price_currency ?? "PKR",
      features: parsedPayload.data.features ?? []
    }
  };
}

function parseLocalAgentAction(message: string): AgentAction {
  const intent = classifyLocalIntent(message);

  switch (intent) {
    case "lead_reply":
      return parseLocalLeadReplyRequest(message);
    case "lead_status_update":
      return parseLocalLeadStatusUpdate(message);
    case "schedule_event":
      return parseLocalScheduleEvent(message);
    case "lead_query":
      return parseLocalLeadQuery(message);
    case "promotion":
    case "listing_draft":
    default:
      return parseLocalListingDraft(message);
  }
}

export async function routeAgentMessage(message: string): Promise<AgentAction> {
  if (!env.deepseekApiKey) {
    return parseLocalAgentAction(message);
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
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Current date in Pakistan: ${new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Karachi"
            })}\n\nUser message: ${message}`
          }
        ]
      })
    });

    if (!response.ok) {
      return parseLocalAgentAction(message);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return parseLocalAgentAction(message);
    }

    const action = agentActionSchema.parse(JSON.parse(extractJsonObject(content)));

    return normalizeAgentAction(action, message);
  } catch {
    return parseLocalAgentAction(message);
  }
}
