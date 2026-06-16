import { env, requireServerEnv } from "@/lib/env";
import { applyAgentActionPolicy, requiresConfirmationForAgentAction } from "@/lib/agent/confirmation-policy";
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
  extractLeadStatusFilter,
  isTodayFollowUpsRequest,
  isPromotionRequest
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
import { getListingImportUrl, importListingDraftFromUrl } from "@/lib/listings/import-from-url";
import { formatScheduleQueryResponse, localizeAgentActionResponse } from "@/lib/agent/response-language";
import {
  formatRoutingRulesForPrompt,
  formatSemanticRoutingRulesForPrompt,
  formatSupportedIntentsForPrompt,
  formatWorkflowRulesForPrompt
} from "@/lib/agent/registry/prompt";
import {
  formatAgentMemoryForPrompt,
  getAgentMemoryRecentMessages,
  type AgentMemoryRuntimeContext
} from "@/lib/agent/memory";
import { applySemanticRouteConfidenceGate } from "@/lib/agent/semantic-routing";
import { buildFallbackSocialCopyPromotion, generateSocialCopyPromotion } from "@/lib/agent/social-copy";

const deepseekRequestTimeoutMs = 8000;
const supportedIntentsPrompt = formatSupportedIntentsForPrompt();
const routingRulesPrompt = formatRoutingRulesForPrompt();
const semanticRoutingRulesPrompt = formatSemanticRoutingRulesForPrompt();
const workflowRulesPrompt = formatWorkflowRulesForPrompt();

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
- Use the same language/script as the broker's latest message in response text. If the broker uses Urdu script, reply in Urdu script. If the broker uses Roman Urdu, reply in Roman Urdu. If the broker uses English, reply in English.
- If a required listing detail is missing, still return a draft with known fields and mention what is missing in response.
- If the broker message is unclear or does not contain enough evidence for a workflow, return general_reply with a short understanding of the input and one concise follow-up question. Do not force a schedule, listing, lead, or campaign card from weak evidence.

Supported intents:
${supportedIntentsPrompt}

Routing rules:
${routingRulesPrompt}
- Do not use publish_listing for external channels.

Semantic routing output:
${semanticRoutingRulesPrompt}

Every output shape may include these routing metadata fields:
{
  "confidence": 0.92,
  "alternative_intents": [
    {
      "intent": "generate_social_copy",
      "confidence": 0.46,
      "reason": "The broker mentioned a channel, but asked for promotion links rather than copy."
    }
  ],
  "missing_slots": ["listing target"],
  "is_follow_up_to_workflow": true,
  "route_reason": "The broker said this listing and WhatsApp while the active workflow is awaiting listing promotion confirmation."
}

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

Follow-up record output shape:
{
  "intent": "record_lead_followup",
  "requires_confirmation": true,
  "response": "I found a follow-up update. Please confirm before I update the lead record.",
  "payload": {
    "lead_name": "Ahmed",
    "activity_type": "message_sent",
    "status": "contacted",
    "summary": "Sent WhatsApp message to Ahmed"
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

Workflow rules:
${workflowRulesPrompt}

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

function parseLocalTodayFollowUps(message: string): AgentAction {
  return {
    intent: "list_today_followups",
    requires_confirmation: false,
    response: "Here are the leads that need follow-up today.",
    payload: {
      query: message,
      status_filter: "all"
    }
  };
}

function parseLocalLeadFollowUpRecord(message: string): AgentAction {
  const leadName = extractLeadName(message);
  const status = extractLeadStatus(message);
  const isNotInterested = /not interested|said no|不感兴趣|没兴趣/i.test(message);
  const isInterested = /interested|seems hot|hot|有兴趣|高意向/i.test(message) && !isNotInterested;
  const isSent = /sent (?:the )?(?:message|whatsapp)|message sent|mark .*contacted|contacted|已发送|已经联系/i.test(
    message
  );
  const activityType = isSent ? "message_sent" : "status_changed";
  const mappedStatus = isNotInterested
    ? ({ status: "lost" as const })
    : isInterested
      ? ({ status: "qualified" as const, urgency: "high" as const })
      : status;

  return {
    intent: "record_lead_followup",
    requires_confirmation: activityType === "status_changed",
    response:
      activityType === "message_sent"
        ? "I found a sent-message follow-up. Click Sent to record it."
        : "I prepared a lead status follow-up. Please confirm before I update the lead record.",
    payload: {
      lead_name: leadName,
      activity_type: activityType,
      summary: message,
      query: message,
      ...mappedStatus
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
  const leadTargetMatch = message.match(
    /\b(?:lead|customer|client|buyer)\s+([\p{L}][\p{L} .'’-]{1,50}?)(?=\s+(?:phone|mobile|number|contact|email|mail|name|message|note)\b|$)/iu
  );
  const payload: Record<string, unknown> = {
    lead_name: leadTargetMatch?.[1]?.trim() ?? extractLeadName(message),
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

function extractAnalyticsRange(message: string) {
  if (/today|aaj|今天|今日/i.test(message)) {
    return "today";
  }

  if (/month|30 days|本月|这个月|近30天/i.test(message)) {
    return "month";
  }

  if (/all time|overall|全部|所有|历史/i.test(message)) {
    return "all";
  }

  return "week";
}

function extractAnalyticsFocus(message: string) {
  if (/channel|whatsapp|facebook|instagram|portal|渠道/i.test(message)) {
    return "channels";
  }

  if (/listing|property|房源|房子/i.test(message)) {
    return "listings";
  }

  if (/follow|reply|跟进|回复/i.test(message)) {
    return "followups";
  }

  return "overview";
}

function parseLocalAnalyticsRequest(message: string): AgentAction {
  return {
    intent: "show_basic_attribution",
    requires_confirmation: false,
    response: "Here is the latest performance summary from your workspace.",
    payload: {
      query: message,
      range: extractAnalyticsRange(message),
      focus: extractAnalyticsFocus(message)
    }
  };
}

function extractPromotionChannelsFromMessage(message: string) {
  const normalized = message.toLowerCase();
  const channels: Array<"whatsapp" | "facebook" | "instagram" | "portal"> = [];

  if (/\bwhats\s*app\b|\bwhatsapp\b|\bwa\b/.test(normalized)) {
    channels.push("whatsapp");
  }
  if (/\bfacebook\b|\bfb\b/.test(normalized)) {
    channels.push("facebook");
  }
  if (/\binstagram\b|\binsta\b|\big\b/.test(normalized)) {
    channels.push("instagram");
  }
  if (/\bportal\b|\bzameen\b|\bolx\b|\bwebsite\b/.test(normalized)) {
    channels.push("portal");
  }

  return channels.length ? channels : (["whatsapp"] as const);
}

function isTrackableCampaignLinkRequest(message: string) {
  return /\b(?:trackable|tracking|campaign\s*link|lead\s*page|landing\s*page|link|links|url|generate\s+link|专属链接|推广链接|追踪|落地页|线索页)\b/i.test(
    message
  );
}

function isSocialCopyRequest(message: string) {
  const channelCopyCue =
    /\b(?:promote|share|post|advertise)\b[\s\S]{0,80}\b(?:whats\s*app|whatsapp|wa|facebook|fb|instagram|insta|ig|portal)\b/i.test(
      message
    ) ||
    /\b(?:whats\s*app|whatsapp|wa|facebook|fb|instagram|insta|ig|portal)\b[\s\S]{0,80}\b(?:promote|share|post|advertise)\b/i.test(
      message
    ) ||
    /(?:推广|宣传|发布)[\s\S]{0,30}(?:WhatsApp|Facebook|Instagram|文案|帖子|内容)/iu.test(message);

  return (
    (!isTrackableCampaignLinkRequest(message) && channelCopyCue) ||
    /\b(?:write|draft|create|generate|prepare|make)\b[\s\S]{0,60}\b(?:copy|caption|post|text|content|message)\b/i.test(
      message
    ) ||
    /\b(?:facebook|fb|instagram|insta|ig|whats\s*app|whatsapp|wa|portal)\b[\s\S]{0,50}\b(?:copy|caption|post|text|content|message|文案|帖子)\b/i.test(
      message
    ) ||
    /(?:写|生成|起草|准备)[\s\S]{0,20}(?:推广)?(?:文案|帖子|内容)/u.test(message)
  );
}

function getLatestSocialCopyEvidenceContext(context?: AgentRoutingContext) {
  const recentMessages = getRoutingRecentMessages(context).slice().reverse();
  const evidence = recentMessages.find(
    (item) =>
      item.role === "assistant" &&
      /(?:I can see:|Property details:|Location:|Floor plan|Map showing|房源信息|位置)/i.test(item.content)
  );

  return [context?.memory?.workflow?.summary, evidence?.content].filter(Boolean).join("\n");
}

function extractPromotionFacts(message: string, context?: AgentRoutingContext) {
  const visibleMessage = stripUploadedImageEvidence(message).replace(/^Attached \d+ listing media file[s]?\.\s*/i, "").trim();
  const contextText = getLatestSocialCopyEvidenceContext(context) ?? "";
  const combined = `${message}\n${contextText}`;
  const summaries = uniqueTextValues([
    ...getInternalVisionLines(message, "summary"),
    extractBetween(contextText, /I can see:\s*/i, /(?:\s+This looks|\s+This may|\s+Should I|$)/i)
  ]);
  const location =
    cleanLocationText(getInternalVisionLine(message, "location")) ??
    cleanLocationText(extractBetween(contextText, /Location:\s*/i, /(?:\.\s+Property details:|\.\s+This|\.\s+Should|$)/i));
  const propertyText =
    extractBetween(contextText, /Property details:\s*/i, /(?:\.\s+This|\.\s+Should|$)/i) ??
    "";
  const propertyType = getInternalVisionLine(message, "property type") ?? combined.match(/\b(apartment|flat|house|villa|plot|commercial|shop)\b/i)?.[1];
  const rawListingType =
    getInternalVisionLine(message, "listing type") ??
    (/\bfor[_\s-]?sale|sale|sell\b/i.test(combined) ? "sale" : /\brent|rental|lease\b/i.test(combined) ? "rent" : undefined);
  const listingType = rawListingType?.replace(/^for[_\s-]?/i, "").toLowerCase();
  const price = getInternalVisionLine(message, "price") ?? combined.match(/\bPKR\s*[\d,]+(?:\.\d+)?(?:\s*(?:crore|lakh))?\b/i)?.[0];
  const size = getInternalVisionLine(message, "size") ?? (combined.match(/\b(\d+(?:\.\d+)?)\s*(?:sqft|sq\.?\s*ft|square\s*feet|marla|kanal)\b/i)?.[0]);
  const bedrooms = getInternalVisionLine(message, "bedrooms") ?? combined.match(/\b(\d+)\s*(?:bed|beds|bedroom|bedrooms)\b/i)?.[1];
  const bathrooms = getInternalVisionLine(message, "bathrooms") ?? combined.match(/\b(\d+)\s*(?:bath|baths|bathroom|bathrooms)\b/i)?.[1];
  const featureCandidates = ["balcony", "TV lounge", "dining area", "dining", "kitchen", "laundry", "near Wafaqi Colony", "near PIA Housing Society"];
  const features = uniqueTextValues(
    featureCandidates
      .filter((feature) => new RegExp(feature.replace(/\s+/g, "\\s+"), "i").test(combined))
      .map((feature) => (feature === "dining" ? "dining area" : feature))
  );
  const nearbyAreas = uniqueTextValues(
    ["Wafaqi Colony", "PIA Housing Society"].filter((area) => new RegExp(area.replace(/\s+/g, "\\s+"), "i").test(combined))
  );
  const facts = uniqueTextValues([
    location ? `Location: ${location}` : "",
    size,
    propertyType,
    listingType,
    bedrooms ? `${bedrooms} bedrooms` : "",
    bathrooms ? `${bathrooms} bathrooms` : "",
    price ? `Price: ${price}` : "",
    features.length ? `Features: ${features.join(", ")}` : ""
  ]);
  const sourceNotes = uniqueTextValues([
    ...summaries,
    propertyText,
    visibleMessage && !isSocialCopyRequest(visibleMessage) ? visibleMessage : ""
  ]);

  return {
    text: facts.length ? facts.join(" | ") : "Property details from the broker's message.",
    sourceNotes,
    location,
    propertyType,
    listingType,
    size,
    bedrooms,
    bathrooms,
    features,
    nearbyAreas
  };
}

type PromotionFacts = ReturnType<typeof extractPromotionFacts>;

function parsePromotionPriceAmount(price: string | undefined) {
  if (!price) {
    return undefined;
  }

  const amountMatch = price.match(/(?:PKR\s*)?([\d,]+(?:\.\d+)?)/i);
  if (!amountMatch) {
    return undefined;
  }

  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return undefined;
  }

  if (/\bcrore\b/i.test(price)) {
    return amount * 10000000;
  }

  if (/\blakh\b/i.test(price)) {
    return amount * 100000;
  }

  return amount;
}

function promotionFactsToSocialCopyInput(facts: PromotionFacts) {
  const price = facts.text.match(/Price:\s*([^|]+)/i)?.[1]?.trim();
  const normalizedPrice = formatPromotionPriceLabel(price);
  const locationParts = facts.location?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  const city = locationParts.at(-1) ?? (facts.location ? undefined : "Lahore");
  const locationArea = locationParts.length > 1 ? locationParts.slice(0, -1).join(", ") : facts.location;
  const areaMatch = facts.size?.match(/^(\d+(?:\.\d+)?)\s*(kanal|marla|sqft|sqm)\b/i);

  return {
    title: [facts.size, facts.propertyType, facts.location].filter(Boolean).join(" ") || undefined,
    city,
    location_area: locationArea,
    property_type: facts.propertyType,
    listing_type: facts.listingType,
    price_amount: parsePromotionPriceAmount(price),
    price_label: normalizedPrice,
    price_currency: "PKR",
    area_value: areaMatch ? Number(areaMatch[1]) : undefined,
    area_unit: areaMatch ? areaMatch[2].toLowerCase() : undefined,
    bedrooms: facts.bedrooms,
    bathrooms: facts.bathrooms,
    features: facts.features,
    source_notes: facts.sourceNotes
  };
}

function formatPromotionPriceLabel(price: string | undefined) {
  if (!price) {
    return undefined;
  }

  const numericMatch = price.match(/PKR\s*([\d,]+(?:\.\d+)?)/i);
  if (!numericMatch) {
    return price;
  }

  const amount = Number(numericMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) {
    return price;
  }

  const crore = amount / 10000000;
  if (crore >= 1) {
    return `PKR ${Number(crore.toFixed(2)).toString()} Crore`;
  }

  const lakh = amount / 100000;
  if (lakh >= 1) {
    return `PKR ${Number(lakh.toFixed(2)).toString()} Lakh`;
  }

  return `PKR ${amount.toLocaleString("en-US")}`;
}

async function parseLocalSocialCopyRequest(message: string, context?: AgentRoutingContext): Promise<AgentAction> {
  const channels = extractPromotionChannelsFromMessage(message);
  const facts = extractPromotionFacts(message, context);
  const promotion = await generateSocialCopyPromotion(promotionFactsToSocialCopyInput(facts), message, [...channels]);
  const optionCount = promotion.cards.length;

  return {
    intent: "generate_social_copy",
    requires_confirmation: false,
    response: `I drafted ${optionCount > 1 ? `${optionCount} copy options` : "social media copy"} from the available details.`,
    payload: {
      query: stripUploadedImageEvidence(message),
      channels,
      promotion
    }
  };
}

function parseLocalPromotionRequest(message: string, context?: AgentRoutingContext): AgentAction {
  if (isSocialCopyRequest(message) && !isTrackableCampaignLinkRequest(message)) {
    const channels = extractPromotionChannelsFromMessage(message);
    const facts = extractPromotionFacts(message, context);
    const promotion = buildFallbackSocialCopyPromotion(promotionFactsToSocialCopyInput(facts), [...channels], message);

    return {
      intent: "generate_social_copy",
      requires_confirmation: false,
      response: `I drafted ${promotion.cards.length > 1 ? `${promotion.cards.length} copy options` : "social media copy"} from the available details.`,
      payload: {
        query: stripUploadedImageEvidence(message),
        channels,
        promotion
      }
    };
  }

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
  const visibleMessage = stripUploadedImageEvidence(message).replace(/^Attached \d+ listing media file[s]?\.\s*/i, "").trim();
  const response = visibleMessage
    ? `I understand this as a general request, but I need one more detail before choosing a workflow. Do you want me to draft a listing, find leads, prepare a reply, schedule a viewing, or just analyze it?`
    : "I reviewed what you shared, but I need one more clue before choosing a workflow. Do you want me to draft a listing, find leads, prepare a reply, schedule a viewing, or just analyze it?";

  return {
    intent: "general_reply",
    requires_confirmation: false,
    response,
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

  const timeMatch =
    lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/) ??
    lower.match(/\b(?:at|around|by)\s+(\d{1,2})(?::(\d{2}))?\b/) ??
    message.match(/(\d{1,2})(?::(\d{2}))?\s*(点|時|时)/u);
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

function stripUploadedImageEvidence(message: string) {
  const markers = [
    "Uploaded image evidence (internal).",
    "Image analysis from uploaded media.",
    "\n\nUploaded image evidence (internal).",
    "\n\nImage analysis from uploaded media."
  ];

  for (const marker of markers) {
    const index = message.indexOf(marker);
    if (index !== -1) {
      return message.slice(0, index).trim();
    }
  }

  return message.trim();
}

function getInternalVisionLine(message: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = message.match(new RegExp(`- ${escapedLabel}:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function getInternalVisionLines(message: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(message.matchAll(new RegExp(`- ${escapedLabel}:\\s*([^\\n]+)`, "gi")))
    .map((match) => match[1]?.trim())
    .filter(Boolean);
}

function uniqueTextValues(values: Array<string | undefined>) {
  return values.filter(
    (value, index): value is string =>
      typeof value === "string" &&
      value.length > 0 &&
      values.findIndex((candidate) => candidate?.toLowerCase() === value.toLowerCase()) === index
  );
}

function hasUploadedImageEvidence(message: string) {
  return /Uploaded image evidence \(internal\)\./i.test(message);
}

function getVisibleImagePrompt(message: string) {
  return stripUploadedImageEvidence(message).replace(/^Attached \d+ listing media file[s]?\.\s*/i, "").trim();
}

function isReadOnlyImagePrompt(prompt: string) {
  if (!prompt) {
    return false;
  }

  return /^(?:where|where\?|where is this|what is this|which area|location|address|map|what does this say|summarize|analyze|explain|这是哪|这是哪里|哪里|哪儿|位置|地址|这是什么地方|这是什么|总结|分析|解释|看一下)\??$/i.test(
    prompt
  );
}

function hasExplicitWorkflowPrompt(prompt: string) {
  return /schedule|appointment|viewing|visit|showing|book|remind|create|add|save|draft|listing|lead|reply|promote|campaign|publish|post|share|安排|预约|看房|提醒|创建|新增|保存|草稿|房源|线索|回复|推广|发布/i.test(
    prompt
  );
}

function getLikelyImageNextStepQuestion(input: {
  imageType: string;
  visiblePrompt: string;
  request?: string;
  location?: string;
  hasPropertyDetails: boolean;
  hasVisiblePrompt: boolean;
}) {
  const { imageType, visiblePrompt, request, location, hasPropertyDetails, hasVisiblePrompt } = input;
  const promptOrRequest = [visiblePrompt, request].filter(Boolean).join(" ");

  if (isReadOnlyImagePrompt(visiblePrompt)) {
    if (/map_or_location/i.test(imageType) || /where|location|address|这是哪|哪里|哪儿|位置|地址/i.test(promptOrRequest)) {
      return {
        possibleIntent: "You likely want to identify the place in the image.",
        question: location
          ? "Do you want me to use this location to search listings/leads, or only keep it as a location note?"
          : "Should I help narrow down the location further, or use it for a property workflow?"
      };
    }

    return {
      possibleIntent: "You likely want a read-only explanation of the image.",
      question: "Do you want me to turn this into a listing, lead follow-up, schedule item, or just keep analyzing it?"
    };
  }

  if (/map_or_location/i.test(imageType)) {
    return {
      possibleIntent: "This looks like a location check.",
      question: "Do you want me to search around this area, attach it to a listing, or just identify the address?"
    };
  }

  if (/customer_chat/i.test(imageType)) {
    return {
      possibleIntent: "This may be a customer conversation to summarize or act on.",
      question: "Should I draft a reply, create/update a lead, or set a follow-up from this chat?"
    };
  }

  if (/property_listing_screenshot|property_photo/i.test(imageType)) {
    return {
      possibleIntent: hasPropertyDetails
        ? "This may be material for a listing draft or listing media."
        : "This may be listing media, but the business intent is not clear yet.",
      question: "Should I draft a listing from it, attach it as media, or check what details are missing?"
    };
  }

  if (/document_or_form/i.test(imageType)) {
    return {
      possibleIntent: "This may be a document or form that needs extraction or review.",
      question: "Do you want me to extract the key fields, draft a document, or just summarize it?"
    };
  }

  if (!hasVisiblePrompt) {
    return {
      possibleIntent: "You may want me to analyze this image and decide the next workflow.",
      question: "Should I turn it into a listing task, lead task, schedule task, or just summarize what is visible?"
    };
  }

  return {
    possibleIntent: "The next action is not clear enough to run a workflow yet.",
    question: "What would you like me to do with this image next?"
  };
}

function parseImageObservationReply(message: string): AgentAction | null {
  if (!hasUploadedImageEvidence(message)) {
    return null;
  }

  const visiblePrompt = getVisibleImagePrompt(message);
  const imageType = getInternalVisionLine(message, "type") ?? "";
  const summaries = uniqueTextValues(getInternalVisionLines(message, "summary"));
  const summary = summaries.join(" ");
  const request = getInternalVisionLine(message, "customer request");
  const appointment = getInternalVisionLine(message, "appointment");
  const location = cleanLocationText(getInternalVisionLine(message, "location"));
  const propertyType = getInternalVisionLine(message, "property type");
  const listingType = getInternalVisionLine(message, "listing type");
  const price = getInternalVisionLine(message, "price");
  const size = getInternalVisionLine(message, "size");
  const propertyDetails = [size, propertyType, listingType, price ? `price ${price}` : ""].filter(Boolean);
  const hasVisiblePrompt = Boolean(visiblePrompt);
  const hasWorkflowPrompt = hasExplicitWorkflowPrompt(visiblePrompt);
  const hasEmbeddedAction =
    hasVisionScheduleEvidence(message) ||
    /- customer request:\s*[^\n]*(reply|respond|follow|contact|send|message|create|save|mark|update|预约|看房|回复|跟进|联系|保存|创建|标记|更新)/i.test(
      message
    );
  const shouldAnswerOnly =
    isReadOnlyImagePrompt(visiblePrompt) ||
    (!hasVisiblePrompt && !hasEmbeddedAction) ||
    (!hasWorkflowPrompt && !hasEmbeddedAction && /map_or_location|document_or_form|other/i.test(imageType)) ||
    (!hasWorkflowPrompt && !hasEmbeddedAction && /suggested intent:\s*general_reply/i.test(message));

  if (!shouldAnswerOnly) {
    return null;
  }

  const details = [
    summary ? `I can see: ${summary}` : "I reviewed the uploaded image.",
    location ? `Location: ${location}.` : "",
    request && !/where|location|address/i.test(request) ? `Visible request: ${request}.` : "",
    propertyDetails.length ? `Property details: ${propertyDetails.join(", ")}.` : "",
    appointment ? `Time mentioned: ${appointment}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
  const nextStep = getLikelyImageNextStepQuestion({
    imageType,
    visiblePrompt,
    request,
    location,
    hasPropertyDetails: propertyDetails.length > 0,
    hasVisiblePrompt
  });

  return {
    intent: "general_reply",
    requires_confirmation: false,
    response: `${details} ${nextStep.possibleIntent} ${nextStep.question}`,
    payload: {
      image_type: imageType,
      summary,
      location,
      request,
      possible_intent: nextStep.possibleIntent,
      next_question: nextStep.question
    }
  };
}

function cleanLocationText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const uniqueParts = parts.filter(
    (part, index) => parts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index
  );

  return uniqueParts.join(", ");
}

function getScheduleDescription(message: string) {
  const visibleMessage = stripUploadedImageEvidence(message).replace(/^Attached \d+ listing media file[s]?\.\s*/i, "").trim();
  if (visibleMessage) {
    return visibleMessage;
  }

  const request = getInternalVisionLine(message, "customer request");
  const appointment = getInternalVisionLine(message, "appointment");
  const location = cleanLocationText(getInternalVisionLine(message, "location"));

  if (request || appointment || location) {
    return [request, appointment ? `Appointment: ${appointment}.` : "", location ? `Location: ${location}.` : ""]
      .filter(Boolean)
      .join(" ");
  }

  return "Viewing requested from the uploaded image.";
}

function hasVisionScheduleEvidence(message: string) {
  return (
    /suggested intent:\s*create_schedule_event/i.test(message) &&
    (/- appointment:\s*[^\n]+/i.test(message) ||
      /- customer request:\s*[^\n]*(appointment|viewing|visit|schedule|see|看房|预约)/i.test(message))
  );
}

function parseLocalScheduleEvent(message: string, timeZone?: string | null): AgentAction {
  const visibleMessage = stripUploadedImageEvidence(message);
  const scheduleDescription = getScheduleDescription(message);
  const lower = message.toLowerCase();
  const startAt = extractScheduleTime(message, timeZone);
  const leadName = visibleMessage ? extractLeadName(visibleMessage) : undefined;
  const listingMatch = message.match(/DHA\s*Phase\s*\d+[^,.，。]*/i);
  const locationLine = cleanLocationText(getInternalVisionLine(message, "location"));
  const listingReference = listingMatch?.[0]?.trim() ?? locationLine;
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
      description: scheduleDescription,
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
      location_text: listingReference
        ? listingReference.toLowerCase().includes("lahore")
          ? listingReference
          : `${listingReference}, Lahore`
        : undefined,
      source_payload: {
        source: "local_schedule_parser",
        original_message: visibleMessage || scheduleDescription,
        used_uploaded_image_evidence: message !== visibleMessage
      }
    }
  };
}

function parseLocalScheduleQuery(message: string): AgentAction {
  const dateFilter = /tomorrow|\bkal\b|明天|کل/iu.test(message)
    ? "tomorrow"
    : /week|hafta|haftay|本周|下周|ہفت/u.test(message)
      ? "week"
      : /all|全部|所有|تمام/u.test(message)
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
    response: formatScheduleQueryResponse({ date_filter: dateFilter }, message),
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

function isContextualListingDraftRequest(message: string) {
  return (
    /\b(?:draft|create|write|make|prepare)\b[\s\S]{0,80}\blisting\b[\s\S]{0,80}\b(?:it|this|that|image|photo|floor\s*plan)\b/i.test(
      message
    ) ||
    /\blisting\b[\s\S]{0,80}\bfrom\b[\s\S]{0,30}\b(?:it|this|that|image|photo|floor\s*plan)\b/i.test(message) ||
    /(?:草拟|起草|生成|创建|写)[\s\S]{0,20}房源[\s\S]{0,30}(?:这个|这张|图片|户型图)/u.test(message)
  );
}

function getLatestImageObservationContext(context?: AgentRoutingContext) {
  const recentAssistantMessages =
    getRoutingRecentMessages(context)
      .filter((item) => item.role === "assistant")
      .slice()
      .reverse();

  return recentAssistantMessages.find(
    (item) =>
      /(?:I can see:|I reviewed the uploaded image|我.*(?:看到|识别|读).*(?:图片|图)|Floor plan|Property details:)/i.test(
        item.content
      ) && /(?:Should I draft a listing|listing draft|listing media|房源|户型|floor plan|property details)/i.test(item.content)
  )?.content;
}

function extractBetween(value: string, start: RegExp, end: RegExp) {
  const startMatch = value.match(start);
  if (!startMatch?.index) {
    if (!startMatch) {
      return "";
    }
  }

  const from = (startMatch.index ?? 0) + startMatch[0].length;
  const rest = value.slice(from);
  const endMatch = rest.match(end);
  return (endMatch ? rest.slice(0, endMatch.index) : rest).trim();
}

function parseListingDraftFromImageObservation(message: string, context?: AgentRoutingContext): AgentAction | null {
  if (!isContextualListingDraftRequest(message)) {
    return null;
  }

  const observation = getLatestImageObservationContext(context);
  if (!observation) {
    return null;
  }

  const summary =
    extractBetween(observation, /I can see:\s*/i, /(?:\s+Property details:|\s+This may|\s+Should I|$)/i) ||
    observation.split("\n")[0]?.trim() ||
    "Uploaded property image.";
  const detailText = extractBetween(observation, /Property details:\s*/i, /(?:\.\s+This may|\.\s+Should I|$)/i);
  const combined = `${summary} ${detailText} ${message}`;
  const lower = combined.toLowerCase();
  const sqftMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sqft|sq\.?\s*ft|square\s*feet)/);
  const kanalMatch = lower.match(/(\d+(?:\.\d+)?)\s*kanal/);
  const marlaMatch = lower.match(/(\d+(?:\.\d+)?)\s*marla/);
  const bedMatch = lower.match(/(\d+)\s*(?:bed|beds|bedroom|bedrooms)/);
  const bathMatch = lower.match(/(\d+)\s*(?:bath|baths|bathroom|bathrooms)/);
  const propertyType = /\b(apartment|flat)\b/i.test(combined)
    ? "apartment"
    : /\b(plot|plots)\b/i.test(combined)
      ? "plot"
      : /\b(shop|commercial)\b/i.test(combined)
        ? "commercial"
        : "house";
  const listingType = /\b(rent|rental|lease|for_rent)\b/i.test(combined) ? "rent" : "sale";
  const areaValue = sqftMatch ? Number(sqftMatch[1]) : kanalMatch ? Number(kanalMatch[1]) : marlaMatch ? Number(marlaMatch[1]) : undefined;
  const areaUnit = sqftMatch ? "sqft" : kanalMatch ? "kanal" : marlaMatch ? "marla" : undefined;
  const featureCandidates = ["balcony", "TV lounge", "dining area", "dining", "kitchen", "laundry"];
  const features = featureCandidates
    .filter((feature) => new RegExp(feature.replace(/\s+/g, "\\s+"), "i").test(combined))
    .map((feature) => (feature === "dining" ? "dining area" : feature));
  const uniqueFeatures = Array.from(new Set(features));
  const titleParts = [
    areaValue && areaUnit ? `${areaValue} ${areaUnit}` : undefined,
    bedMatch ? `${Number(bedMatch[1])}-bed` : undefined,
    propertyType === "house" ? "House" : propertyType[0].toUpperCase() + propertyType.slice(1)
  ].filter(Boolean);
  const wantsFacebook = /\b(?:facebook|fb)\b/i.test(message);
  const missing = [
    "location",
    "price",
    propertyType ? "" : "property type",
    listingType ? "" : "sale or rent"
  ].filter(Boolean);

  return {
    intent: "create_listing_draft",
    requires_confirmation: true,
    response: `I drafted a listing preview from the previous image. ${missing.length ? `I still need ${missing.join(", ")} before it is complete. ` : ""}${
      wantsFacebook ? "After you confirm the listing, I can prepare the Facebook promotion pack. " : ""
    }Please review and confirm before adding it to your library.`,
    payload: {
      title: titleParts.join(" ") || "Property Listing From Floor Plan",
      description: [
        `A ${areaValue && areaUnit ? `${areaValue} ${areaUnit} ` : ""}${bedMatch ? `${Number(bedMatch[1])}-bedroom ` : ""}${bathMatch ? `${Number(bathMatch[1])}-bathroom ` : ""}${propertyType} for ${listingType}.`,
        uniqueFeatures.length ? `Features include ${uniqueFeatures.join(", ")}.` : "",
        "Location and price should be confirmed before publishing or promoting."
      ]
        .filter(Boolean)
        .join(" "),
      property_type: propertyType,
      listing_type: listingType,
      price_currency: "PKR",
      area_value: areaValue,
      area_unit: areaUnit,
      bedrooms: bedMatch ? Number(bedMatch[1]) : undefined,
      bathrooms: bathMatch ? Number(bathMatch[1]) : undefined,
      features: uniqueFeatures
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

function shouldNormalizeExternalPublishAsPromotion(message: string) {
  const hasExternalActionVerb = /\b(?:share|post|publish|send)\b|发布|分享|发送/iu.test(message);
  const hasExternalChannel =
    /\b(?:whats\s*app|whatsapp|wa|facebook|fb|instagram|insta|ig|portal|zameen|olx)\b|门户|平台/iu.test(
      message
    );

  return hasExternalActionVerb && hasExternalChannel && isPromotionRequest(message);
}

function normalizeAgentAction(action: AgentAction, message: string, context?: AgentRoutingContext): AgentAction {
  const brokerMessage = stripLocationEnhancedRoutingContext(message);

  if (isTodayFollowUpsRequest(brokerMessage) && action.intent !== "list_today_followups") {
    return parseLocalTodayFollowUps(brokerMessage);
  }

  if (
    action.intent === "publish_listing" &&
    shouldNormalizeExternalPublishAsPromotion(message)
  ) {
    return parseLocalPromotionRequest(message);
  }

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
    action.intent === "list_today_followups" ||
    action.intent === "draft_lead_reply" ||
    action.intent === "record_lead_followup" ||
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
      if (action.intent === "record_lead_followup") {
        return parseLocalLeadFollowUpRecord(message);
      }

      if (action.intent === "update_lead_status") {
        return parseLocalLeadStatusUpdate(message);
      }

      if (action.intent === "draft_lead_reply") {
        return parseLocalLeadReplyRequest(message);
      }

      if (action.intent === "list_today_followups") {
        return parseLocalTodayFollowUps(message);
      }

      return parseLocalLeadQuery(message);
    }

    return {
      ...action,
      requires_confirmation: requiresConfirmationForAgentAction({
        intent: action.intent,
        payload: parsedPayload.data
      }),
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

function finalizeAgentActionResponse(action: AgentAction, sourceMessage: string): AgentAction {
  return stripInternalLocationContextFromAction(
    applyAgentActionPolicy(localizeAgentActionResponse(action, sourceMessage))
  );
}

function parseLocalAgentAction(message: string, context?: AgentRoutingContext): AgentAction {
  const intent = hasVisionScheduleEvidence(message)
    ? "schedule_event"
    : classifyLocalIntent(message);

  switch (intent) {
    case "analytics":
      return parseLocalAnalyticsRequest(message);
    case "today_followups":
      return parseLocalTodayFollowUps(message);
    case "lead_create":
      return parseLocalLeadCreate(message);
    case "lead_reply":
      return parseLocalLeadReplyRequest(message);
    case "lead_details_update":
      return parseLocalLeadDetailsUpdate(message);
    case "lead_listing_update":
      return parseLocalLeadListingUpdate(message);
    case "lead_followup_record":
      return parseLocalLeadFollowUpRecord(message);
    case "lead_status_update":
      return parseLocalLeadStatusUpdate(message);
    case "schedule_event":
      return parseLocalScheduleEvent(message, context?.timeZone);
    case "schedule_query":
      return parseLocalScheduleQuery(message);
    case "lead_query":
      return parseLocalLeadQuery(message);
    case "promotion":
      return parseLocalPromotionRequest(message, context);
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
  memory?: AgentMemoryRuntimeContext;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

function getRoutingRecentMessages(context?: AgentRoutingContext) {
  const memoryMessages = getAgentMemoryRecentMessages(context?.memory);
  const recentMessages = memoryMessages.length ? memoryMessages : context?.recentMessages ?? [];

  return recentMessages.filter((item) => item.content.trim()).slice(-20);
}

function getRoutingTimeZone(context?: AgentRoutingContext) {
  return context?.memory?.runtime.timeZone ?? context?.timeZone;
}

function getRoutingLocationContext(context?: AgentRoutingContext) {
  return context?.memory?.runtime.locationContext ?? context?.locationContext;
}

export async function routeAgentMessage(message: string, context?: AgentRoutingContext): Promise<AgentAction> {
  const listingImportUrl = getListingImportUrl(message);
  if (listingImportUrl) {
    try {
      const draft = await importListingDraftFromUrl(listingImportUrl);
      const imageCount = draft.ai_extracted_payload.remote_images.length;

      return finalizeAgentActionResponse({
        intent: "create_listing_draft",
        requires_confirmation: false,
        response: `I imported the listing details from that link and found ${imageCount} image${imageCount === 1 ? "" : "s"}. Please review before adding it to your library.`,
        payload: draft
      }, message);
    } catch {
      return finalizeAgentActionResponse({
        intent: "general_reply",
        requires_confirmation: false,
        response:
          "I found the listing link, but I could not read that page yet. Please paste the key property details, or try the link again.",
        payload: {
          source_url: listingImportUrl
        }
      }, message);
    }
  }

  const imageObservationReply = parseImageObservationReply(message);
  if (imageObservationReply) {
    return finalizeAgentActionResponse(imageObservationReply, message);
  }

  const contextualImageDraft = parseListingDraftFromImageObservation(message, context);
  if (contextualImageDraft) {
    return finalizeAgentActionResponse(contextualImageDraft, message);
  }

  if (isSocialCopyRequest(message) && !isTrackableCampaignLinkRequest(message)) {
    return finalizeAgentActionResponse(await parseLocalSocialCopyRequest(message, context), message);
  }

  const routingMessage = buildLocationEnhancedRoutingMessage(message, getRoutingLocationContext(context));
  const visionSuggestedSchedule = hasVisionScheduleEvidence(message);
  const localIntent = visionSuggestedSchedule ? "schedule_event" : classifyLocalIntent(message);

  if (localIntent === "today_followups") {
    return finalizeAgentActionResponse(parseLocalAgentAction(message, context), message);
  }

  if (localIntent === "analytics") {
    return finalizeAgentActionResponse(parseLocalAgentAction(message, context), message);
  }

  if (localIntent === "lead_create") {
    return finalizeAgentActionResponse(parseLocalAgentAction(message, context), message);
  }

  if (localIntent === "schedule_event" || localIntent === "schedule_query") {
    return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
  }

  if (localIntent === "listing_draft" || localIntent === "listing_update" || localIntent === "lead_details_update") {
    return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
  }

  if (localIntent === "promotion" && isSocialCopyRequest(message) && !isTrackableCampaignLinkRequest(message)) {
    return finalizeAgentActionResponse(await parseLocalSocialCopyRequest(message, context), message);
  }

  if (!env.deepseekApiKey) {
    return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
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
            content: `User time zone: ${getResolvedTimeZone(getRoutingTimeZone(context))}\nCurrent date in user time zone: ${new Date().toLocaleDateString("en-CA", {
              timeZone: getResolvedTimeZone(getRoutingTimeZone(context))
            })}\n\nVerified Pakistan real estate location terms from the hierarchy API. Use these only to normalize location names and improve entity extraction; do not treat them as saved listings or leads:\n${formatLocationContextForPrompt(
              getRoutingLocationContext(context)
            )}\n\nCompiled agent memory:\n${formatAgentMemoryForPrompt(context?.memory)}\n\nUser message: ${message}`
          }
        ]
      })
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
    }

    const action = agentActionSchema.parse(JSON.parse(extractJsonObject(content)));
    const normalizedAction = normalizeAgentAction(action, routingMessage, context);
    const gatedAction = applySemanticRouteConfidenceGate(normalizedAction);

    if (gatedAction !== normalizedAction) {
      return finalizeAgentActionResponse(gatedAction, message);
    }

    if (normalizedAction.intent === "general_reply" && localIntent !== "general_reply") {
      return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
    }

    if (localIntent === "promotion" && normalizedAction.intent !== "create_campaign_links") {
      return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
    }

    return finalizeAgentActionResponse(normalizedAction, message);
  } catch {
    return finalizeAgentActionResponse(parseLocalAgentAction(routingMessage, context), message);
  } finally {
    clearTimeout(timeout);
  }
}
