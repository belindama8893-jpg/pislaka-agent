"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  FileText,
  Globe2,
  House,
  ImageIcon,
  Megaphone,
  MessageCircle,
  Phone,
  Pencil,
  Sparkles,
  Upload,
  X,
  UserPlus
} from "lucide-react";
import { AgentComposer, type AgentComposerContextPreview } from "@/components/agent/AgentComposer";
import { useRouter } from "next/navigation";
import type { AgentChatMessageRecord } from "@/lib/agent/conversations";
import type { BrokerEventDraftInput, BrokerEventRecord } from "@/lib/events/types";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";
import type { LeadReplyDraft } from "@/lib/leads/reply-types";
import type {
  AgentAction,
  LeadCreatePayload,
  LeadDetailsUpdatePayload,
  LeadListingUpdatePayload,
  LeadOperationPayload,
  ListingUpdatePayload,
  ScheduleEventListPayload
} from "@/lib/agent/types";
import type { ListingDraftInput, ListingDraftUpdateInput } from "@/lib/listings/types";
import type { ListingPromotion, PromotionChannel } from "@/lib/promotions/types";

type RecentListingSummary = {
  id: string;
  status?: "draft" | "published" | "archived";
  title: string | null;
  description?: string | null;
  location_area: string | null;
  city: string | null;
  property_type: string | null;
  listing_type?: "sale" | "rent" | null;
  price_amount?: number | null;
  price_currency?: string | null;
  area_value: number | null;
  area_unit: "kanal" | "marla" | "sqft" | "sqm" | null;
  bedrooms: number | null;
  bathrooms?: number | null;
  features?: string[] | null;
};

type AgentWorkspaceProps = {
  conversationId: string;
  firstName: string;
  hasOlderMessages: boolean;
  initialMessages: AgentChatMessageRecord[];
  initialContextAttachments?: ChatContextAttachment[];
  recentListings: RecentListingSummary[];
  recentLeads: LeadListItem[];
};

type ChatMessage = {
  id: string;
  createdAt?: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  attachments?: PendingMedia[];
  contextAttachments?: ChatContextAttachment[];
  fileAttachments?: PendingFileAttachment[];
  draft?: ListingDraftInput;
  scheduleEvent?: BrokerEventDraftInput;
  scheduleEvents?: BrokerEventRecord[];
  leadResults?: LeadListItem[];
  leadLatestOffer?: boolean;
  leadDetailsUpdate?: LeadDetailsUpdatePreview;
  leadCreate?: LeadCreatePreview;
  leadBatchStatusUpdate?: LeadBatchStatusUpdatePreview;
  leadListingUpdate?: LeadListingUpdatePreview;
  leadStatusUpdate?: LeadStatusUpdatePreview;
  leadReply?: LeadReplyDraftWithLink;
  listingUpdate?: ListingUpdatePreview;
  listingUpdateChoices?: ListingUpdateChoicePreview;
  promotion?: ListingPromotion;
  promotionTarget?: RecentListingSummary;
  promotionInstruction?: string;
  promotionChannels?: PromotionChannel[];
};

type LeadStatusUpdatePreview = {
  lead: LeadListItem;
  status?: LeadRecord["status"];
  urgency?: LeadRecord["urgency"];
};

type LeadDetailsUpdateChanges = Partial<Pick<LeadDetailsUpdatePayload, "full_name" | "phone" | "email" | "message">>;

type LeadDetailsUpdatePreview = {
  lead: LeadListItem;
  changes: LeadDetailsUpdateChanges;
};

type LeadCreatePreview = {
  payload: LeadCreatePayload;
};

type LeadBatchStatusUpdatePreview = {
  leads: LeadListItem[];
  status?: LeadRecord["status"];
  urgency?: LeadRecord["urgency"];
};

type LeadListingUpdatePreview = {
  lead: LeadListItem;
  listing: RecentListingSummary;
};

type ListingUpdateChanges = Partial<Omit<ListingDraftUpdateInput, "id">>;

type ListingUpdatePreview = {
  listing: RecentListingSummary;
  changes: ListingUpdateChanges;
};

type ListingUpdateChoicePreview = {
  candidates: RecentListingSummary[];
  changes: ListingUpdateChanges;
  actionResponse: string;
};

type LeadReplyDraftWithLink = LeadReplyDraft & {
  whatsapp_url: string;
};

type AgentResolution = NonNullable<AgentAction["resolution"]>;
type AgentResolutionCandidate = NonNullable<AgentResolution["matched"]>;

type ListingResolutionCandidate = AgentResolutionCandidate;

type ChatMessageUiPayload = Partial<
  Pick<
    ChatMessage,
    | "draft"
    | "scheduleEvent"
    | "leadResults"
    | "leadLatestOffer"
    | "leadDetailsUpdate"
    | "leadCreate"
    | "leadBatchStatusUpdate"
    | "leadListingUpdate"
    | "leadStatusUpdate"
    | "leadReply"
    | "listingUpdate"
    | "listingUpdateChoices"
    | "promotion"
    | "promotionTarget"
    | "promotionInstruction"
    | "promotionChannels"
  >
>;

type ChatContextAttachment = {
  id: string;
  type: "listing" | "lead";
  entity_id: string;
  label: string;
  summary: string;
  snapshot?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getMessageUiPayload(payload: AgentChatMessageRecord["structured_payload"]) {
  if (!isRecord(payload) || !isRecord(payload.ui)) {
    return {};
  }

  return payload.ui as ChatMessageUiPayload;
}

function chatMessageFromRecord(record: AgentChatMessageRecord): ChatMessage {
  return {
    id: record.id,
    createdAt: record.created_at,
    role: record.role,
    content: record.content,
    ...getMessageUiPayload(record.structured_payload)
  };
}

function structuredPayloadForMessage(message: ChatMessage): Record<string, unknown> {
  const ui: Record<string, unknown> = {};

  for (const key of [
    "draft",
    "scheduleEvent",
    "leadResults",
    "leadLatestOffer",
    "leadDetailsUpdate",
    "leadCreate",
    "leadBatchStatusUpdate",
    "leadListingUpdate",
    "leadStatusUpdate",
    "leadReply",
    "listingUpdate",
    "listingUpdateChoices",
    "promotion",
    "promotionTarget",
    "promotionInstruction",
    "promotionChannels"
  ] as const) {
    if (message[key] !== undefined) {
      ui[key] = message[key];
    }
  }

  return Object.keys(ui).length ? { ui } : {};
}

const promotionChannels: Array<{ channel: PromotionChannel; label: string }> = [
  { channel: "whatsapp", label: "WhatsApp" },
  { channel: "facebook", label: "Facebook" },
  { channel: "instagram", label: "Instagram" },
  { channel: "portal", label: "Portal" }
];

function extractPromotionChannels(messageText: string): PromotionChannel[] {
  const normalized = messageText.toLowerCase();
  const channels: PromotionChannel[] = [];

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

  return channels;
}

const waveformBarCount = 48;
const idleVoiceLevels = Array.from({ length: waveformBarCount }, (_, index) => {
  const wave = Math.sin(index * 0.82) * 0.28 + Math.sin(index * 0.31) * 0.18;
  return Math.max(0.16, Math.min(0.88, 0.42 + wave));
});

type PendingMedia = {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
};

type PendingFileAttachment = {
  id: string;
  file: File;
};

function ChannelLogo({ channel }: { channel: PromotionChannel }) {
  if (channel === "whatsapp") {
    return (
      <span className="channel-logo whatsapp" aria-hidden="true">
        <MessageCircle size={18} />
      </span>
    );
  }

  if (channel === "facebook") {
    return (
      <span className="channel-logo facebook" aria-hidden="true">
        f
      </span>
    );
  }

  if (channel === "instagram") {
    return (
      <span className="channel-logo instagram" aria-hidden="true">
        ◎
      </span>
    );
  }

  return (
    <span className="channel-logo portal" aria-hidden="true">
      <Globe2 size={17} />
    </span>
  );
}

type DraftFormState = {
  title: string;
  description: string;
  city: string;
  location_area: string;
  property_type: string;
  listing_type: "sale" | "rent";
  price_amount: string;
  area_value: string;
  area_unit: "kanal" | "marla" | "sqft" | "sqm" | "";
  bedrooms: string;
  bathrooms: string;
  features: string;
};

type EventFormState = {
  event_category: BrokerEventDraftInput["event_category"];
  event_type: BrokerEventDraftInput["event_type"];
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  reminder_at: string;
  recurrence_rule: string;
  lead_id: string;
  listing_id: string;
  lead_name: string;
  listing_reference: string;
  location_text: string;
  source_payload: Record<string, unknown>;
};

function createId() {
  return crypto.randomUUID();
}

function draftToFormState(draft: ListingDraftInput): DraftFormState {
  return {
    title: draft.title ?? "",
    description: draft.description ?? "",
    city: draft.city ?? "Lahore",
    location_area: draft.location_area ?? "",
    property_type: draft.property_type ?? "house",
    listing_type: draft.listing_type ?? "sale",
    price_amount: draft.price_amount ? String(Math.round(draft.price_amount)) : "",
    area_value: draft.area_value ? String(draft.area_value) : "",
    area_unit: draft.area_unit ?? "",
    bedrooms: draft.bedrooms === undefined ? "" : String(draft.bedrooms),
    bathrooms: draft.bathrooms === undefined ? "" : String(draft.bathrooms),
    features: draft.features?.join(", ") ?? ""
  };
}

function formStateToDraft(form: DraftFormState): ListingDraftInput {
  return {
    title: form.title.trim() || "New Property Listing",
    description: form.description.trim() || undefined,
    city: form.city.trim() || "Lahore",
    location_area: form.location_area.trim() || undefined,
    property_type: form.property_type.trim() || undefined,
    listing_type: form.listing_type,
    price_amount: form.price_amount ? Number(form.price_amount) : undefined,
    price_currency: "PKR",
    area_value: form.area_value ? Number(form.area_value) : undefined,
    area_unit: form.area_unit || undefined,
    bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
    bathrooms: form.bathrooms ? Number(form.bathrooms) : undefined,
    features: form.features
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean),
    ai_extracted_payload: {
      source: "agent_workspace_preview"
    },
    ai_confidence: 0.72
  };
}

function listingUpdatePayloadToChanges(payload: ListingUpdatePayload): ListingUpdateChanges {
  const changes: ListingUpdateChanges = {};

  for (const key of [
    "title",
    "description",
    "city",
    "location_area",
    "property_type",
    "listing_type",
    "price_amount",
    "price_currency",
    "area_value",
    "area_unit",
    "bedrooms",
    "bathrooms",
    "features",
    "status"
  ] as const) {
    if (payload[key] !== undefined) {
      changes[key] = payload[key] as never;
    }
  }

  return changes;
}

function hasListingUpdateChanges(changes: ListingUpdateChanges) {
  return Object.keys(changes).length > 0;
}

function leadDetailsPayloadToChanges(payload: LeadDetailsUpdatePayload): LeadDetailsUpdateChanges {
  const changes: LeadDetailsUpdateChanges = {};

  for (const key of ["full_name", "phone", "email", "message"] as const) {
    if (payload[key] !== undefined) {
      changes[key] = payload[key] as never;
    }
  }

  return changes;
}

function hasLeadDetailsUpdateChanges(changes: LeadDetailsUpdateChanges) {
  return Object.keys(changes).length > 0;
}

function getLeadValue(lead: LeadListItem, field: keyof LeadDetailsUpdateChanges) {
  return lead[field];
}

function toDatetimeLocal(value: string | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDatetimeLocal(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function eventToFormState(event: BrokerEventDraftInput): EventFormState {
  return {
    event_category: event.event_category,
    event_type: event.event_type,
    title: event.title,
    description: event.description ?? "",
    start_at: toDatetimeLocal(event.start_at),
    end_at: toDatetimeLocal(event.end_at),
    reminder_at: toDatetimeLocal(event.reminder_at),
    recurrence_rule: event.recurrence_rule ?? "",
    lead_id: event.lead_id ?? "",
    listing_id: event.listing_id ?? "",
    lead_name: event.lead_name ?? "",
    listing_reference: event.listing_reference ?? "",
    location_text: event.location_text ?? "",
    source_payload: event.source_payload ?? {}
  };
}

function formStateToEvent(form: EventFormState): BrokerEventDraftInput {
  return {
    event_category: form.event_category,
    event_type: form.event_type,
    title: form.title.trim() || "Broker event",
    description: form.description.trim() || undefined,
    start_at: fromDatetimeLocal(form.start_at),
    end_at: fromDatetimeLocal(form.end_at),
    reminder_at: fromDatetimeLocal(form.reminder_at),
    recurrence_rule: form.recurrence_rule.trim() || undefined,
    lead_id: form.lead_id || undefined,
    listing_id: form.listing_id || undefined,
    lead_name: form.lead_name.trim() || undefined,
    listing_reference: form.listing_reference.trim() || undefined,
    location_text: form.location_text.trim() || undefined,
    source_payload: {
      ...form.source_payload,
      source: "agent_workspace_schedule_preview"
    }
  };
}

function formatEventTime(event: BrokerEventDraftInput) {
  const primaryTime = event.start_at ?? event.reminder_at;

  if (!primaryTime) {
    return event.recurrence_rule || "Time not set";
  }

  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(primaryTime));
}

function getScheduleResultTime(event: BrokerEventRecord) {
  return event.start_at ?? event.reminder_at ?? event.created_at;
}

function formatScheduleResultTime(event: BrokerEventRecord) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(getScheduleResultTime(event)));
}

function getScheduleDateRange(dateFilter: ScheduleEventListPayload["date_filter"]) {
  if (dateFilter === "all") {
    return {};
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (dateFilter === "tomorrow") {
    start.setDate(start.getDate() + 1);
  }

  const end = new Date(start);

  if (dateFilter === "week") {
    end.setDate(start.getDate() + 7);
  }

  end.setHours(23, 59, 59, 999);

  return {
    from: start.toISOString(),
    to: end.toISOString()
  };
}

function formatPrice(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return "Price not set";
  }

  const crore = value / 10000000;
  if (crore >= 1) {
    return `PKR ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `PKR ${value.toLocaleString("en-PK")}`;
}

function formatListingCurrency(amount: number | null | undefined, currency = "PKR") {
  if (!amount) {
    return "Not set";
  }

  const crore = amount / 10000000;
  if (crore >= 1) {
    return `${currency} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${currency} ${amount.toLocaleString("en-PK")}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

function listingToContextAttachment(listing: RecentListingSummary): ChatContextAttachment {
  const area = [listing.area_value, listing.area_unit].filter(Boolean).join(" ");
  const location = [listing.location_area, listing.city].filter(Boolean).join(", ");

  return {
    id: `listing:${listing.id}`,
    type: "listing",
    entity_id: listing.id,
    label: listing.title || "Untitled listing",
    summary: [area || null, location || null, formatListingCurrency(listing.price_amount, listing.price_currency ?? "PKR")]
      .filter(Boolean)
      .join(" · "),
    snapshot: {
      status: listing.status,
      title: listing.title,
      location_area: listing.location_area,
      city: listing.city,
      property_type: listing.property_type,
      listing_type: listing.listing_type,
      price_amount: listing.price_amount,
      price_currency: listing.price_currency,
      area_value: listing.area_value,
      area_unit: listing.area_unit,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms
    }
  };
}

function leadToContextAttachment(lead: LeadListItem): ChatContextAttachment {
  return {
    id: `lead:${lead.id}`,
    type: "lead",
    entity_id: lead.id,
    label: lead.full_name || lead.phone || lead.email || "Unnamed buyer",
    summary: [lead.status, getLeadInterestLine(lead), lead.phone || null].filter(Boolean).join(" · "),
    snapshot: {
      status: lead.status,
      urgency: lead.urgency,
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email,
      listing_title: lead.listing_title,
      listing_area: lead.listing_area,
      listing_city: lead.listing_city,
      campaign_channel: lead.campaign_channel,
      source_channel: lead.source_channel
    }
  };
}

function summarizeContextAttachments(contextAttachments: ChatContextAttachment[]) {
  if (!contextAttachments.length) {
    return "";
  }

  return `Selected context: ${contextAttachments
    .map((item) => `${item.type === "listing" ? "Listing" : "Lead"} ${item.label}`)
    .join(", ")}.`;
}

function summarizeFileAttachments(fileAttachments: PendingFileAttachment[]) {
  if (!fileAttachments.length) {
    return "";
  }

  return `Attached ${fileAttachments.length} file${fileAttachments.length === 1 ? "" : "s"}: ${fileAttachments
    .map((item) => item.file.name)
    .join(", ")}.`;
}

function looksLikeBulkLeadWrite(message: string) {
  return /reply|follow[-\s]?up|follow up|mark|status|schedule|hot|warm|contacted|qualified|phone|mobile|number|email|name|contact|话术|回复|跟进|标记|状态|安排|回访|电话|手机号|邮箱|名字/i.test(message);
}

function leadStatusFromMessage(message: string): Pick<LeadBatchStatusUpdatePreview, "status" | "urgency"> | null {
  if (/lost|无效|丢失/i.test(message)) {
    return { status: "lost" };
  }

  if (/closed|成交/i.test(message)) {
    return { status: "closed" };
  }

  if (/hot|qualified|高意向|强意向/i.test(message)) {
    return { status: "qualified", urgency: "high" };
  }

  if (/contacted|已联系|联系过|跟进过/i.test(message)) {
    return { status: "contacted" };
  }

  if (/\bnew\b|新/i.test(message)) {
    return { status: "new" };
  }

  return null;
}

function looksLikeBulkLeadStatusUpdate(message: string) {
  return /mark|status|hot|contacted|qualified|closed|lost|new|标记|状态|已联系|成交|丢失|无效|高意向/i.test(message);
}

function formatListingUpdateValue(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (field === "price_amount" && typeof value === "number") {
    return formatListingCurrency(value);
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "None";
  }

  return String(value);
}

function getListingValue(listing: RecentListingSummary, field: keyof ListingUpdateChanges) {
  return listing[field as keyof RecentListingSummary];
}

async function uploadListingMedia(listingId: string, media: PendingMedia[]) {
  let uploadedCount = 0;

  for (const item of media) {
    const formData = new FormData();
    formData.append("listing_id", listingId);
    formData.append("file", item.file);

    const response = await fetch("/api/listings/media", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Unable to upload ${item.file.name}`);
    }

    uploadedCount += 1;
  }

  return uploadedCount;
}

function normalizeListingText(value: string) {
  return value
    .toLowerCase()
    .replace(/马拉/g, " marla ")
    .replace(/卡纳尔|卡娜尔/g, " kanal ")
    .replace(/房子|房源|套房/g, " house ")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function messageMentionsCurrentListing(message: string) {
  return /这套|这个|刚才|刚刚|current|this listing|this property/i.test(message);
}

function scoreListingMatch(message: string, listing: RecentListingSummary) {
  const normalizedMessage = normalizeListingText(message);
  const searchable = normalizeListingText(
    [
      listing.title,
      listing.location_area,
      listing.city,
      listing.property_type,
      listing.area_value && listing.area_unit ? `${listing.area_value} ${listing.area_unit}` : null,
      listing.bedrooms !== null && listing.bedrooms !== undefined ? `${listing.bedrooms} beds` : null
    ]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;
  const messageTokens = new Set(normalizedMessage.split(" ").filter((token) => token.length > 1));

  for (const token of messageTokens) {
    if (searchable.includes(token)) {
      score += token.length >= 4 ? 2 : 1;
    }
  }

  if (listing.location_area && normalizedMessage.includes(normalizeListingText(listing.location_area))) {
    score += 6;
  }

  if (
    listing.area_value &&
    listing.area_unit &&
    normalizedMessage.includes(`${listing.area_value} ${listing.area_unit}`)
  ) {
    score += 8;
  }

  if (listing.property_type && normalizedMessage.includes(normalizeListingText(listing.property_type))) {
    score += 3;
  }

  return score;
}

function getLeadInterestLine(lead: LeadListItem) {
  const listing = [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ");
  const channel = lead.campaign_channel ?? lead.source_channel;

  return [listing || "Listing not set", channel ? `via ${channel}` : null].filter(Boolean).join(" · ");
}

function scoreLeadMatch(message: string, lead: LeadListItem) {
  if (!message.trim()) {
    return 0;
  }

  const normalizedMessage = normalizeListingText(message);
  const searchable = normalizeListingText(
    [
      lead.full_name,
      lead.phone,
      lead.email,
      lead.message,
      lead.ai_summary,
      lead.listing_title,
      lead.listing_area,
      lead.listing_city,
      lead.campaign_channel,
      lead.source_channel
    ]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;
  const messageTokens = new Set(normalizedMessage.split(" ").filter((token) => token.length > 1));

  for (const token of messageTokens) {
    if (searchable.includes(token)) {
      score += token.length >= 4 ? 2 : 1;
    }
  }

  if (lead.full_name && normalizedMessage.includes(normalizeListingText(lead.full_name))) {
    score += 10;
  }

  if (lead.phone && normalizedMessage.includes(lead.phone.replace(/\D/g, ""))) {
    score += 12;
  }

  return score;
}

function filterLeadsByPayload(leads: LeadListItem[], payload: LeadOperationPayload) {
  const statusFilter = payload.status_filter;
  const channelFilter = payload.channel_filter?.toLowerCase();
  const explicitLeadQuery = payload.lead_name ? normalizeListingText(payload.lead_name) : "";

  return leads
    .filter((lead) => statusFilter === "all" || !statusFilter || lead.status === statusFilter)
    .filter((lead) => {
      if (!channelFilter) {
        return true;
      }

      return (lead.campaign_channel ?? lead.source_channel ?? "").toLowerCase() === channelFilter;
    })
    .filter((lead) => {
      if (!explicitLeadQuery) {
        return true;
      }

      const searchable = normalizeListingText(
        [
          lead.full_name,
          lead.phone,
          lead.email,
          lead.message,
          lead.ai_summary,
          lead.listing_title,
          lead.listing_area,
          lead.listing_city
        ]
          .filter(Boolean)
          .join(" ")
      );

      return explicitLeadQuery
        .split(" ")
        .filter((token) => token.length > 2)
        .some((token) => searchable.includes(token));
    });
}

function formatLeadCreatedAt(createdAt: string) {
  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(createdAt));
}

function normalizeWhatsAppPhone(phone: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  return digits.startsWith("0") ? `92${digits.slice(1)}` : digits;
}

function makeWhatsAppReplyUrl(phone: string | null, text: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);

  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function getRecordingMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function getVoiceFileName(mimeType: string) {
  if (mimeType.includes("mp4")) {
    return "voice-note.mp4";
  }

  return "voice-note.webm";
}

function formatRecordingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function VoiceWaveform({
  isTranscribing,
  levels,
  seconds
}: {
  isTranscribing: boolean;
  levels: number[];
  seconds: number;
}) {
  return (
    <div className={`voice-waveform-panel ${isTranscribing ? "transcribing" : ""}`} role="status">
      <span className="voice-waveform-label">{isTranscribing ? "Transcribing" : "Listening"}</span>
      <div className="voice-waveform" aria-hidden="true">
        {levels.map((level, index) => (
          <span
            key={index}
            style={{ "--level": level } as CSSProperties}
          />
        ))}
      </div>
      <time>{formatRecordingTime(seconds)}</time>
    </div>
  );
}

function PromotionPack({ promotion }: { promotion: ListingPromotion }) {
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  async function handleCopy(channel: string, text: string) {
    await copyToClipboard(text);
    setCopiedChannel(channel);
  }

  return (
    <div className="chat-promotion-pack">
      <p className="promotion-summary">{promotion.summary}</p>
      <div className="promotion-list">
        {promotion.cards.map((card) => (
          <article className="promotion-row" key={card.channel}>
            <div className="promotion-card-header">
              <div className="promotion-channel-title">
                <ChannelLogo channel={card.channel} />
                <span>{card.channel}</span>
              </div>
              <button
                className="icon-button compact"
                type="button"
                aria-label={`Copy ${card.channel} promotion`}
                onClick={() => void handleCopy(card.channel, `${card.title}\n\n${card.body}\n\n${card.cta}`)}
              >
                <Copy size={14} />
              </button>
            </div>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
            <small>{copiedChannel === card.channel ? "Copied" : card.cta}</small>
            <div className="promotion-links">
              {card.landing_url ? (
                <a className="promotion-link" href={card.landing_url} target="_blank" rel="noreferrer">
                  Lead page: {card.landing_url}
                </a>
              ) : null}
              {card.whatsapp_share_url ? (
                <a className="promotion-link" href={card.whatsapp_share_url} target="_blank" rel="noreferrer">
                  Open WhatsApp share
                </a>
              ) : null}
            </div>
            <div className="promotion-media-brief">
              <span>{card.image_brief}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PromotionConfirmCard({
  initialChannels,
  listing,
  onGenerate
}: {
  initialChannels?: PromotionChannel[];
  listing: RecentListingSummary;
  onGenerate: (channels: PromotionChannel[]) => void;
}) {
  const [selectedChannels, setSelectedChannels] = useState<PromotionChannel[]>(
    initialChannels?.length ? initialChannels : ["whatsapp"]
  );

  function toggleChannel(channel: PromotionChannel) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    );
  }

  return (
    <div className="promotion-confirm-card">
      <div className="card-title">
        <Megaphone size={16} /> Confirm promotion target
      </div>
      <div className="promotion-target-card">
        <strong>{listing.title || "Untitled listing"}</strong>
        <span>
          {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || "Area not set"} ·{" "}
          {[listing.location_area, listing.city].filter(Boolean).join(", ") || "Location not set"}
        </span>
      </div>
      <p>Is this the listing you want to promote? Select one or more channels.</p>
      <div className="channel-selector">
        {promotionChannels.map((item) => (
          <label key={item.channel}>
            <input
              checked={selectedChannels.includes(item.channel)}
              type="checkbox"
              onChange={() => toggleChannel(item.channel)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <div className="card-actions">
        <button
          className="primary-button small"
          disabled={selectedChannels.length === 0}
          type="button"
          onClick={() => onGenerate(selectedChannels)}
        >
          <CheckCircle2 size={15} /> Generate promotion pack
        </button>
      </div>
    </div>
  );
}

function LeadResultsCard({
  leads,
  onSelect
}: {
  leads: LeadListItem[];
  onSelect?: (lead: LeadListItem) => void;
}) {
  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <MessageCircle size={16} /> Matching leads
      </div>
      {leads.length ? (
        <div className="lead-chat-list">
          {leads.slice(0, 5).map((lead) => (
            <div className="lead-chat-row" key={lead.id}>
              <div>
                <strong>{lead.full_name || "Unnamed buyer"}</strong>
                <p>{getLeadInterestLine(lead)}</p>
                <small>
                  {lead.status} · {lead.phone || "No phone"} · {formatLeadCreatedAt(lead.created_at)}
                </small>
              </div>
              <div className="lead-chat-row-action">
                <span className={`lead-status ${lead.status}`}>{lead.status}</span>
                {onSelect ? (
                  <button className="outline-button small" type="button" onClick={() => onSelect(lead)}>
                    Select
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="agent-draft-status">No matching leads found in the recent inbox.</p>
      )}
    </div>
  );
}

function LeadLatestOfferCard({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <MessageCircle size={16} /> No exact lead match
      </div>
      <p className="lead-chat-reply">
        I did not find that exact lead in the recent inbox. I can show the latest lead instead, but I need your confirmation first.
      </p>
      <div className="card-actions">
        <button className="primary-button small" type="button" onClick={onConfirm}>
          <CheckCircle2 size={15} /> View latest lead
        </button>
      </div>
    </div>
  );
}

function LeadStatusConfirmCard({
  preview,
  onUpdated
}: {
  preview: LeadStatusUpdatePreview;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Updating lead...");
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: preview.lead.id,
        status: preview.status,
        urgency: preview.urgency ?? undefined
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to update lead");
      setIsSaving(false);
      return;
    }

    setStatus("Lead updated.");
    onUpdated();
    setIsSaving(false);
  }

  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <CheckCircle2 size={16} /> Confirm lead update
      </div>
      <div className="lead-chat-row standalone">
        <div>
          <strong>{preview.lead.full_name || "Unnamed buyer"}</strong>
          <p>{getLeadInterestLine(preview.lead)}</p>
          <small>
            {preview.lead.status} {preview.status ? `→ ${preview.status}` : ""} ·{" "}
            {preview.lead.phone || "No phone"}
          </small>
        </div>
        <span className={`lead-status ${preview.status ?? preview.lead.status}`}>
          {preview.status ?? preview.lead.status}
        </span>
      </div>
      {preview.urgency ? <p className="agent-draft-status">Urgency will be set to {preview.urgency}.</p> : null}
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaving} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaving ? "Updating..." : "Confirm update"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

const leadDetailsFieldLabels: Record<keyof LeadDetailsUpdateChanges, string> = {
  full_name: "Name",
  phone: "Phone",
  email: "Email",
  message: "Message"
};

function LeadDetailsConfirmCard({
  preview,
  onUpdated
}: {
  preview: LeadDetailsUpdatePreview;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const entries = Object.entries(preview.changes).filter(([, value]) => value !== undefined) as Array<
    [keyof LeadDetailsUpdateChanges, string | null]
  >;

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Updating lead...");
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: preview.lead.id,
        ...preview.changes
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to update lead");
      setIsSaving(false);
      return;
    }

    setStatus("Lead updated.");
    onUpdated();
    setIsSaving(false);
  }

  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <Pencil size={16} /> Confirm lead details update
      </div>
      <div className="lead-chat-row standalone">
        <div>
          <strong>{preview.lead.full_name || "Unnamed buyer"}</strong>
          <p>{getLeadInterestLine(preview.lead)}</p>
          <small>{preview.lead.phone || "No phone"}</small>
        </div>
        <span className={`lead-status ${preview.lead.status}`}>{preview.lead.status}</span>
      </div>
      <div className="listing-update-list">
        {entries.map(([field, nextValue]) => (
          <div className="listing-update-row" key={field}>
            <span>{leadDetailsFieldLabels[field]}</span>
            <div>
              <small>{formatListingUpdateValue(getLeadValue(preview.lead, field), field)}</small>
              <strong>{formatListingUpdateValue(nextValue, field)}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaving} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaving ? "Updating..." : "Confirm update"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function LeadCreateConfirmCard({
  preview,
  onSaved
}: {
  preview: LeadCreatePreview;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Saving lead...");
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preview.payload)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to save lead");
      setIsSaving(false);
      return;
    }

    setStatus("Lead saved.");
    onSaved();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <UserPlus size={16} /> Confirm new lead
      </div>
      <div className="listing-update-list">
        {[
          ["Name", preview.payload.full_name],
          ["Phone", preview.payload.phone],
          ["Email", preview.payload.email],
          ["Status", preview.payload.status ?? "new"],
          ["Urgency", preview.payload.urgency ?? "normal"],
          ["Message", preview.payload.message]
        ]
          .filter(([, value]) => Boolean(value))
          .map(([label, value]) => (
            <div className="listing-update-row" key={label}>
              <span>{label}</span>
              <div>
                <strong>{String(value)}</strong>
              </div>
            </div>
          ))}
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaving} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaving ? "Saving..." : "Confirm & save"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function LeadBatchStatusConfirmCard({
  preview,
  onUpdated
}: {
  preview: LeadBatchStatusUpdatePreview;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSaving || !preview.status) {
      return;
    }

    setIsSaving(true);
    setStatus(`Updating ${preview.leads.length} leads...`);
    const results = await Promise.all(
      preview.leads.map((lead) =>
        fetch("/api/leads", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            id: lead.id,
            status: preview.status,
            urgency: preview.urgency
          })
        })
      )
    );
    const failed = results.filter((response) => !response.ok).length;

    if (failed) {
      setStatus(`${failed} lead${failed === 1 ? "" : "s"} could not be updated.`);
      setIsSaving(false);
      return;
    }

    setStatus("Leads updated.");
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <CheckCircle2 size={16} /> Confirm batch lead update
      </div>
      <p className="agent-draft-status">
        {preview.leads.length} lead{preview.leads.length === 1 ? "" : "s"} will be changed to{" "}
        {preview.status ?? "the selected status"}
        {preview.urgency ? ` with ${preview.urgency} urgency` : ""}.
      </p>
      <div className="lead-chat-list">
        {preview.leads.slice(0, 6).map((lead) => (
          <div className="lead-chat-row" key={lead.id}>
            <div>
              <strong>{lead.full_name || lead.phone || "Unnamed buyer"}</strong>
              <small>
                {lead.status} {preview.status ? `→ ${preview.status}` : ""} · {lead.phone || "No phone"}
              </small>
            </div>
            <span className={`lead-status ${preview.status ?? lead.status}`}>{preview.status ?? lead.status}</span>
          </div>
        ))}
      </div>
      <div className="card-actions">
        <button
          className="primary-button small"
          type="button"
          disabled={isSaving || !preview.status}
          onClick={handleConfirm}
        >
          <CheckCircle2 size={15} /> {isSaving ? "Updating..." : "Confirm batch update"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function LeadListingConfirmCard({
  preview,
  onUpdated
}: {
  preview: LeadListingUpdatePreview;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const currentListingLabel =
    [preview.lead.listing_title, preview.lead.listing_area, preview.lead.listing_city]
      .filter(Boolean)
      .join(", ") || "No primary listing";
  const nextListingLabel =
    preview.listing.title ||
    [preview.listing.area_value, preview.listing.area_unit, preview.listing.property_type]
      .filter(Boolean)
      .join(" ") ||
    "Untitled listing";

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Updating lead listing...");
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: preview.lead.id,
        listing_id: preview.listing.id
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to update lead listing");
      setIsSaving(false);
      return;
    }

    setStatus("Lead listing updated.");
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <House size={16} /> Confirm lead listing
      </div>
      <div className="lead-chat-row standalone">
        <div>
          <strong>{preview.lead.full_name || preview.lead.phone || "Unnamed buyer"}</strong>
          <p>{getLeadInterestLine(preview.lead)}</p>
          <small>{preview.lead.phone || "No phone"}</small>
        </div>
        <span className={`lead-status ${preview.lead.status}`}>{preview.lead.status}</span>
      </div>
      <div className="listing-update-list">
        <div className="listing-update-row">
          <span>Primary listing</span>
          <div>
            <small>{currentListingLabel}</small>
            <strong>
              {nextListingLabel} ·{" "}
              {[preview.listing.location_area, preview.listing.city].filter(Boolean).join(", ") ||
                "Location not set"}
            </strong>
          </div>
        </div>
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaving} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaving ? "Updating..." : "Confirm listing"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

const listingUpdateFieldLabels: Record<string, string> = {
  title: "Title",
  description: "Description",
  city: "City",
  location_area: "Area",
  property_type: "Property type",
  listing_type: "Intent",
  price_amount: "Price",
  price_currency: "Currency",
  area_value: "Area size",
  area_unit: "Area unit",
  bedrooms: "Beds",
  bathrooms: "Baths",
  features: "Features",
  status: "Status"
};

function ListingUpdateConfirmCard({
  preview,
  onUpdated
}: {
  preview: ListingUpdatePreview;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const entries = Object.entries(preview.changes).filter(([, value]) => value !== undefined);

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Updating listing...");
    const response = await fetch("/api/listings/draft", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: preview.listing.id,
        ...preview.changes
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to update listing");
      setIsSaving(false);
      return;
    }

    setStatus("Listing updated.");
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="listing-update-card">
      <div className="card-title">
        <Pencil size={16} /> Confirm listing update
      </div>
      <div className="promotion-target-card">
        <strong>{preview.listing.title || "Untitled listing"}</strong>
        <span>
          {[preview.listing.area_value, preview.listing.area_unit].filter(Boolean).join(" ") || "Area not set"} ·{" "}
          {[preview.listing.location_area, preview.listing.city].filter(Boolean).join(", ") || "Location not set"}
        </span>
      </div>
      <div className="listing-update-list">
        {entries.map(([field, nextValue]) => (
          <div className="listing-update-row" key={field}>
            <span>{listingUpdateFieldLabels[field] ?? field}</span>
            <div>
              <small>{formatListingUpdateValue(getListingValue(preview.listing, field as keyof ListingUpdateChanges), field)}</small>
              <strong>{formatListingUpdateValue(nextValue, field)}</strong>
            </div>
          </div>
        ))}
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaving} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaving ? "Updating..." : "Confirm update"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function ListingUpdateSelectionCard({
  preview,
  onSelect
}: {
  preview: ListingUpdateChoicePreview;
  onSelect: (listing: RecentListingSummary) => void;
}) {
  return (
    <div className="listing-update-card">
      <div className="card-title">
        <House size={16} /> Choose listing to update
      </div>
      <p className="agent-draft-status">
        I found multiple matching listings. Select the exact property, then I will show the update for confirmation.
      </p>
      <div className="listing-choice-grid">
        {preview.candidates.map((listing) => (
          <article className="listing-choice-card" key={listing.id}>
            <div>
              <strong>{listing.title || "Untitled listing"}</strong>
              <p>
                {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || "Area not set"} ·{" "}
                {[listing.location_area, listing.city].filter(Boolean).join(", ") || "Location not set"}
              </p>
              <small>
                {formatListingCurrency(listing.price_amount, listing.price_currency ?? "PKR")} ·{" "}
                {listing.bedrooms ?? "-"} beds / {listing.bathrooms ?? "-"} baths
                {listing.status ? ` · ${listing.status}` : ""}
              </small>
            </div>
            <button className="primary-button small" type="button" onClick={() => onSelect(listing)}>
              <CheckCircle2 size={15} /> Select
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function LeadReplyCard({ draft }: { draft: LeadReplyDraftWithLink }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(draft.reply_text);
    setCopied(true);
  }

  return (
    <div className="lead-chat-card">
      <div className="card-title">
        <MessageCircle size={16} /> WhatsApp reply draft
      </div>
      <p className="lead-chat-reply">{draft.reply_text}</p>
      <small>{draft.next_step}</small>
      <div className="card-actions">
        <button className="outline-button small" type="button" onClick={() => void handleCopy()}>
          <Copy size={14} /> {copied ? "Copied" : "Copy"}
        </button>
        <a className="primary-button small" href={draft.whatsapp_url} target="_blank" rel="noreferrer">
          <Phone size={14} /> Open WhatsApp
        </a>
      </div>
    </div>
  );
}

function DraftPreviewCard({
  draft,
  onAttachMedia,
  onRemoveMedia,
  pendingMedia,
  onSaved
}: {
  draft: ListingDraftInput;
  onAttachMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
  pendingMedia: PendingMedia[];
  onSaved: (uploadedCount: number, listingId: string) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => draftToFormState(draft));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const previewDraft = useMemo(() => formStateToDraft(form), [form]);

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus(pendingMedia.length ? "Adding listing and media..." : "Adding to library...");
    const response = await fetch("/api/listings/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(previewDraft)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to add listing");
      setIsSaving(false);
      return;
    }

    const payload = (await response.json()) as { listing?: { id?: string } };
    const listingId = payload.listing?.id;

    if (!listingId) {
      setStatus("Listing was created, but media upload could not start.");
      router.refresh();
      setIsSaving(false);
      return;
    }

    try {
      const uploadedCount = await uploadListingMedia(listingId, pendingMedia);
      setStatus(
        uploadedCount
          ? `Added to listing library with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}.`
          : "Added to listing library."
      );
      onSaved(uploadedCount, listingId);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Listing saved, but media upload failed.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="agent-draft-card">
      <div className="card-title">
        <Sparkles size={16} /> Listing preview
      </div>

      {isEditing ? (
        <div className="agent-draft-form">
          <label>
            <span>Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div className="agent-draft-grid">
            <label>
              <span>City</span>
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </label>
            <label>
              <span>Area</span>
              <input
                value={form.location_area}
                onChange={(event) => setForm({ ...form, location_area: event.target.value })}
              />
            </label>
            <label>
              <span>Type</span>
              <input
                value={form.property_type}
                onChange={(event) => setForm({ ...form, property_type: event.target.value })}
              />
            </label>
            <label>
              <span>Intent</span>
              <select
                value={form.listing_type}
                onChange={(event) =>
                  setForm({ ...form, listing_type: event.target.value as "sale" | "rent" })
                }
              >
                <option value="sale">Sale</option>
                <option value="rent">Rent</option>
              </select>
            </label>
            <label>
              <span>Price PKR</span>
              <input
                inputMode="numeric"
                value={form.price_amount}
                onChange={(event) => setForm({ ...form, price_amount: event.target.value })}
              />
            </label>
            <label>
              <span>Area size</span>
              <div className="agent-draft-inline">
                <input
                  inputMode="decimal"
                  value={form.area_value}
                  onChange={(event) => setForm({ ...form, area_value: event.target.value })}
                />
                <select
                  value={form.area_unit}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      area_unit: event.target.value as DraftFormState["area_unit"]
                    })
                  }
                >
                  <option value="">Unit</option>
                  <option value="kanal">Kanal</option>
                  <option value="marla">Marla</option>
                  <option value="sqft">Sqft</option>
                  <option value="sqm">Sqm</option>
                </select>
              </div>
            </label>
            <label>
              <span>Beds</span>
              <input
                inputMode="numeric"
                value={form.bedrooms}
                onChange={(event) => setForm({ ...form, bedrooms: event.target.value })}
              />
            </label>
            <label>
              <span>Baths</span>
              <input
                inputMode="numeric"
                value={form.bathrooms}
                onChange={(event) => setForm({ ...form, bathrooms: event.target.value })}
              />
            </label>
          </div>
          <label>
            <span>Features</span>
            <input
              value={form.features}
              onChange={(event) => setForm({ ...form, features: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="agent-draft-preview">
          <h3>{previewDraft.title}</h3>
          <p>{previewDraft.description}</p>
          <div className="agent-draft-facts">
            <span>{formatPrice(form.price_amount)}</span>
            <span>{[previewDraft.location_area, previewDraft.city].filter(Boolean).join(", ")}</span>
            <span>
              {[previewDraft.area_value, previewDraft.area_unit].filter(Boolean).join(" ") || "Area not set"}
            </span>
            <span>
              {previewDraft.bedrooms ?? "-"} beds / {previewDraft.bathrooms ?? "-"} baths
            </span>
          </div>
        </div>
      )}

      <div className="agent-media-panel" aria-label="Listing photos and video">
        <div className="agent-media-panel-header">
          <span>Photos & video</span>
          <small>{pendingMedia.length ? `${pendingMedia.length} media ready` : "Optional before saving"}</small>
        </div>
        {pendingMedia.length ? (
          <div className="agent-media-preview">
            {pendingMedia.map((item) => (
              <div className="agent-media-thumb" key={item.id}>
                {item.mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.file.name} />
                ) : (
                  <video src={item.previewUrl} muted playsInline />
                )}
                <button
                  aria-label={`Remove ${item.file.name}`}
                  className="agent-media-remove"
                  type="button"
                  onClick={() => onRemoveMedia(item.id)}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>Add listing photos or a walkthrough video here before confirming the listing.</p>
        )}
        <button className="outline-button small agent-media-add" type="button" onClick={onAttachMedia}>
          <Upload size={14} /> Add photos/video
        </button>
      </div>

      <div className="card-actions">
        <button className="primary-button small" type="button" onClick={handleConfirm} disabled={isSaving}>
          <CheckCircle2 size={15} /> {isSaving ? "Adding..." : "Confirm & add"}
        </button>
        <button className="outline-button small" type="button" onClick={() => setIsEditing(!isEditing)}>
          <Pencil size={14} /> {isEditing ? "Preview" : "Edit card"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function SchedulePreviewCard({
  event,
  onSaved
}: {
  event: BrokerEventDraftInput;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => eventToFormState(event));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const previewEvent = useMemo(() => formStateToEvent(form), [form]);

  async function handleConfirm() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Adding schedule item...");
    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(previewEvent)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to add schedule item");
      setIsSaving(false);
      return;
    }

    setStatus("Added to Schedule.");
    onSaved();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <div className="schedule-preview-card">
      <div className="card-title">
        <CalendarClock size={16} /> Schedule preview
      </div>

      {isEditing ? (
        <div className="agent-draft-form">
          <label>
            <span>Title</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <div className="agent-draft-grid">
            <label>
              <span>Category</span>
              <select
                value={form.event_category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    event_category: event.target.value as EventFormState["event_category"]
                  })
                }
              >
                <option value="appointment">Appointment</option>
                <option value="reminder">Reminder</option>
                <option value="recurring">Recurring</option>
              </select>
            </label>
            <label>
              <span>Type</span>
              <select
                value={form.event_type}
                onChange={(event) =>
                  setForm({ ...form, event_type: event.target.value as EventFormState["event_type"] })
                }
              >
                <option value="viewing">Viewing</option>
                <option value="contract_signing">Contract signing</option>
                <option value="handover">Handover</option>
                <option value="follow_up">Follow-up</option>
                <option value="offer_deadline">Offer deadline</option>
                <option value="document_expiry">Document expiry</option>
                <option value="weekly_review">Weekly review</option>
                <option value="monthly_client_review">Monthly client review</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span>Start</span>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={(event) => setForm({ ...form, start_at: event.target.value })}
              />
            </label>
            <label>
              <span>Reminder</span>
              <input
                type="datetime-local"
                value={form.reminder_at}
                onChange={(event) => setForm({ ...form, reminder_at: event.target.value })}
              />
            </label>
            <label>
              <span>Lead</span>
              <input
                value={form.lead_name}
                onChange={(event) => setForm({ ...form, lead_name: event.target.value })}
              />
            </label>
            <label>
              <span>Listing</span>
              <input
                value={form.listing_reference}
                onChange={(event) => setForm({ ...form, listing_reference: event.target.value })}
              />
            </label>
          </div>
          <label>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="schedule-preview">
          <h3>{previewEvent.title}</h3>
          <p>{previewEvent.description || "No notes yet."}</p>
          <div className="schedule-facts">
            <span>{previewEvent.event_category}</span>
            <span>{previewEvent.event_type.replace(/_/g, " ")}</span>
            <span>{formatEventTime(previewEvent)}</span>
            {previewEvent.lead_name ? <span>{previewEvent.lead_name}</span> : null}
            {previewEvent.listing_reference ? <span>{previewEvent.listing_reference}</span> : null}
          </div>
        </div>
      )}

      <div className="card-actions">
        <button className="primary-button small" type="button" onClick={handleConfirm} disabled={isSaving}>
          <CheckCircle2 size={15} /> {isSaving ? "Adding..." : "Confirm schedule"}
        </button>
        <button className="outline-button small" type="button" onClick={() => setIsEditing(!isEditing)}>
          <Pencil size={14} /> {isEditing ? "Preview" : "Edit card"}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function ScheduleResultsCard({ events }: { events: BrokerEventRecord[] }) {
  return (
    <div className="chat-card schedule-results-card">
      <div className="card-title">
        <CalendarClock size={16} /> Schedule items
      </div>
      {events.length === 0 ? (
        <p>No matching schedule items.</p>
      ) : (
        <div className="event-mini-list">
          {events.map((event) => (
            <div className="event-mini-row" key={event.id}>
              <time dateTime={getScheduleResultTime(event)}>{formatScheduleResultTime(event)}</time>
              <div>
                <strong>{event.title}</strong>
                <small>
                  {[
                    event.event_type.replace(/_/g, " "),
                    event.lead_name,
                    event.listing_reference,
                    event.location_text
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentWorkspace({
  conversationId: initialConversationId,
  firstName,
  hasOlderMessages,
  initialContextAttachments = [],
  initialMessages,
  recentLeads,
  recentListings
}: AgentWorkspaceProps) {
  const [input, setInput] = useState("");
  const [composerMedia, setComposerMedia] = useState<PendingMedia[]>([]);
  const [composerFiles, setComposerFiles] = useState<PendingFileAttachment[]>([]);
  const [contextAttachments, setContextAttachments] = useState<ChatContextAttachment[]>(initialContextAttachments);
  const [contextPickerMode, setContextPickerMode] = useState<"listing" | "lead" | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeListingId, setActiveListingId] = useState<string | null>(
    initialContextAttachments.find((item) => item.type === "listing")?.entity_id ?? recentListings[0]?.id ?? null
  );
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [canLoadOlder, setCanLoadOlder] = useState(hasOlderMessages);
  const [oldestMessageCreatedAt, setOldestMessageCreatedAt] = useState<string | null>(
    initialMessages[0]?.created_at ?? null
  );
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content: `Good morning, ${firstName}. Tell me the property details in English, Urdu, or Roman Urdu. I will draft a listing preview for you to edit and confirm.`
    },
    ...initialMessages.map(chatMessageFromRecord)
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTurnAnchorId, setActiveTurnAnchorId] = useState<string | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceLevels, setVoiceLevels] = useState(idleVoiceLevels);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeTurnAnchorRef = useRef<string | null>(null);
  const activeOutputRef = useRef<string | null>(null);
  const hasPositionedInitialThreadRef = useRef(false);
  const assistantStreamTimersRef = useRef<Map<string, number>>(new Map());
  const composerMediaRef = useRef<PendingMedia[]>([]);
  const pendingMediaRef = useRef<PendingMedia[]>([]);
  const mediaSelectionTargetRef = useRef<"composer" | "draft">("composer");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceAnimationFrameRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasStarted = messages.length > 1;
  const quickActions = [
    {
      icon: House,
      label: "List a Property",
      onClick: () =>
        void submitMessage("Create a listing for 1 Kanal house in DHA Phase 6, price 8.5 crore.")
    },
    {
      icon: Megaphone,
      label: "Promote Listing",
      onClick: () =>
        void submitMessage("Promote my latest listing for WhatsApp, Facebook, Instagram, and portals.")
    },
    {
      icon: UserPlus,
      label: "Add a Lead",
      onClick: () =>
        void submitMessage(
          "Record a new lead named Ahmed. He wants a 5 marla house in DHA Phase 5 with a budget around 1 crore."
        )
    },
    {
      icon: CalendarClock,
      label: "Schedule Viewing",
      onClick: () =>
        void submitMessage("Schedule a viewing with Ahmed tomorrow at 3pm for my DHA Phase 5 villa.")
    }
  ];
  const attachActions = [
    {
      icon: ImageIcon,
      label: "Upload photo/video",
      onClick: openComposerMediaPicker
    },
    {
      icon: FileText,
      label: "Upload file",
      onClick: openDocumentPicker
    },
    {
      icon: House,
      label: "Choose listing",
      onClick: () => setContextPickerMode("listing" as const)
    },
    {
      icon: MessageCircle,
      label: "Choose lead",
      onClick: () => setContextPickerMode("lead" as const)
    }
  ];

  function positionTurnAnchor(messageId: string) {
    const container = messagesContainerRef.current;
    const messageElement = container?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);

    if (!container || !messageElement) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    const anchorOffset = isDesktop ? containerRect.height * 0.2 : containerRect.height * 0.42;
    const currentMessageTop = messageRect.top - containerRect.top;
    const nextScrollTop = container.scrollTop + currentMessageTop - anchorOffset;

    container.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior: "smooth"
    });
  }

  function keepOutputVisible(messageId: string) {
    const container = messagesContainerRef.current;
    const messageElement = container?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);

    if (!container || !messageElement) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    const composerElement = document.querySelector<HTMLElement>(".workspace-agent-composer");
    const composerRect = composerElement?.getBoundingClientRect();
    const composerOverlap =
      composerRect && composerRect.top < containerRect.bottom ? containerRect.bottom - composerRect.top : 0;
    const bottomReserve = Math.max(isDesktop ? 160 : 112, composerOverlap + 28);
    const visibleBottom = containerRect.height - bottomReserve;
    const messageBottom = messageRect.bottom - containerRect.top;

    if (messageBottom > visibleBottom) {
      container.scrollTo({
        top: container.scrollTop + messageBottom - visibleBottom,
        behavior: "smooth"
      });
    }
  }

  useEffect(() => {
    if (!hasStarted) {
      hasPositionedInitialThreadRef.current = false;
      activeTurnAnchorRef.current = null;
      setActiveTurnAnchorId(null);
      activeOutputRef.current = null;
      setActiveOutputId(null);
      return;
    }

    const activeOutput = activeOutputRef.current;
    if (activeOutput) {
      window.requestAnimationFrame(() => keepOutputVisible(activeOutput));
      return;
    }

    const activeTurnAnchor = activeTurnAnchorRef.current;
    if (activeTurnAnchor) {
      window.requestAnimationFrame(() => positionTurnAnchor(activeTurnAnchor));
      return;
    }

    if (!hasPositionedInitialThreadRef.current) {
      hasPositionedInitialThreadRef.current = true;
      window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: "end" }));
    }
  }, [messages, hasStarted]);

  useEffect(() => {
    composerMediaRef.current = composerMedia;
  }, [composerMedia]);

  useEffect(() => {
    pendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  useEffect(() => {
    const assistantStreamTimers = assistantStreamTimersRef.current;

    return () => {
      assistantStreamTimers.forEach((timer) => window.clearInterval(timer));
      assistantStreamTimers.clear();
      composerMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      pendingMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceAnimationFrameRef.current) {
        cancelAnimationFrame(voiceAnimationFrameRef.current);
      }
      if (voiceTimerRef.current) {
        window.clearInterval(voiceTimerRef.current);
      }
      void audioContextRef.current?.close();
    };
  }, []);

  function recentContextMessages() {
    return messages
      .filter((message) => message.content.trim())
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content
      }));
  }

  function addContextAttachment(attachment: ChatContextAttachment) {
    setContextAttachments((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== attachment.id);
      return [...withoutDuplicate, attachment].slice(-8);
    });

    if (attachment.type === "listing") {
      setActiveListingId(attachment.entity_id);
    }
  }

  function addListingContext(listing: RecentListingSummary) {
    addContextAttachment(listingToContextAttachment(listing));
    setContextPickerMode(null);
  }

  function addLeadContext(lead: LeadListItem) {
    addContextAttachment(leadToContextAttachment(lead));
    setContextPickerMode(null);
  }

  function removeContextAttachment(contextId: string) {
    setContextAttachments((current) => current.filter((item) => item.id !== contextId));
  }

  function removeComposerFile(fileId: string) {
    setComposerFiles((current) => current.filter((item) => item.id !== fileId));
  }

  function selectedContextEntityId(type: ChatContextAttachment["type"]) {
    return [...contextAttachments].reverse().find((item) => item.type === type)?.entity_id;
  }

  function composerContextPreviews(): AgentComposerContextPreview[] {
    return contextAttachments.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      summary: item.summary
    }));
  }

  async function persistAssistantMessage(message: ChatMessage) {
    try {
      const response = await fetch("/api/agent/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversationId,
          role: "assistant",
          content: message.content,
          structured_payload: structuredPayloadForMessage(message)
        })
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { conversationId?: string };
      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }
    } catch {
      // Persistence should not block the broker's current workflow.
    }
  }

  async function persistUserMessage(message: ChatMessage) {
    try {
      const response = await fetch("/api/agent/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversationId,
          role: "user",
          content: message.content
        })
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { conversationId?: string };
      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }
    } catch {
      // Persistence should not block the broker's current workflow.
    }
  }

  function appendUserMessage(
    content: string,
    options: {
      attachments?: PendingMedia[];
      contextAttachments?: ChatContextAttachment[];
      fileAttachments?: PendingFileAttachment[];
      persist?: boolean;
    } = {}
  ) {
    const nextMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content,
      attachments: options.attachments,
      contextAttachments: options.contextAttachments,
      fileAttachments: options.fileAttachments
    };

    setMessages((current) => [...current, nextMessage]);

    if (options.persist !== false) {
      void persistUserMessage(nextMessage);
    }

    return nextMessage;
  }

  function animateAssistantMessage(messageId: string, content: string) {
    const characters = Array.from(content);

    if (!characters.length) {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, content, isStreaming: false } : message
        )
      );
      return;
    }

    const existingTimer = assistantStreamTimersRef.current.get(messageId);
    if (existingTimer) {
      window.clearInterval(existingTimer);
    }

    let cursor = 0;
    const charactersPerTick = characters.length > 180 ? 3 : 2;
    const timer = window.setInterval(() => {
      cursor = Math.min(characters.length, cursor + charactersPerTick);
      const visibleContent = characters.slice(0, cursor).join("");
      const isDone = cursor >= characters.length;

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, content: visibleContent, isStreaming: !isDone }
            : message
        )
      );

      if (isDone) {
        window.clearInterval(timer);
        assistantStreamTimersRef.current.delete(messageId);
      }
    }, 18);

    assistantStreamTimersRef.current.set(messageId, timer);
  }

  function appendAssistantMessage(message: Omit<ChatMessage, "id" | "role"> & { id?: string }) {
    const nextMessage: ChatMessage = {
      ...message,
      id: message.id ?? createId(),
      role: "assistant"
    };
    const streamingMessage: ChatMessage = {
      ...nextMessage,
      content: "",
      isStreaming: true
    };

    activeOutputRef.current = nextMessage.id;
    setActiveOutputId(nextMessage.id);
    setMessages((current) => [...current, streamingMessage]);
    window.setTimeout(() => animateAssistantMessage(nextMessage.id, nextMessage.content), 80);
    void persistAssistantMessage(nextMessage);

    return nextMessage;
  }

  async function loadEarlierMessages() {
    if (!oldestMessageCreatedAt || isLoadingOlder) {
      return;
    }

    setIsLoadingOlder(true);

    try {
      const params = new URLSearchParams({
        before: oldestMessageCreatedAt,
        limit: "50"
      });
      const response = await fetch(`/api/agent/messages?${params.toString()}`);

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        conversationId?: string;
        messages?: AgentChatMessageRecord[];
        hasMore?: boolean;
      };
      const olderMessages = payload.messages ?? [];

      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }

      setCanLoadOlder(Boolean(payload.hasMore));
      setOldestMessageCreatedAt(olderMessages[0]?.created_at ?? oldestMessageCreatedAt);

      if (!olderMessages.length) {
        return;
      }

      const parsedMessages = olderMessages.map(chatMessageFromRecord);
      setMessages((current) => {
        const [welcomeMessage, ...currentHistory] = current;
        const seenIds = new Set(current.map((message) => message.id));
        const newOlderMessages = parsedMessages.filter((message) => !seenIds.has(message.id));

        return [welcomeMessage, ...newOlderMessages, ...currentHistory];
      });
    } finally {
      setIsLoadingOlder(false);
    }
  }

  function stopVoiceVisualization() {
    if (voiceAnimationFrameRef.current) {
      cancelAnimationFrame(voiceAnimationFrameRef.current);
      voiceAnimationFrameRef.current = null;
    }

    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function startVoiceVisualization(stream: MediaStream) {
    stopVoiceVisualization();
    setRecordingSeconds(0);
    setVoiceLevels(idleVoiceLevels);

    voiceTimerRef.current = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current ?? Date.now();
      setRecordingSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 250);

    try {
      const AudioContextConstructor = window.AudioContext;
      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.58;
      const dataArray = new Uint8Array(analyser.fftSize);
      let lastPaintedAt = 0;

      source.connect(analyser);
      audioContextRef.current = audioContext;
      void audioContext.resume();

      const draw = (timestamp: number) => {
        voiceAnimationFrameRef.current = requestAnimationFrame(draw);

        if (timestamp - lastPaintedAt < 48) {
          return;
        }

        lastPaintedAt = timestamp;
        analyser.getByteTimeDomainData(dataArray);

        const chunkSize = Math.max(1, Math.floor(dataArray.length / waveformBarCount));
        const nextLevels = Array.from({ length: waveformBarCount }, (_, index) => {
          const start = index * chunkSize;
          const slice = dataArray.slice(start, start + chunkSize);
          const rms = Math.sqrt(
            slice.reduce((sum, value) => {
              const centered = (value - 128) / 128;
              return sum + centered * centered;
            }, 0) / Math.max(1, slice.length)
          );
          const shapedLevel = Math.pow(Math.min(1, rms * 5.2), 0.76);
          const liveFlutter = Math.sin(timestamp * 0.018 + index * 0.72) * 0.08;

          return Math.max(0.1, Math.min(1, shapedLevel + liveFlutter + 0.12));
        });

        setVoiceLevels(nextLevels);
      };

      voiceAnimationFrameRef.current = requestAnimationFrame(draw);
    } catch {
      let frame = 0;
      const drawFallback = () => {
        frame += 1;
        setVoiceLevels(
          idleVoiceLevels.map((level, index) =>
            Math.max(0.14, Math.min(0.92, level + Math.sin(frame * 0.18 + index * 0.65) * 0.16))
          )
        );
        voiceAnimationFrameRef.current = requestAnimationFrame(drawFallback);
      };

      voiceAnimationFrameRef.current = requestAnimationFrame(drawFallback);
    }
  }

  function candidateToListing(candidate: ListingResolutionCandidate): RecentListingSummary {
    return {
      id: candidate.id,
      status: candidate.status as RecentListingSummary["status"],
      title: candidate.listing_title ?? candidate.label,
      description: candidate.description ?? null,
      location_area: candidate.location_area ?? candidate.listing_area ?? null,
      city: candidate.city ?? candidate.listing_city ?? null,
      property_type: candidate.property_type ?? null,
      listing_type: candidate.listing_type ?? null,
      price_amount: candidate.price_amount ?? null,
      price_currency: candidate.price_currency ?? null,
      area_value: candidate.area_value ?? null,
      area_unit: candidate.area_unit ?? null,
      bedrooms: candidate.bedrooms ?? null,
      bathrooms: candidate.bathrooms ?? null,
      features: candidate.features ?? null
    };
  }

  function formatListingCandidates(candidates: ListingResolutionCandidate[]) {
    return candidates
      .map((candidate) =>
        [
          candidate.label,
          [candidate.area_value, candidate.area_unit].filter(Boolean).join(" "),
          candidate.location_area ?? candidate.listing_area
        ]
          .filter(Boolean)
          .join(" · ")
      )
      .filter(Boolean)
      .join(", ");
  }

  function getPromotionTarget(messageText: string, resolution?: AgentResolution) {
    if (resolution?.status === "ambiguous") {
      return { listing: null, ambiguous: true, candidates: resolution.candidates ?? [] };
    }

    if (resolution?.status === "no_match" || resolution?.status === "needs_clarification") {
      return { listing: null, ambiguous: false, candidates: [] };
    }

    if (resolution?.status === "matched") {
      const matchedListing =
        recentListings.find((listing) => listing.id === resolution.target_id) ??
        (resolution.matched ? candidateToListing(resolution.matched) : null);

      return { listing: matchedListing, ambiguous: false, candidates: [] };
    }

    if (messageMentionsCurrentListing(messageText) && activeListingId) {
      return {
        listing: recentListings.find((listing) => listing.id === activeListingId) ?? null,
        ambiguous: false,
        candidates: []
      };
    }

    const scoredListings = recentListings
      .map((listing) => ({ listing, score: scoreListingMatch(messageText, listing) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    if (scoredListings.length > 1 && scoredListings[0].score === scoredListings[1].score) {
      return {
        listing: null,
        ambiguous: true,
        candidates: scoredListings.slice(0, 5).map((item) => ({
          id: item.listing.id,
          label: item.listing.title || "Untitled listing",
          listing_title: item.listing.title,
          listing_area: item.listing.location_area,
          listing_city: item.listing.city,
          city: item.listing.city,
          location_area: item.listing.location_area,
          property_type: item.listing.property_type,
          area_value: item.listing.area_value,
          area_unit: item.listing.area_unit,
          bedrooms: item.listing.bedrooms
        }))
      };
    }

    if (scoredListings[0]) {
      return { listing: scoredListings[0].listing, ambiguous: false, candidates: [] };
    }

    return {
      listing: recentListings.find((listing) => listing.id === activeListingId) ?? recentListings[0] ?? null,
      ambiguous: false,
      candidates: []
    };
  }

  function proposePromotionFromMessage(messageText: string, resolution?: AgentResolution) {
    const target = getPromotionTarget(messageText, resolution);

    if (target.ambiguous) {
      const candidateText = formatListingCandidates(target.candidates);
      appendAssistantMessage({
        content: candidateText
          ? `I found more than one matching listing: ${candidateText}. Please add one more detail, like phase, exact area size, price, or bedrooms.`
          : "I found more than one matching listing. Please add one more detail, like phase, exact area size, price, or bedrooms."
      });
      return;
    }

    if (!target.listing) {
      appendAssistantMessage({
        content: "I need a confirmed listing before I can create a promotion pack. Describe a property first, confirm it, then ask me to promote it."
      });
      return;
    }

    const selectedListing = target.listing;

    setActiveListingId(selectedListing.id);
    appendAssistantMessage({
      content: "I found a matching listing. Please confirm the property and choose channels before I generate campaign links.",
      promotionTarget: selectedListing,
      promotionInstruction: messageText,
      promotionChannels: extractPromotionChannels(messageText)
    });
  }

  function getListingUpdateTarget(messageText: string, payload: ListingUpdatePayload, resolution?: AgentResolution) {
    if (resolution?.status === "ambiguous") {
      return { listing: null, ambiguous: true, candidates: resolution.candidates ?? [] };
    }

    if (resolution?.status === "no_match" || resolution?.status === "needs_clarification") {
      return { listing: null, ambiguous: false, candidates: [] };
    }

    if (resolution?.status === "matched") {
      const matchedListing =
        recentListings.find((listing) => listing.id === resolution.target_id) ??
        (resolution.matched ? candidateToListing(resolution.matched) : null);

      return { listing: matchedListing, ambiguous: false, candidates: [] };
    }

    if (payload.listing_id) {
      return {
        listing: recentListings.find((listing) => listing.id === payload.listing_id) ?? null,
        ambiguous: false,
        candidates: []
      };
    }

    if (messageMentionsCurrentListing(messageText) && activeListingId) {
      return {
        listing: recentListings.find((listing) => listing.id === activeListingId) ?? null,
        ambiguous: false,
        candidates: []
      };
    }

    return { listing: null, ambiguous: false, candidates: [] };
  }

  function proposeListingUpdateFromMessage(
    actionResponse: string,
    messageText: string,
    payload: ListingUpdatePayload,
    resolution?: AgentResolution
  ) {
    const changes = listingUpdatePayloadToChanges(payload);
    const target = getListingUpdateTarget(messageText, payload, resolution);

    if (!hasListingUpdateChanges(changes)) {
      appendAssistantMessage({
        content:
          "I found the listing request, but I could not identify which field to change. Tell me the new price, title, area, beds, baths, status, or description."
      });
      return;
    }

    if (target.ambiguous) {
      appendAssistantMessage({
        content: "I found multiple matching listings. Choose the exact property before I update anything.",
        listingUpdateChoices: {
          candidates: target.candidates.map((candidate) => candidateToListing(candidate)),
          changes,
          actionResponse
        }
      });
      return;
    }

    if (!target.listing) {
      appendAssistantMessage({
        content:
          "I could not find the listing to update. Please add the exact title, area, size, bedrooms, or use the listing card before changing it."
      });
      return;
    }

    setActiveListingId(target.listing.id);
    appendAssistantMessage({
      content: actionResponse,
      listingUpdate: {
        listing: target.listing,
        changes
      }
    });
  }

  function candidateToLead(candidate: AgentResolutionCandidate): LeadListItem {
    return {
      id: candidate.id,
      broker_id: "",
      listing_id: null,
      campaign_link_id: null,
      source_channel: null,
      full_name: candidate.label === "Unnamed buyer" ? null : candidate.label,
      phone: candidate.phone ?? null,
      email: candidate.email ?? null,
      message: null,
      status: (candidate.status as LeadRecord["status"] | undefined) ?? "new",
      urgency: null,
      ai_summary: null,
      created_at: new Date().toISOString(),
      updated_at: null,
      listing_title: candidate.listing_title ?? null,
      listing_area: candidate.listing_area ?? null,
      listing_city: candidate.listing_city ?? null,
      campaign_code: null,
      campaign_channel: null
    };
  }

  function getLeadTarget(payload: LeadOperationPayload, resolution?: AgentResolution) {
    if (resolution?.status === "ambiguous") {
      return { lead: null, ambiguous: true, candidates: resolution.candidates ?? [] };
    }

    if (resolution?.status === "no_match" || resolution?.status === "needs_clarification") {
      return { lead: null, ambiguous: false, candidates: [] };
    }

    if (resolution?.status === "matched") {
      const matchedLead =
        recentLeads.find((lead) => lead.id === resolution.target_id) ??
        (resolution.matched ? candidateToLead(resolution.matched) : null);

      return { lead: matchedLead, ambiguous: false, candidates: [] };
    }

    if (payload.lead_id) {
      return {
        lead: recentLeads.find((lead) => lead.id === payload.lead_id) ?? null,
        ambiguous: false,
        candidates: []
      };
    }

    const query = [payload.lead_name, payload.query].filter(Boolean).join(" ");
    const scoredLeads = recentLeads
      .map((lead) => ({ lead, score: scoreLeadMatch(query, lead) }))
      .filter((item) => item.score >= 4)
      .sort((left, right) => right.score - left.score);

    if (
      scoredLeads.length > 1 &&
      (scoredLeads[0].score === scoredLeads[1].score || scoredLeads[0].score - scoredLeads[1].score < 3)
    ) {
      return {
        lead: null,
        ambiguous: true,
        candidates: scoredLeads.slice(0, 5).map((item) => ({
          id: item.lead.id,
          label: item.lead.full_name || item.lead.phone || item.lead.email || "Unnamed buyer",
          phone: item.lead.phone,
          email: item.lead.email,
          status: item.lead.status,
          listing_title: item.lead.listing_title,
          listing_area: item.lead.listing_area,
          listing_city: item.lead.listing_city
        }))
      };
    }

    if (scoredLeads[0]) {
      return { lead: scoredLeads[0].lead, ambiguous: false, candidates: [] };
    }

    return { lead: null, ambiguous: false, candidates: [] };
  }

  function showLeadResults(actionResponse: string, payload: LeadOperationPayload) {
    const matchedLeads = filterLeadsByPayload(recentLeads, payload);

    if (!matchedLeads.length) {
      appendAssistantMessage({
        content:
          "I could not find a lead matching that request. I will not show unrelated records unless you confirm.",
        leadLatestOffer: recentLeads.length > 0
      });
      return;
    }

    appendAssistantMessage({
      content: actionResponse,
      leadResults: matchedLeads
    });
  }

  async function showScheduleResults(actionResponse: string, payload: ScheduleEventListPayload) {
    const params = new URLSearchParams({
      status: payload.status,
      limit: String(payload.limit)
    });
    const range = getScheduleDateRange(payload.date_filter);

    if (payload.event_type !== "all") {
      params.set("event_type", payload.event_type);
    }

    if (range.from) {
      params.set("from", range.from);
    }

    if (range.to) {
      params.set("to", range.to);
    }

    const response = await fetch(`/api/events?${params.toString()}`);
    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        content: errorPayload?.error ?? "I could not read your schedule yet. Please try again in a moment."
      });
      return;
    }

    const result = (await response.json()) as { events?: BrokerEventRecord[]; migration_required?: boolean };
    if (result.migration_required) {
      appendAssistantMessage({
        content: "Schedule storage is not ready yet. Please run the broker events migration first."
      });
      return;
    }

    appendAssistantMessage({
      content: actionResponse,
      scheduleEvents: result.events ?? []
    });
  }

  function formatResolutionCandidates(candidates: AgentResolutionCandidate[]) {
    return candidates
      .map((candidate) => [candidate.label, candidate.phone].filter(Boolean).join(" · "))
      .filter(Boolean)
      .join(", ");
  }

  function showScheduleResolutionMessage(resolution?: AgentResolution) {
    if (!resolution || resolution.status === "matched") {
      return false;
    }

    const isListingTarget = resolution.target_type === "listing";
    const candidateText = isListingTarget
      ? formatListingCandidates(resolution.candidates ?? [])
      : formatResolutionCandidates(resolution.candidates ?? []);

    const content =
      resolution.status === "ambiguous"
        ? candidateText
          ? `I found more than one matching ${isListingTarget ? "listing" : "lead"}: ${candidateText}. Please add one more detail before I schedule it.`
          : `I found more than one matching ${isListingTarget ? "listing" : "lead"}. Please add one more detail before I schedule it.`
        : resolution.status === "needs_clarification"
          ? isListingTarget
            ? "I need to know which listing this schedule item is for before I can prepare it."
            : "I need to know which lead or client this schedule item is for before I can prepare it."
          : isListingTarget
            ? "I could not find the listing for this schedule item. Please add the exact area, title, size, or use the listing card."
            : "I could not find the lead for this schedule item. Please add the buyer name, phone number, or open Leads to choose the exact record.";

    appendAssistantMessage({ content });

    return true;
  }

  function proposeLeadStatusUpdate(
    actionResponse: string,
    payload: LeadOperationPayload,
    resolution?: AgentResolution
  ) {
    const target = getLeadTarget(payload, resolution);

    if (target.ambiguous) {
      const candidateText = formatResolutionCandidates(target.candidates);
      appendAssistantMessage({
        content: candidateText
          ? `I found more than one matching lead: ${candidateText}. Please add the buyer phone, full name, or listing detail.`
          : "I found more than one matching lead. Please add the buyer phone, full name, or listing detail."
      });
      return;
    }

    if (!target.lead) {
      const requestedLead = payload.lead_name ? ` "${payload.lead_name}"` : "";
      appendAssistantMessage({
        content: `I could not find a matching recent lead${requestedLead}. Please check the buyer name, phone number, or open Leads to choose the exact record.`
      });
      return;
    }

    const matchedLead = target.lead;

    appendAssistantMessage({
      content: actionResponse,
      leadStatusUpdate: {
        lead: matchedLead,
        status: payload.status,
        urgency: payload.urgency
      }
    });
  }

  function proposeLeadDetailsUpdate(
    actionResponse: string,
    payload: LeadDetailsUpdatePayload,
    resolution?: AgentResolution
  ) {
    const target = getLeadTarget(payload, resolution);
    const changes = leadDetailsPayloadToChanges(payload);

    if (!hasLeadDetailsUpdateChanges(changes)) {
      appendAssistantMessage({
        content:
          "I found the lead edit request, but I could not identify which detail to change. Tell me the new phone, email, name, or message."
      });
      return;
    }

    if (target.ambiguous) {
      const candidateText = formatResolutionCandidates(target.candidates);
      appendAssistantMessage({
        content: candidateText
          ? `I found more than one matching lead: ${candidateText}. Please choose the exact lead before I update contact details.`
          : "I found more than one matching lead. Please choose the exact lead before I update contact details."
      });
      return;
    }

    if (!target.lead) {
      const requestedLead = payload.lead_name ? ` "${payload.lead_name}"` : "";
      appendAssistantMessage({
        content: `I could not find a matching recent lead${requestedLead}. Please check the buyer name, phone number, or open Leads to choose the exact record.`
      });
      return;
    }

    appendAssistantMessage({
      content: actionResponse,
      leadDetailsUpdate: {
        lead: target.lead,
        changes
      }
    });
  }

  function proposeLeadCreate(payload: LeadCreatePayload) {
    if (!payload.full_name && !payload.phone && !payload.email) {
      appendAssistantMessage({
        content: "I can create a lead, but I need at least a buyer name, phone, or email."
      });
      return;
    }

    appendAssistantMessage({
      content: "I prepared a new lead. Please confirm before I save it.",
      leadCreate: {
        payload: {
          ...payload,
          status: payload.status ?? "new",
          urgency: payload.urgency ?? "normal",
          source_channel: payload.source_channel ?? "manual"
        }
      }
    });
  }

  function proposeBatchLeadStatusUpdate(messageText: string, leadContexts: ChatContextAttachment[]) {
    const nextStatus = leadStatusFromMessage(messageText);
    const leads = leadContexts
      .map((context) => recentLeads.find((lead) => lead.id === context.entity_id))
      .filter((lead): lead is LeadListItem => Boolean(lead));

    if (!nextStatus?.status || !leads.length) {
      appendAssistantMessage({
        content:
          "I attached those leads, but I need a clear status before I can prepare a batch update. Try contacted, hot, qualified, closed, lost, or new."
      });
      return;
    }

    appendAssistantMessage({
      content: "I prepared a batch lead status update. Please confirm before I change these records.",
      leadBatchStatusUpdate: {
        leads,
        ...nextStatus
      }
    });
  }

  function proposeLeadListingUpdate(
    actionResponse: string,
    payload: LeadListingUpdatePayload,
    resolution?: AgentResolution
  ) {
    const target = getLeadTarget(payload, resolution);

    if (resolution?.target_type === "listing" && resolution.status === "ambiguous") {
      appendAssistantMessage({
        content: "I found more than one matching listing. Choose the exact property before I update the lead."
      });
      return;
    }

    if (resolution?.target_type === "listing" && resolution.status !== "matched") {
      appendAssistantMessage({
        content: "I need a confirmed listing before I can change this lead's primary listing. Select a listing card or add more property details."
      });
      return;
    }

    if (target.ambiguous) {
      const candidateText = formatResolutionCandidates(target.candidates);
      appendAssistantMessage({
        content: candidateText
          ? `I found more than one matching lead: ${candidateText}. Please choose the exact lead before I update its listing.`
          : "I found more than one matching lead. Please choose the exact lead before I update its listing."
      });
      return;
    }

    if (!target.lead) {
      appendAssistantMessage({
        content: "I need a confirmed lead before I can change the primary listing. Select a lead card or add the buyer name or phone."
      });
      return;
    }

    const listing = payload.listing_id
      ? recentListings.find((item) => item.id === payload.listing_id)
      : null;

    if (!listing) {
      appendAssistantMessage({
        content: "I need a confirmed listing before I can change this lead's primary listing. Select a listing card or add more property details."
      });
      return;
    }

    appendAssistantMessage({
      content: actionResponse,
      leadListingUpdate: {
        lead: target.lead,
        listing
      }
    });
  }

  async function draftReplyForLead(
    actionResponse: string,
    payload: LeadOperationPayload,
    resolution?: AgentResolution
  ) {
    const target = getLeadTarget(payload, resolution);

    if (target.ambiguous) {
      const candidateText = formatResolutionCandidates(target.candidates);
      appendAssistantMessage({
        content: candidateText
          ? `I found more than one matching lead: ${candidateText}. Please add the buyer phone, full name, or listing detail.`
          : "I found more than one matching lead. Please add the buyer phone, full name, or listing detail."
      });
      return;
    }

    if (!target.lead) {
      const requestedLead = payload.lead_name ? ` "${payload.lead_name}"` : "";
      appendAssistantMessage({
        content: `I could not find a matching recent lead${requestedLead} to reply to. Please check the buyer name, phone number, or open Leads to choose the exact record.`
      });
      return;
    }

    const matchedLead = target.lead;

    appendAssistantMessage({
      content: `I found ${matchedLead.full_name || "the buyer"}. Drafting a WhatsApp reply now...`
    });

    const response = await fetch("/api/leads/reply-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lead_id: matchedLead.id })
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        content: errorPayload?.error ?? "I could not draft a reply for that lead yet."
      });
      return;
    }

    const replyPayload = (await response.json()) as { draft: LeadReplyDraftWithLink };
    appendAssistantMessage({
      content: actionResponse,
      leadReply: replyPayload.draft
    });
  }

  async function generatePromotionForListing(
    listing: RecentListingSummary,
    instruction: string,
    channels: PromotionChannel[]
  ) {
    setActiveListingId(listing.id);
    appendAssistantMessage({
      content: `Confirmed. I am creating ${channels.length} channel campaign link${channels.length === 1 ? "" : "s"} and promotion copy for ${listing.title || "this listing"}...`
    });

    const response = await fetch("/api/agent/promote-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ listing_id: listing.id, instruction, channels })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        content: payload?.error ?? "I could not generate the promotion pack yet. Please try again."
      });
      return;
    }

    const payload = (await response.json()) as { promotion: ListingPromotion };
    appendAssistantMessage({
      content: "Here is the promotion pack. Each channel has its own lead page, so later we can attribute leads by listing and channel.",
      promotion: payload.promotion
    });
  }

  async function submitMessage(messageText: string) {
    const trimmed = messageText.trim();
    const outgoingMedia = composerMedia;
    const outgoingFiles = composerFiles;
    const outgoingContext = contextAttachments;
    const hasOutgoingMedia = outgoingMedia.length > 0;
    const hasOutgoingFiles = outgoingFiles.length > 0;
    const hasOutgoingContext = outgoingContext.length > 0;

    if ((!trimmed && !hasOutgoingMedia && !hasOutgoingFiles && !hasOutgoingContext) || isSubmitting) {
      return;
    }

    const mediaSummary = hasOutgoingMedia
      ? `Attached ${outgoingMedia.length} listing media file${outgoingMedia.length === 1 ? "" : "s"}.`
      : "";
    const fileSummary = summarizeFileAttachments(outgoingFiles);
    const contextSummary = summarizeContextAttachments(outgoingContext);
    const userMessageContent = trimmed || mediaSummary;
    const visibleUserMessageContent = [userMessageContent, fileSummary, contextSummary].filter(Boolean).join("\n\n");
    const agentMessageContent = [trimmed, mediaSummary, fileSummary, contextSummary].filter(Boolean).join("\n\n");
    const currentListingId = selectedContextEntityId("listing") ?? activeListingId ?? undefined;
    const currentLeadId = selectedContextEntityId("lead") ?? undefined;

    setInput("");
    setComposerMedia([]);
    setComposerFiles([]);
    setContextAttachments([]);
    setIsSubmitting(true);
    if (hasOutgoingMedia) {
      setPendingMedia((current) => [...current, ...outgoingMedia]);
    }
    const userMessage = appendUserMessage(visibleUserMessageContent, {
      attachments: outgoingMedia,
      contextAttachments: outgoingContext,
      fileAttachments: outgoingFiles,
      persist: false
    });
    activeTurnAnchorRef.current = userMessage.id;
    activeOutputRef.current = null;
    setActiveTurnAnchorId(userMessage.id);
    setActiveOutputId(null);
    window.requestAnimationFrame(() => positionTurnAnchor(userMessage.id));

    if (!trimmed) {
      appendAssistantMessage({
        content: hasOutgoingMedia
          ? activeDraftId
            ? "I added these media files to the current listing preview. They will upload when you confirm the listing."
            : "I can use these as listing media. Please add the property details, and I will draft the listing with these files attached."
          : "I attached that context. Tell me what you want to do with it, for example edit it, draft a reply, promote it, or schedule a follow-up."
      });
      setIsSubmitting(false);
      return;
    }

    const selectedLeadContexts = outgoingContext.filter((item) => item.type === "lead");
    if (selectedLeadContexts.length > 1 && looksLikeBulkLeadWrite(trimmed)) {
      if (looksLikeBulkLeadStatusUpdate(trimmed)) {
        proposeBatchLeadStatusUpdate(trimmed, selectedLeadContexts);
        setIsSubmitting(false);
        return;
      }

      appendAssistantMessage({
        content:
          "I attached those leads, but bulk replies and follow-up scheduling need their own batch preview before I create anything. I can handle one selected lead now, or we can add those batch workflows next."
      });
      setIsSubmitting(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch("/api/agent/message", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversationId,
          message: agentMessageContent,
          current_listing_id: currentListingId,
          current_lead_id: currentLeadId,
          context_attachments: outgoingContext,
          context_messages: recentContextMessages()
        })
      });
      clearTimeout(timeout);

      if (!response.ok) {
        appendAssistantMessage({
          content: "I could not draft that listing yet. Please try again with location, size, and price."
        });
        return;
      }

      const payload = (await response.json()) as {
        action: AgentAction;
        conversationId?: string;
      };
      if (payload.conversationId) {
        setConversationId(payload.conversationId);
      }

      const draft =
        payload.action.intent === "create_listing_draft"
          ? (payload.action.payload as ListingDraftInput)
          : undefined;
      const scheduleEvent =
        payload.action.intent === "create_schedule_event"
          ? (payload.action.payload as BrokerEventDraftInput)
          : undefined;
      const leadPayload = payload.action.payload as LeadOperationPayload | undefined;

      if (payload.action.intent === "create_lead") {
        proposeLeadCreate(payload.action.payload as LeadCreatePayload);
        return;
      }

      if (payload.action.intent === "list_leads" && leadPayload) {
        showLeadResults(payload.action.response, leadPayload);
        return;
      }

      if (payload.action.intent === "list_schedule_events") {
        await showScheduleResults(
          payload.action.response,
          payload.action.payload as ScheduleEventListPayload
        );
        return;
      }

      if (payload.action.intent === "update_lead_status" && leadPayload) {
        proposeLeadStatusUpdate(payload.action.response, leadPayload, payload.action.resolution);
        return;
      }

      if (payload.action.intent === "update_lead_details") {
        proposeLeadDetailsUpdate(
          payload.action.response,
          payload.action.payload as LeadDetailsUpdatePayload,
          payload.action.resolution
        );
        return;
      }

      if (payload.action.intent === "update_lead_listing") {
        proposeLeadListingUpdate(
          payload.action.response,
          payload.action.payload as LeadListingUpdatePayload,
          payload.action.resolution
        );
        return;
      }

      if (payload.action.intent === "draft_lead_reply" && leadPayload) {
        await draftReplyForLead(payload.action.response, leadPayload, payload.action.resolution);
        return;
      }

      if (payload.action.intent === "create_campaign_links") {
        proposePromotionFromMessage(agentMessageContent, payload.action.resolution);
        return;
      }

      if (payload.action.intent === "update_listing_draft") {
        proposeListingUpdateFromMessage(
          payload.action.response,
          agentMessageContent,
          payload.action.payload as ListingUpdatePayload,
          payload.action.resolution
        );
        return;
      }

      if (
        payload.action.intent === "create_schedule_event" &&
        showScheduleResolutionMessage(payload.action.resolution)
      ) {
        return;
      }

      const assistantMessageId = createId();

      if (draft) {
        setActiveDraftId(assistantMessageId);
      }

      appendAssistantMessage({
        id: assistantMessageId,
        content: payload.action.response,
        draft,
        scheduleEvent
      });
    } catch {
      appendAssistantMessage({
        content: "I could not reach the agent service. Please try again in a moment."
      });
    } finally {
      clearTimeout(timeout);
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  async function transcribeVoiceNote(audioBlob: Blob, durationSeconds: number) {
    setIsTranscribing(true);

    const formData = new FormData();
    const fileName = getVoiceFileName(audioBlob.type);
    formData.append("audio", new File([audioBlob], fileName, { type: audioBlob.type || "audio/webm" }));
    formData.append("duration_seconds", String(durationSeconds));

    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        transcript?: string;
        storage_saved?: boolean;
      } | null;

      if (!response.ok || !payload?.transcript) {
        appendAssistantMessage({
          content:
            payload?.error ??
            "I could not transcribe that voice note yet. Please try again or type the property details."
        });
        return;
      }

      setInput(payload.transcript);
      await submitMessage(payload.transcript);
    } catch {
      appendAssistantMessage({
        content: "I could not reach the voice transcription service. Please try again in a moment."
      });
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      appendAssistantMessage({
        content: "Voice recording is not available in this browser. You can type the listing details for now."
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      voiceChunksRef.current = [];
      voiceStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      startVoiceVisualization(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const durationSeconds = Math.max(
          1,
          Math.round(((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000))
        );
        const audioBlob = new Blob(voiceChunksRef.current, { type: recordedType });

        stopVoiceVisualization();
        setVoiceLevels(idleVoiceLevels);
        setRecordingSeconds(durationSeconds);
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = null;
        setIsListening(false);

        if (audioBlob.size === 0) {
          appendAssistantMessage({
            content: "I did not capture any audio. Please try recording again."
          });
          return;
        }

        void transcribeVoiceNote(audioBlob, durationSeconds);
      };

      recorder.start();
      setIsListening(true);
    } catch {
      stopVoiceVisualization();
      setIsListening(false);
      appendAssistantMessage({
        content: "I could not access the microphone. Please allow microphone permission and try again."
      });
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function handleVoiceInput() {
    if (isTranscribing) {
      return;
    }

    if (isListening) {
      stopVoiceRecording();
      return;
    }

    void startVoiceRecording();
  }

  function handleMediaSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const accepted = Array.from(files)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .map((file) => ({
        id: createId(),
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: file.type.startsWith("image/") ? ("image" as const) : ("video" as const)
      }));

    if (!accepted.length) {
      appendAssistantMessage({
        content: "I can attach images or videos to a listing. Please choose media files."
      });
      mediaSelectionTargetRef.current = "composer";
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (mediaSelectionTargetRef.current === "draft" && activeDraftId) {
      setPendingMedia((current) => [...current, ...accepted]);
      appendAssistantMessage({
        content:
          "I added these media files to the current listing preview. They will upload when you confirm the listing."
      });
    } else {
      setComposerMedia((current) => [...current, ...accepted]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    mediaSelectionTargetRef.current = "composer";
  }

  function handleDocumentSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const accepted = Array.from(files).map((file) => ({
      id: createId(),
      file
    }));

    setComposerFiles((current) => [...current, ...accepted].slice(-8));

    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = "";
    }
  }

  function openComposerMediaPicker() {
    mediaSelectionTargetRef.current = "composer";
    fileInputRef.current?.click();
  }

  function openDocumentPicker() {
    documentFileInputRef.current?.click();
  }

  function openDraftMediaPicker() {
    mediaSelectionTargetRef.current = "draft";
    fileInputRef.current?.click();
  }

  function removeComposerMedia(mediaId: string) {
    setComposerMedia((current) => {
      const item = current.find((media) => media.id === mediaId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return current.filter((media) => media.id !== mediaId);
    });
  }

  function removePendingMedia(mediaId: string) {
    setPendingMedia((current) => {
      return current.filter((media) => media.id !== mediaId);
    });
  }

  function clearPendingMedia() {
    setPendingMedia([]);
  }

  return (
    <section className={`chat-panel ${hasStarted ? "has-thread" : "is-empty"} ${activeTurnAnchorId || activeOutputId ? "has-active-turn" : ""}`}>
      <div className="messages" ref={messagesContainerRef}>
        {!hasStarted ? (
          <div className="agent-start">
            <h2>What should we handle today?</h2>
            <p>Built for Pakistan&apos;s Property Agents</p>
          </div>
        ) : null}

        {hasStarted && canLoadOlder ? (
          <button
            className="load-earlier-messages"
            disabled={isLoadingOlder}
            type="button"
            onClick={() => void loadEarlierMessages()}
          >
            {isLoadingOlder ? "Loading earlier messages..." : "View earlier messages"}
          </button>
        ) : null}

        {messages.map((message, index) => (
          index === 0 ? null : (
          <article className={`message ${message.role}`} data-message-id={message.id} key={message.id}>
            <p>{message.content}</p>
            {message.attachments?.length ? (
              <div className="message-media-preview" aria-label="Sent media">
                {message.attachments.map((item) => (
                  <div className="message-media-thumb" key={item.id}>
                    {item.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={item.file.name} src={item.previewUrl} />
                    ) : (
                      <video muted playsInline src={item.previewUrl} />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {message.fileAttachments?.length || message.contextAttachments?.length ? (
              <div className="message-context-preview" aria-label="Sent context">
                {message.contextAttachments?.map((item) => (
                  <span className={`message-context-chip ${item.type}`} key={item.id}>
                    <strong>{item.type === "listing" ? "Listing" : "Lead"}</strong>
                    {item.label}
                  </span>
                ))}
                {message.fileAttachments?.map((item) => (
                  <span className="message-context-chip file" key={item.id}>
                    <strong>File</strong>
                    {item.file.name}
                  </span>
                ))}
              </div>
            ) : null}
            {!message.isStreaming ? (
              <>
                {message.draft ? (
                  <DraftPreviewCard
                    draft={message.draft}
                    onAttachMedia={openDraftMediaPicker}
                    onRemoveMedia={removePendingMedia}
                    pendingMedia={message.id === activeDraftId ? pendingMedia : []}
                    onSaved={(uploadedCount, listingId) => {
                      clearPendingMedia();
                      setActiveDraftId(null);
                      setActiveListingId(listingId);
                      appendAssistantMessage({
                        content: uploadedCount
                          ? `Done. I added it to your listing library with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}. You can open Listings from the sidebar to review and edit.`
                          : "Done. I added it to your listing library. You can open Listings from the sidebar to review media and edit details."
                      });
                    }}
                  />
                ) : null}
                {message.scheduleEvent ? (
                  <SchedulePreviewCard
                    event={message.scheduleEvent}
                    onSaved={() => {
                      appendAssistantMessage({
                        content:
                          "Done. I added it to Schedule. Next, I can show today's appointments and reminders from the workspace."
                      });
                    }}
                  />
                ) : null}
                {message.scheduleEvents ? <ScheduleResultsCard events={message.scheduleEvents} /> : null}
                {message.leadResults ? <LeadResultsCard leads={message.leadResults} onSelect={addLeadContext} /> : null}
                {message.leadLatestOffer ? (
                  <LeadLatestOfferCard
                    onConfirm={() => {
                      const latestLead = recentLeads[0] ? [recentLeads[0]] : [];
                      appendAssistantMessage({
                        content: latestLead.length
                          ? "Confirmed. Here is the latest lead from your inbox."
                          : "There are no leads in your recent inbox yet.",
                        leadResults: latestLead
                      });
                    }}
                  />
                ) : null}
                {message.leadStatusUpdate ? (
                  <LeadStatusConfirmCard
                    preview={message.leadStatusUpdate}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the lead status. You can review all lead activity from the Leads page."
                      });
                    }}
                  />
                ) : null}
                {message.leadDetailsUpdate ? (
                  <LeadDetailsConfirmCard
                    preview={message.leadDetailsUpdate}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the lead details. You can review the latest contact record from the Leads page."
                      });
                    }}
                  />
                ) : null}
                {message.leadCreate ? (
                  <LeadCreateConfirmCard
                    preview={message.leadCreate}
                    onSaved={() => {
                      appendAssistantMessage({
                        content: "Done. I saved the lead. You can review it from the Leads page."
                      });
                    }}
                  />
                ) : null}
                {message.leadBatchStatusUpdate ? (
                  <LeadBatchStatusConfirmCard
                    preview={message.leadBatchStatusUpdate}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the selected leads. You can review them from the Leads page."
                      });
                    }}
                  />
                ) : null}
                {message.leadListingUpdate ? (
                  <LeadListingConfirmCard
                    preview={message.leadListingUpdate}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the lead's primary listing. You can review the latest record from the Leads page."
                      });
                    }}
                  />
                ) : null}
                {message.listingUpdate ? (
                  <ListingUpdateConfirmCard
                    preview={message.listingUpdate}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the listing. You can open Listings from the sidebar to review it."
                      });
                    }}
                  />
                ) : null}
                {message.listingUpdateChoices ? (
                  <ListingUpdateSelectionCard
                    preview={message.listingUpdateChoices}
                    onSelect={(listing) => {
                      setActiveListingId(listing.id);
                      appendAssistantMessage({
                        content: message.listingUpdateChoices?.actionResponse ?? "Please confirm this listing update.",
                        listingUpdate: {
                          listing,
                          changes: message.listingUpdateChoices?.changes ?? {}
                        }
                      });
                    }}
                  />
                ) : null}
                {message.leadReply ? <LeadReplyCard draft={message.leadReply} /> : null}
                {message.promotion ? <PromotionPack promotion={message.promotion} /> : null}
                {message.promotionTarget ? (
                  <PromotionConfirmCard
                    initialChannels={message.promotionChannels}
                    listing={message.promotionTarget}
                    onGenerate={(channels) =>
                      void generatePromotionForListing(
                        message.promotionTarget as RecentListingSummary,
                        message.promotionInstruction ?? "",
                        channels
                      )
                    }
                  />
                ) : null}
              </>
            ) : null}
          </article>
          )
        ))}

        {isSubmitting ? (
          <div className="message assistant thinking-message" role="status" aria-live="polite">
            <span>Thinking</span>
            <span className="thinking-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : null}

        <div className="messages-end-spacer" ref={messagesEndRef} />
      </div>

      {contextPickerMode ? (
        <div className="agent-context-picker" role="dialog" aria-label={`Choose ${contextPickerMode}`}>
          <div className="agent-context-picker-header">
            <strong>{contextPickerMode === "listing" ? "Choose listing" : "Choose lead"}</strong>
            <button
              aria-label="Close chooser"
              className="icon-button compact"
              type="button"
              onClick={() => setContextPickerMode(null)}
            >
              <X size={15} />
            </button>
          </div>
          <div className="agent-context-picker-list">
            {contextPickerMode === "listing" ? (
              recentListings.length ? (
                recentListings.slice(0, 12).map((listing) => (
                  <button
                    className="agent-context-option"
                    key={listing.id}
                    type="button"
                    onClick={() => addListingContext(listing)}
                  >
                    <House size={15} />
                    <span>
                      <strong>{listing.title || "Untitled listing"}</strong>
                      <small>
                        {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || "Area not set"} ·{" "}
                        {[listing.location_area, listing.city].filter(Boolean).join(", ") || "Location not set"}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="agent-context-empty">No listings available yet.</p>
              )
            ) : recentLeads.length ? (
              recentLeads.slice(0, 20).map((lead) => (
                <button
                  className="agent-context-option"
                  key={lead.id}
                  type="button"
                  onClick={() => addLeadContext(lead)}
                >
                  <MessageCircle size={15} />
                  <span>
                    <strong>{lead.full_name || lead.phone || "Unnamed buyer"}</strong>
                    <small>
                      {lead.status} · {getLeadInterestLine(lead)} · {lead.phone || "No phone"}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <p className="agent-context-empty">No leads available yet.</p>
            )}
          </div>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        className="media-file-input"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(event) => handleMediaSelected(event.target.files)}
      />
      <input
        ref={documentFileInputRef}
        className="media-file-input"
        type="file"
        accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        onChange={(event) => handleDocumentSelected(event.target.files)}
      />
      <AgentComposer
        actions={!hasStarted ? quickActions : undefined}
        attachActions={attachActions}
        className="workspace-agent-composer"
        contextAttachments={composerContextPreviews()}
        files={composerFiles.map((item) => ({
          id: item.id,
          name: item.file.name,
          sizeLabel: formatFileSize(item.file.size)
        }))}
        isListening={isListening}
        isTranscribing={isTranscribing}
        media={composerMedia.map((item) => ({
          id: item.id,
          mediaType: item.mediaType,
          name: item.file.name,
          previewUrl: item.previewUrl
        }))}
        onAttach={openComposerMediaPicker}
        onChange={setInput}
        onRemoveContext={removeContextAttachment}
        onRemoveFile={removeComposerFile}
        onRemoveMedia={removeComposerMedia}
        onSubmit={handleSubmit}
        onVoice={handleVoiceInput}
        placeholder="Ask Pislaka Agent to help..."
        sendDisabled={isSubmitting || isListening || isTranscribing}
        value={input}
        voiceSlot={
          isListening || isTranscribing ? (
            <VoiceWaveform
              isTranscribing={isTranscribing}
              levels={voiceLevels}
              seconds={recordingSeconds}
            />
          ) : undefined
        }
      />
    </section>
  );
}
