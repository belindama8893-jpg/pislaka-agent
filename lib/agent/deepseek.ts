import { env, requireServerEnv } from "@/lib/env";
import {
  agentActionSchema,
  leadCreatePayloadSchema,
  leadDetailsUpdatePayloadSchema,
  leadListingUpdatePayloadSchema,
  leadOperationPayloadSchema,
  listingDraftPayloadSchema,
  listingUpdatePayloadSchema,
  scheduleEventActionPayloadSchema,
  scheduleEventListPayloadSchema,
  type AgentAction
} from "@/lib/agent/types";
import {
  classifyLocalIntent,
  extractLeadName,
  extractLeadStatus,
  extractLeadStatusFilter
} from "@/lib/agent/intent-router";
import {
  buildLocationEnhancedRoutingMessage,
  formatLocationContextForPrompt,
  stripLocationEnhancedRoutingContext,
  type PakistanLocationNormalizationResult
} from "@/lib/agent/location-normalization";
import {
  fromBrokerDatetimeLocal,
  getBrokerDayRange,
  getResolvedTimeZone,
  toBrokerDatetimeLocal
} from "@/lib/events/time";

const deepseekRequestTimeoutMs = 8000;

const systemPrompt = `
You are Pislaka Agent, an AI assistant for real estate brokers in Pakistan.
Return only JSON. Do not return markdown.

Your job:
- Understand English, Urdu, and Roman Urdu real estate requests.
- Convert user messages into structured workflow actions.
- Never claim a listing is saved, published, shared, or sent unless a backend tool result says so.
- High-risk actions must require user confirmation.
- For listing drafts, extract only facts present in the user message or obvious Pakistan real estate defaults.
- For listing updates, extract the target words into payload.query and only include fields the user explicitly changed.
- For schedule events, extract appointment/reminder/recurring details. Use ISO 8601 timestamps for the user's timezone when the user gives a clear date/time.
- If the user says today/tomorrow/next week, interpret it from the current date and timezone provided by the user message context.
- Convert prices into numeric PKR. Examples: 8.5 crore = 85000000, 2 lakh = 200000.
- Normalize area units to kanal, marla, sqft, or sqm.
- Use short practical English in response text.
- If a required listing detail is missing, still return a draft with known fields and mention what is missing in response.

Supported intents:
- create_listing_draft
- create_lead
- update_listing_draft
- publish_listing
- create_campaign_links
- list_leads
- draft_lead_reply
- create_schedule_event
- list_schedule_events
- update_lead_status
- update_lead_details
- update_lead_listing
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

Listing update output shape:
{
  "intent": "update_listing_draft",
  "requires_confirmation": true,
  "response": "I found a listing edit request. Please confirm before I update the listing.",
  "payload": {
    "query": "this listing DHA Phase 5 10 marla villa",
    "price_amount": 12000000,
    "bedrooms": 4,
    "status": "published"
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

Schedule query output shape:
{
  "intent": "list_schedule_events",
  "requires_confirmation": false,
  "response": "Here are your schedule items.",
  "payload": {
    "date_filter": "today",
    "status": "scheduled",
    "event_type": "all",
    "limit": 10
  }
}

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

Lead creation output shape:
{
  "intent": "create_lead",
  "requires_confirmation": true,
  "response": "I prepared a new lead. Please confirm before I save it.",
  "payload": {
    "full_name": "Ahmed Khan",
    "phone": "03001234567",
    "email": "ahmed@example.com",
    "message": "Wants a 10 marla house in DHA Phase 5",
    "status": "new",
    "urgency": "normal",
    "source_channel": "manual"
  }
}

Lead-listing relation update output shape:
{
  "intent": "update_lead_listing",
  "requires_confirmation": true,
  "response": "I prepared a lead listing change. Please confirm before I update the lead.",
  "payload": {
    "lead_name": "Ahmed",
    "listing_query": "DHA Phase 6 10 marla house",
    "query": "Move Ahmed to the DHA Phase 6 house"
  }
}

Lead rules:
- Use create_lead when the user asks to add, create, record, or save a lead/customer/buyer.
- Use update_lead_listing when the user asks to link, attach, associate, move, change, or assign a lead/customer/buyer to a listing/property.
- Use list_leads when the user asks who/which leads/customers/buyers to follow up, new leads, hot leads, or today's leads.
- Use draft_lead_reply when the user asks to reply to a lead/customer/buyer.
- Use update_lead_status when the user asks to mark/change/update a lead status.
- Use update_lead_details when the user asks to edit a lead's phone, email, name, or message.
- If the user says hot lead, set status to qualified and urgency to high.
- Never update a lead without confirmation.
- Never update lead contact details without confirmation.
- Use update_listing_draft when the user asks to change/edit/update/correct an existing listing or this/current listing.
- Never save listing edits without confirmation.

Rules:
- Return only one JSON object.
- Do not include null values. Omit unknown fields.
- Do not include markdown fences.
`;

function getUserTimeZoneDate(offsetDays: number, hour = 10, timeZone?: string | null) {
  const range = getBrokerDayRange(offsetDays, 0, timeZone);
  const date = toBrokerDatetimeLocal(range.from, timeZone).slice(0, 10);
  return fromBrokerDatetimeLocal(`${date}T${String(hour).padStart(2, "0")}:00`, timeZone);
}

function addHours(isoDate: string, hours: number) {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function addMinutes(isoDate: string, minutes: number) {
  const date = new Date(isoDate);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
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

function extractEmail(message: string) {
  return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
}

function extractPhone(message: string) {
  const match =
    message.match(/(?:phone|mobile|number|contact|电话|手机号|号码)[^+\d]*(\+?\d[\d\s().-]{5,}\d)/i) ??
    message.match(/(\+?\d[\d\s().-]{7,}\d)/);

  return match?.[1]?.replace(/[^\d+]/g, "");
}

function parseLocalLeadCreate(message: string): AgentAction {
  const phone = extractPhone(message);
  const email = extractEmail(message);
  const explicitName =
    message.match(/(?:named|called|name is|客户|线索|买家|客户叫|名字是)\s*([\p{L}\p{N}][\p{L}\p{N} .'’-]{1,60})/iu)?.[1]?.trim() ??
    message.match(/\b(?:add|create|record|save|new)\s+(?:a\s+)?(?:lead|customer|buyer|client)?\s*([\p{L}][\p{L} .'’-]{1,50})/iu)?.[1]?.trim();
  const status = /hot|高意向|强意向/i.test(message)
    ? ({ status: "qualified" as const, urgency: "high" as const })
    : ({ status: "new" as const, urgency: "normal" as const });

  return {
    intent: "create_lead",
    requires_confirmation: true,
    response: "I prepared a new lead. Please confirm before I save it.",
    payload: {
      full_name: explicitName,
      phone,
      email,
      message,
      source_channel: "manual",
      ...status
    }
  };
}

function parseLocalLeadListingUpdate(message: string): AgentAction {
  return {
    intent: "update_lead_listing",
    requires_confirmation: true,
    response: "I prepared a lead listing change. Please confirm before I update the lead.",
    payload: {
      lead_name: extractLeadName(message),
      listing_query: message,
      query: message
    }
  };
}

function extractLeadDetailsUpdate(message: string) {
  const payload: Record<string, unknown> = {
    lead_name: extractLeadName(message),
    query: message
  };
  const emailMatch = extractEmail(message);
  const phoneMatch =
    message.match(/(?:phone|mobile|number|contact|电话|手机号|号码)[^+\d]*(\+?\d[\d\s().-]{5,}\d)/i) ??
    message.match(/(?:to|=|改成|设为|更新为)\s*(\+?\d[\d\s().-]{5,}\d)/i);
  const nameMatch =
    message.match(/(?:name|buyer name|client name|姓名|名字)[^,.，。]*(?:to|=|改成|设为|更新为)\s*([\p{L}\p{N}][\p{L}\p{N} .'’-]{1,60})/iu) ??
    message.match(/(?:rename|重命名为)\s*([\p{L}\p{N}][\p{L}\p{N} .'’-]{1,60})/iu);

  if (phoneMatch) {
    payload.phone = phoneMatch[1].replace(/[^\d+]/g, "");
  }

  if (emailMatch) {
    payload.email = emailMatch;
  }

  if (nameMatch) {
    payload.full_name = nameMatch[1].trim();
  }

  return payload;
}

function parseLocalLeadDetailsUpdate(message: string): AgentAction {
  return {
    intent: "update_lead_details",
    requires_confirmation: true,
    response: "I prepared a lead details update. Please confirm before I change the contact record.",
    payload: extractLeadDetailsUpdate(message)
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

function parseLocalPromotionRequest(message: string): AgentAction {
  return {
    intent: "create_campaign_links",
    requires_confirmation: true,
    response: "Tell me which confirmed listing you want to promote, or refer to the current listing if one is open.",
    payload: {
      query: message
    }
  };
}

function parseLocalListingUpdate(message: string): AgentAction {
  const lower = message.toLowerCase();
  const croreMatches = Array.from(lower.matchAll(/(\d+(?:\.\d+)?)\s*(?:crore|cr|karor)/g));
  const lakhMatches = Array.from(lower.matchAll(/(\d+(?:\.\d+)?)\s*lakh/g));
  const croreMatch = croreMatches.at(-1);
  const lakhMatch = lakhMatches.at(-1);
  const areaChangeMatch =
    lower.match(/(?:area|size|面积)[^,.，。]*(\d+(?:\.\d+)?)\s*(kanal|marla|sqft|sqm)/) ??
    lower.match(/(?:to|make|set|change|update|adjust|改成|改为|改到|换成|设为|设成|成|为)\s*(\d+(?:\.\d+)?)\s*(kanal|marla|sqft|sqm)/);
  const bedChangeMatch =
    lower.match(/(?:bed|beds|bedroom|bedrooms|卧室)[^,.，。]*(?:to|=|改成|改为|设为|设成|成|为)\s*(\d+)/) ??
    lower.match(/(?:to|make|set|改成|改为|设为|设成|成|为)\s*(\d+)\s*(?:bed|beds|bedroom|bedrooms|卧室)/);
  const bathChangeMatch =
    lower.match(/(?:bath|baths|bathroom|bathrooms|卫生间)[^,.，。]*(?:to|=|改成|改为|设为|设成|成|为)\s*(\d+)/) ??
    lower.match(/(?:to|make|set|改成|改为|设为|设成|成|为)\s*(\d+)\s*(?:bath|baths|bathroom|bathrooms|卫生间)/);
  const payload: Record<string, unknown> = {
    query: message
  };

  if (croreMatch) {
    payload.price_amount = Math.round(Number(croreMatch[1]) * 10000000);
  } else if (lakhMatch) {
    payload.price_amount = Math.round(Number(lakhMatch[1]) * 100000);
  }

  if (areaChangeMatch) {
    payload.area_value = Number(areaChangeMatch[1]);
    payload.area_unit = areaChangeMatch[2];
  }

  if (bedChangeMatch) {
    payload.bedrooms = Number(bedChangeMatch[1]);
  }

  if (bathChangeMatch) {
    payload.bathrooms = Number(bathChangeMatch[1]);
  }

  if (/\b(?:to|make|set|change|update|改成|设为|成|为)\b[^,.，。]*(?:rent|rental|lease)\b|改成出租|设为出租/u.test(lower)) {
    payload.listing_type = "rent";
  } else if (/\b(?:to|make|set|change|update|改成|设为|成|为)\b[^,.，。]*(?:sale|sell)\b|改成出售|设为出售/u.test(lower)) {
    payload.listing_type = "sale";
  }

  if (/\bpublish|published\b|发布/u.test(message)) {
    payload.status = "published";
  } else if (/\bdraft\b|草稿/u.test(message)) {
    payload.status = "draft";
  } else if (/\barchive|archived\b|归档/u.test(message)) {
    payload.status = "archived";
  }

  return {
    intent: "update_listing_draft",
    requires_confirmation: true,
    response: "I prepared a listing update preview. Please confirm before I change the listing.",
    payload
  };
}

function parseLocalGeneralReply(message: string): AgentAction {
  return {
    intent: "general_reply",
    requires_confirmation: false,
    response:
      "I can help with listing drafts, lead follow-ups, promotion copy, and viewing schedules. Tell me the property, buyer, or task you want to handle.",
    payload: {
      query: message
    }
  };
}

function extractScheduleTime(message: string, timeZone?: string | null) {
  const lower = message.toLowerCase();
  const relativeMatch =
    lower.match(/\bin\s+(\d{1,3})\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/) ??
    message.match(/(\d{1,3})\s*(分钟|分|小时|个小时)\s*后/u);

  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    if (Number.isFinite(amount) && amount > 0) {
      const minutes = /hour|hr|小时/u.test(unit) ? amount * 60 : amount;
      return addMinutes(new Date().toISOString(), minutes);
    }
  }

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/);
  let hour = 10;

  if (timeMatch) {
    hour = Number(timeMatch[1]);
    const meridiem = timeMatch[3]?.replace(/\./g, "");
    if (meridiem === "pm" && hour < 12) {
      hour += 12;
    }
    if (meridiem === "am" && hour === 12) {
      hour = 0;
    }
  } else if (/afternoon|下午/i.test(message)) {
    hour = 15;
  } else if (/evening|tonight|晚上/i.test(message)) {
    hour = 19;
  }

  if (/tomorrow|明天/i.test(message)) {
    return getUserTimeZoneDate(1, hour, timeZone);
  }

  if (/next week|下周/i.test(message)) {
    return getUserTimeZoneDate(7, hour, timeZone);
  }

  if (/today|tonight|今天|今晚/i.test(message)) {
    return getUserTimeZoneDate(0, hour, timeZone);
  }

  return undefined;
}

function parseLocalScheduleEvent(message: string, timeZone?: string | null): AgentAction {
  const lower = message.toLowerCase();
  const startAt = extractScheduleTime(message, timeZone);
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

function parseLocalScheduleQuery(message: string): AgentAction {
  const dateFilter = /tomorrow|明天/i.test(message)
    ? "tomorrow"
    : /week|本周|下周/i.test(message)
      ? "week"
      : /all|全部|所有/i.test(message)
        ? "all"
        : "today";
  const eventType = /viewing|visit|showing|看房/i.test(message)
    ? "viewing"
    : /follow|跟进|回访/i.test(message)
      ? "follow_up"
      : /contract|sign|合同|签约/i.test(message)
        ? "contract_signing"
        : /handover|delivery|交房/i.test(message)
          ? "handover"
          : "all";

  return {
    intent: "list_schedule_events",
    requires_confirmation: false,
    response: "Here are your schedule items.",
    payload: {
      date_filter: dateFilter,
      status: "scheduled",
      event_type: eventType,
      limit: 10
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

function shouldNormalizeScheduleAsFollowUp(message: string) {
  const hasCommunicationCue = /\b(call|callback|call back|phone|ring|follow[-\s]?up|follow up)\b|打电话|电话|回电|跟进|回访/i.test(
    message
  );
  const hasAppointmentCue = /viewing|visit|showing|appointment|看房|预约看房|带看|参观|contract|sign|handover|签约|合同|交房/i.test(
    message
  );

  return hasCommunicationCue && !hasAppointmentCue;
}

function normalizeAgentAction(action: AgentAction, message: string, context?: AgentRoutingContext): AgentAction {
  if (action.intent === "list_schedule_events") {
    const parsedPayload = scheduleEventListPayloadSchema.safeParse(action.payload);

    return {
      ...action,
      requires_confirmation: false,
      payload: parsedPayload.success ? parsedPayload.data : parseLocalScheduleQuery(message).payload
    };
  }

  if (action.intent === "create_schedule_event") {
    const parsedPayload = scheduleEventActionPayloadSchema.safeParse(action.payload);
    if (!parsedPayload.success) {
      return parseLocalScheduleEvent(message, context?.timeZone);
    }
    const normalizedPayload = shouldNormalizeScheduleAsFollowUp(message)
      ? {
          ...parsedPayload.data,
          event_category: "reminder" as const,
          event_type: "follow_up" as const,
          start_at: undefined,
          end_at: undefined
        }
      : parsedPayload.data;

    return {
      ...action,
      requires_confirmation: true,
      payload: {
        ...normalizedPayload,
        source_payload: {
          ...(normalizedPayload.source_payload ?? {}),
          original_message: message
        }
      }
    };
  }

  if (
    action.intent === "create_lead" ||
    action.intent === "list_leads" ||
    action.intent === "draft_lead_reply" ||
    action.intent === "update_lead_status" ||
    action.intent === "update_lead_details" ||
    action.intent === "update_lead_listing"
  ) {
    if (action.intent === "update_lead_listing") {
      const parsedPayload = leadListingUpdatePayloadSchema.safeParse(action.payload);
      if (!parsedPayload.success) {
        return parseLocalLeadListingUpdate(message);
      }

      return {
        ...action,
        requires_confirmation: true,
        payload: {
          ...parsedPayload.data,
          query: parsedPayload.data.query ?? message,
          listing_query: parsedPayload.data.listing_query ?? message
        }
      };
    }

    if (action.intent === "create_lead") {
      const parsedPayload = leadCreatePayloadSchema.safeParse(action.payload);
      if (!parsedPayload.success) {
        return parseLocalLeadCreate(message);
      }

      return {
        ...action,
        requires_confirmation: true,
        payload: {
          ...parsedPayload.data,
          source_channel: parsedPayload.data.source_channel ?? "manual"
        }
      };
    }

    if (action.intent === "update_lead_details") {
      const parsedPayload = leadDetailsUpdatePayloadSchema.safeParse(action.payload);
      if (!parsedPayload.success) {
        return parseLocalLeadDetailsUpdate(message);
      }

      return {
        ...action,
        requires_confirmation: true,
        payload: {
          ...parsedPayload.data,
          query: parsedPayload.data.query ?? message
        }
      };
    }

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
    if (action.intent === "update_listing_draft") {
      const parsedPayload = listingUpdatePayloadSchema.safeParse(action.payload);
      if (!parsedPayload.success) {
        return parseLocalListingUpdate(message);
      }

      return {
        ...action,
        requires_confirmation: true,
        payload: {
          ...parsedPayload.data,
          query: parsedPayload.data.query ?? message,
          price_currency: parsedPayload.data.price_currency ?? undefined,
          features: parsedPayload.data.features ?? undefined
        }
      };
    }

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

function stripInternalLocationContextFromPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return stripLocationEnhancedRoutingContext(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripInternalLocationContextFromPayload(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stripInternalLocationContextFromPayload(item)])
    );
  }

  return value;
}

function stripInternalLocationContextFromAction(action: AgentAction): AgentAction {
  return {
    ...action,
    response: stripLocationEnhancedRoutingContext(action.response),
    payload: stripInternalLocationContextFromPayload(action.payload) as Record<string, unknown>
  };
}

function parseLocalAgentAction(message: string, context?: AgentRoutingContext): AgentAction {
  const intent = classifyLocalIntent(message);

  switch (intent) {
    case "lead_create":
      return parseLocalLeadCreate(message);
    case "lead_reply":
      return parseLocalLeadReplyRequest(message);
    case "lead_details_update":
      return parseLocalLeadDetailsUpdate(message);
    case "lead_listing_update":
      return parseLocalLeadListingUpdate(message);
    case "lead_status_update":
      return parseLocalLeadStatusUpdate(message);
    case "schedule_event":
      return parseLocalScheduleEvent(message, context?.timeZone);
    case "schedule_query":
      return parseLocalScheduleQuery(message);
    case "lead_query":
      return parseLocalLeadQuery(message);
    case "promotion":
      return parseLocalPromotionRequest(message);
    case "listing_update":
      return parseLocalListingUpdate(message);
    case "listing_draft":
      return parseLocalListingDraft(message);
    case "general_reply":
    default:
      return parseLocalGeneralReply(message);
  }
}

type AgentRoutingContext = {
  timeZone?: string;
  locationContext?: PakistanLocationNormalizationResult;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

function formatRecentContext(context?: AgentRoutingContext) {
  const recentMessages = context?.recentMessages?.filter((item) => item.content.trim()).slice(-20) ?? [];

  if (!recentMessages.length) {
    return "No prior chat context.";
  }

  return recentMessages
    .map((item) => `${item.role === "user" ? "Broker" : "Assistant"}: ${item.content.slice(0, 500)}`)
    .join("\n");
}

export async function routeAgentMessage(message: string, context?: AgentRoutingContext): Promise<AgentAction> {
  const routingMessage = buildLocationEnhancedRoutingMessage(message, context?.locationContext);
  const localIntent = classifyLocalIntent(routingMessage);

  if (
    localIntent === "listing_draft" ||
    localIntent === "listing_update" ||
    localIntent === "lead_details_update"
  ) {
    return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
  }

  if (!env.deepseekApiKey) {
    return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
  }

  const apiKey = requireServerEnv("deepseekApiKey");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deepseekRequestTimeoutMs);

  try {
    const response = await fetch(`${env.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
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
            content: `User time zone: ${getResolvedTimeZone(context?.timeZone)}\nCurrent date in user time zone: ${new Date().toLocaleDateString("en-CA", {
              timeZone: getResolvedTimeZone(context?.timeZone)
            })}\n\nVerified Pakistan real estate location terms from the hierarchy API. Use these only to normalize location names and improve entity extraction; do not treat them as saved listings or leads:\n${formatLocationContextForPrompt(
              context?.locationContext
            )}\n\nRecent chat context for short-term reference only. Do not treat chat text as confirmed business facts unless the target is resolved through database-backed APIs:\n${formatRecentContext(
              context
            )}\n\nUser message: ${message}`
          }
        ]
      })
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
    }

    const action = agentActionSchema.parse(JSON.parse(extractJsonObject(content)));
    const normalizedAction = normalizeAgentAction(action, routingMessage, context);

    if (normalizedAction.intent === "general_reply" && localIntent !== "general_reply") {
      return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
    }

    if (localIntent === "promotion" && normalizedAction.intent !== "create_campaign_links") {
      return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
    }

    return stripInternalLocationContextFromAction(normalizedAction);
  } catch {
    return stripInternalLocationContextFromAction(parseLocalAgentAction(routingMessage, context));
  } finally {
    clearTimeout(timeout);
  }
}
