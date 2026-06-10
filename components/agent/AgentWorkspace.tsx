"use client";

import { type CSSProperties, type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  FileText,
  Globe2,
  House,
  ImageIcon,
  ImagePlus,
  LoaderCircle,
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
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";
import { useRouter } from "next/navigation";
import type { AgentChatMessageRecord } from "@/lib/agent/conversations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BrokerEventDraftInput, BrokerEventRecord } from "@/lib/events/types";
import {
  formatBrokerDateTime,
  fromBrokerDatetimeLocal,
  getBrokerDayRange,
  getResolvedTimeZone,
  toBrokerDatetimeLocal
} from "@/lib/events/time";
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
import type { ListingDraftInput, ListingDraftUpdateInput, ListingMediaRecord } from "@/lib/listings/types";
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
  media?: ListingMediaRecord[];
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
  isProgress?: boolean;
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
  entitySelection?: EntitySelectionPreview;
  listingSaved?: ListingSavedPreview;
  listingSavedMedia?: ListingSavedMediaPreview[];
  promotion?: ListingPromotion;
  promotionTarget?: RecentListingSummary;
  promotionInstruction?: string;
  promotionChannels?: PromotionChannel[];
};

type ListingSavedPreview = {
  listingId: string;
  title: string | null;
  location: string | null;
  uploadedCount: number;
  libraryHref: string;
  agentHref: string;
};

type ListingSavedMediaPreview = {
  id: string;
  name: string;
  previewUrl: string;
  mediaType: "image" | "video";
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

type EntitySelectionPreview = {
  targetType: "lead" | "listing";
  intent: AgentAction["intent"];
  candidates: AgentResolutionCandidate[];
  actionResponse: string;
  originalMessage: string;
  payload: Record<string, unknown>;
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
    | "entitySelection"
    | "listingSaved"
    | "listingSavedMedia"
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
  media?: ListingSavedMediaPreview[];
  snapshot?: Record<string, unknown>;
};

function resolutionCandidateToListing(candidate: AgentResolutionCandidate): RecentListingSummary {
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

function resolutionCandidateToLead(candidate: AgentResolutionCandidate): LeadListItem {
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

function hasStructuredOutput(message: ChatMessage) {
  return Boolean(
    message.draft ||
      message.scheduleEvent ||
      message.scheduleEvents ||
      message.leadResults ||
      message.leadLatestOffer ||
      message.leadDetailsUpdate ||
      message.leadCreate ||
      message.leadBatchStatusUpdate ||
      message.leadListingUpdate ||
      message.leadStatusUpdate ||
      message.leadReply ||
      message.listingUpdate ||
      message.listingUpdateChoices ||
      message.entitySelection ||
      message.listingSaved ||
      message.promotion ||
      message.promotionTarget
  );
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
    "entitySelection",
    "listingSaved",
    "listingSavedMedia",
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

type FailedMediaUpload = {
  id: string;
  name: string;
  error: string;
};

type PendingMediaUploadStatus = "pending" | "uploading" | "uploaded" | "failed";

type ListingMediaUploadResult = {
  uploadedMedia: ListingMediaRecord[];
  failedMedia: FailedMediaUpload[];
};

type PendingFileAttachment = {
  id: string;
  file: File;
};

function ChannelLogo({ channel }: { channel: PromotionChannel }) {
  if (channel === "whatsapp") {
    return (
      <span className="channel-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
        </svg>
      </span>
    );
  }

  if (channel === "facebook") {
    return (
      <span className="channel-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </span>
    );
  }

  if (channel === "instagram") {
    return (
      <span className="channel-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f09433" />
              <stop offset="25%" stopColor="#e6683c" />
              <stop offset="50%" stopColor="#dc2743" />
              <stop offset="75%" stopColor="#cc2366" />
              <stop offset="100%" stopColor="#bc1888" />
            </linearGradient>
          </defs>
          <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
        </svg>
      </span>
    );
  }

  return (
    <span className="channel-logo" aria-hidden="true" style={{ color: "#1f4f8f" }}>
      <Globe2 size={18} />
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

function eventToFormState(event: BrokerEventDraftInput, timeZone?: string | null): EventFormState {
  return {
    event_category: event.event_category,
    event_type: event.event_type,
    title: event.title,
    description: event.description ?? "",
    start_at: toBrokerDatetimeLocal(event.start_at, timeZone),
    end_at: toBrokerDatetimeLocal(event.end_at, timeZone),
    reminder_at: toBrokerDatetimeLocal(event.reminder_at, timeZone),
    recurrence_rule: event.recurrence_rule ?? "",
    lead_id: event.lead_id ?? "",
    listing_id: event.listing_id ?? "",
    lead_name: event.lead_name ?? "",
    listing_reference: event.listing_reference ?? "",
    location_text: event.location_text ?? "",
    source_payload: event.source_payload ?? {}
  };
}

function formStateToEvent(form: EventFormState, timeZone?: string | null): BrokerEventDraftInput {
  return {
    event_category: form.event_category,
    event_type: form.event_type,
    title: form.title.trim() || "Broker event",
    description: form.description.trim() || undefined,
    start_at: fromBrokerDatetimeLocal(form.start_at, timeZone),
    end_at: fromBrokerDatetimeLocal(form.end_at, timeZone),
    reminder_at: fromBrokerDatetimeLocal(form.reminder_at, timeZone),
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

function formatEventTime(event: BrokerEventDraftInput, timeZone?: string | null) {
  const primaryTime = event.start_at ?? event.reminder_at;

  if (!primaryTime) {
    return event.recurrence_rule || "Time not set";
  }

  return formatBrokerDateTime(primaryTime, timeZone);
}

function getScheduleResultTime(event: BrokerEventRecord) {
  return event.start_at ?? event.reminder_at ?? event.created_at;
}

function formatScheduleResultTime(event: BrokerEventRecord, timeZone?: string | null) {
  return formatBrokerDateTime(getScheduleResultTime(event), timeZone);
}

function getScheduleDateRange(
  dateFilter: ScheduleEventListPayload["date_filter"],
  timeZone?: string | null
): { from?: string; to?: string } {
  if (dateFilter === "all") {
    return {};
  }

  if (dateFilter === "tomorrow") {
    return getBrokerDayRange(1, 0, timeZone);
  }

  if (dateFilter === "week") {
    return getBrokerDayRange(0, 7, timeZone);
  }

  return getBrokerDayRange(0, 0, timeZone);
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
  const media = (listing.media ?? [])
    .filter((item) => item.signed_url)
    .slice(0, 3)
    .map((item, index) => ({
      id: item.id,
      name: `Listing media ${index + 1}`,
      previewUrl: item.signed_url ?? "",
      mediaType: item.media_type
    }));
  const mediaSummary = listing.media?.length
    ? `${listing.media.length} media file${listing.media.length === 1 ? "" : "s"}`
    : null;

  return {
    id: `listing:${listing.id}`,
    type: "listing",
    entity_id: listing.id,
    label: listing.title || "Untitled listing",
    summary: [
      area || null,
      location || null,
      formatListingCurrency(listing.price_amount, listing.price_currency ?? "PKR"),
      mediaSummary
    ]
      .filter(Boolean)
      .join(" · "),
    media,
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
      bathrooms: listing.bathrooms,
      media_count: listing.media?.length ?? 0
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

function getProgressCopy(
  messageText: string,
  options: {
    hasFiles: boolean;
    hasLeadContext: boolean;
    hasListingContext: boolean;
    hasMedia: boolean;
  }
) {
  const normalized = messageText.toLowerCase();

  if (options.hasMedia || /listing|property|房源|房子|出售|出租|租|卖|price|bed|marla|kanal|房价|面积/i.test(messageText)) {
    return [
      "Got it. I am organizing the property details.",
      "I am identifying the location, size, price, and listing type.",
      "Almost there. I am preparing a listing draft you can confirm.",
      "Still working through the media and property details. I will show the result here shortly."
    ];
  }

  if (
    options.hasLeadContext ||
    /lead|buyer|client|customer|whatsapp|reply|follow[-\s]?up|客户|买家|线索|回复|跟进|电话|手机号/i.test(messageText)
  ) {
    return [
      "Got it. I am checking the lead context first.",
      "I am matching the lead, contact details, and related listing.",
      "I have the direction now. I am preparing the next step.",
      "Still checking the lead details so I do not act on the wrong person."
    ];
  }

  if (/schedule|viewing|meeting|reminder|tomorrow|today|appointment|日程|看房|提醒|明天|今天|会议|预约/i.test(messageText)) {
    return [
      "Got it. I am checking the scheduling request.",
      "I am parsing the time, person, and related listing.",
      "I am preparing a schedule preview you can confirm.",
      "Still checking the timing details so the appointment is not placed incorrectly."
    ];
  }

  if (/promote|campaign|facebook|instagram|portal|post|推广|广告|营销|发布/i.test(normalized) || options.hasListingContext) {
    return [
      "Got it. I am reviewing how this listing should be promoted.",
      "I am checking the channels, selling points, and lead page needs.",
      "I am preparing the next step for the promotion.",
      "Still shaping the channel copy. I will show the result here shortly."
    ];
  }

  if (options.hasFiles) {
    return [
      "Got it. I am reviewing the attached file first.",
      "I am combining the file with the current conversation context.",
      "I am preparing the next step you can act on.",
      "The file still needs a little more processing. I will show the result here shortly."
    ];
  }

  return [
    "Got it. I am taking a look.",
    "I am reading the current conversation to understand what you need.",
    "I have the direction now. I am preparing the response.",
    "Still working on it. I will show the result here shortly."
  ];
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

async function uploadListingMedia(
  listingId: string,
  media: PendingMedia[],
  onStatusChange?: (mediaId: string, status: PendingMediaUploadStatus) => void
): Promise<ListingMediaUploadResult> {
  const supabase = createSupabaseBrowserClient();
  const uploadedMedia: ListingMediaRecord[] = [];
  const failedMedia: FailedMediaUpload[] = [];

  for (const item of media) {
    onStatusChange?.(item.id, "uploading");

    try {
      const prepareResponse = await fetch("/api/listings/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "prepare-upload",
          content_type: item.file.type,
          file_name: item.file.name,
          file_size: item.file.size,
          listing_id: listingId
        })
      });

      if (!prepareResponse.ok) {
        const payload = (await prepareResponse.json().catch(() => null)) as { error?: string } | null;
        failedMedia.push({
          id: item.id,
          name: item.file.name,
          error: payload?.error ?? "Unable to prepare media upload"
        });
        onStatusChange?.(item.id, "failed");
        continue;
      }

      const uploadPayload = (await prepareResponse.json()) as {
        bucket?: string;
        media_type?: "image" | "video";
        storage_path?: string;
        token?: string;
      };

      if (!uploadPayload.storage_path || !uploadPayload.token || !uploadPayload.media_type) {
        failedMedia.push({
          id: item.id,
          name: item.file.name,
          error: "Upload response did not include a signed upload URL"
        });
        onStatusChange?.(item.id, "failed");
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(uploadPayload.bucket ?? "listing-media")
        .uploadToSignedUrl(uploadPayload.storage_path, uploadPayload.token, item.file, {
          contentType: item.file.type
        });

      if (uploadError) {
        failedMedia.push({
          id: item.id,
          name: item.file.name,
          error: uploadError.message
        });
        onStatusChange?.(item.id, "failed");
        continue;
      }

      const completeResponse = await fetch("/api/listings/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "complete-upload",
          content_type: item.file.type,
          file_size: item.file.size,
          listing_id: listingId,
          media_type: uploadPayload.media_type,
          storage_path: uploadPayload.storage_path
        })
      });

      if (!completeResponse.ok) {
        const payload = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
        failedMedia.push({
          id: item.id,
          name: item.file.name,
          error: payload?.error ?? "Unable to save uploaded media"
        });
        onStatusChange?.(item.id, "failed");
        continue;
      }

      const payload = (await completeResponse.json()) as { media?: ListingMediaRecord };
      if (payload.media) {
        uploadedMedia.push(payload.media);
        onStatusChange?.(item.id, "uploaded");
      } else {
        failedMedia.push({
          id: item.id,
          name: item.file.name,
          error: "Upload response did not include saved media"
        });
        onStatusChange?.(item.id, "failed");
      }
    } catch (error) {
      failedMedia.push({
        id: item.id,
        name: item.file.name,
        error: error instanceof Error ? error.message : "Network error while uploading media"
      });
      onStatusChange?.(item.id, "failed");
    }
  }

  return { uploadedMedia, failedMedia };
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
    <AgentOutputCard
      className="chat-promotion-pack"
      icon={<Megaphone size={16} />}
      title="Promotion pack"
      tone="promotion"
    >
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
                onClick={() => {
                  const parts = [card.title, card.body];
                  if (card.landing_url) parts.push(`Link: ${card.landing_url}`);
                  if (card.cta) parts.push(card.cta);
                  void handleCopy(card.channel, parts.join("\n\n"));
                }}
              >
                <Copy size={14} />
              </button>
            </div>
            <strong>{card.title}</strong>
            <div className="promotion-bubble-content">
              <p>{card.body}</p>
              {card.cta ? (
                <span className="promotion-cta-text">{card.cta}</span>
              ) : null}
              {card.landing_url ? (
                <a className="promotion-inline-link" href={card.landing_url} target="_blank" rel="noreferrer">
                  <Globe2 size={13} />
                  <span>{card.landing_url}</span>
                </a>
              ) : null}
            </div>
            {copiedChannel === card.channel ? <small className="copied-hint">Copied to clipboard</small> : null}
            {card.whatsapp_share_url ? (
              <div className="promotion-actions">
                <a className="promotion-action-button secondary" href={card.whatsapp_share_url} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} />
                  <span>Share to WhatsApp</span>
                </a>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </AgentOutputCard>
  );
}

function PromotionConfirmCard({
  initialChannels,
  listing,
  onGenerate
}: {
  initialChannels?: PromotionChannel[];
  listing: RecentListingSummary;
  onGenerate: (channels: PromotionChannel[]) => Promise<void> | void;
}) {
  const [selectedChannels, setSelectedChannels] = useState<PromotionChannel[]>(
    initialChannels?.length ? initialChannels : ["whatsapp"]
  );
  const [generationState, setGenerationState] = useState<"idle" | "generating" | "generated">("idle");
  const hasGenerated = generationState === "generated";
  const isGenerating = generationState === "generating";

  function toggleChannel(channel: PromotionChannel) {
    if (hasGenerated) {
      return;
    }

    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    );
  }

  return (
    <AgentOutputCard
      actions={
        <button
          className="primary-button small"
          disabled={selectedChannels.length === 0 || isGenerating || hasGenerated}
          type="button"
          onClick={async () => {
            if (isGenerating || hasGenerated) {
              return;
            }

            setGenerationState("generating");
            await onGenerate(selectedChannels);
            setGenerationState("generated");
          }}
        >
          <CheckCircle2 size={15} />{" "}
          {hasGenerated ? "Generated" : isGenerating ? "Generating..." : "Generate promotion pack"}
        </button>
      }
      className="promotion-confirm-card"
      hint="Choose channels, then generate the promotion pack."
      icon={<Megaphone size={16} />}
      summary="Confirm the property and choose one or more channels."
      title="Promotion target"
      tone="promotion"
    >
      <div className="promotion-target-card">
        <strong>{listing.title || "Untitled listing"}</strong>
        <span>
          {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || "Area not set"} ·{" "}
          {[listing.location_area, listing.city].filter(Boolean).join(", ") || "Location not set"}
        </span>
      </div>
      <div className="channel-selector">
        {promotionChannels.map((item) => (
          <label key={item.channel} className={selectedChannels.includes(item.channel) ? "selected" : ""}>
            <input
              checked={selectedChannels.includes(item.channel)}
              disabled={isGenerating || hasGenerated}
              type="checkbox"
              onChange={() => toggleChannel(item.channel)}
            />
            <ChannelLogo channel={item.channel} />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </AgentOutputCard>
  );
}

function LeadResultsCard({
  leads,
  onSelect
}: {
  leads: LeadListItem[];
  onSelect?: (lead: LeadListItem) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AgentOutputCard
      className="lead-chat-card"
      icon={<MessageCircle size={16} />}
      title="Matching leads"
      tone="lead"
    >
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
                  <button
                    className="outline-button small"
                    type="button"
                    disabled={selectedId === lead.id}
                    onClick={() => {
                      setSelectedId(lead.id);
                      onSelect(lead);
                    }}
                  >
                    {selectedId === lead.id ? "Selected" : "Select"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="agent-draft-status">No matching leads found in the recent inbox.</p>
      )}
    </AgentOutputCard>
  );
}

function LeadLatestOfferCard({ onConfirm }: { onConfirm: () => void }) {
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <AgentOutputCard
      actions={
        <button
          className="primary-button small"
          type="button"
          disabled={isConfirmed}
          onClick={() => {
            setIsConfirmed(true);
            onConfirm();
          }}
        >
          <CheckCircle2 size={15} /> {isConfirmed ? "Shown" : "View latest lead"}
        </button>
      }
      className="lead-chat-card"
      icon={<MessageCircle size={16} />}
      title="No exact lead match"
      tone="lead"
    >
      <p className="lead-chat-reply">
        I did not find that exact lead in the recent inbox. I can show the latest lead instead, but I need your confirmation first.
      </p>
    </AgentOutputCard>
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
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSaving || isSaved) {
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
    setIsSaved(true);
    onUpdated();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? "Updated" : isSaving ? "Updating..." : "Confirm update"}
        </button>
      }
      className="lead-chat-card"
      hint="Confirm before I update this lead."
      icon={<CheckCircle2 size={16} />}
      status={status}
      summary={preview.urgency ? `Urgency will be set to ${preview.urgency}.` : undefined}
      title="Confirm lead update"
      tone="lead"
    >
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
    </AgentOutputCard>
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
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const entries = Object.entries(preview.changes).filter(([, value]) => value !== undefined) as Array<
    [keyof LeadDetailsUpdateChanges, string | null]
  >;

  async function handleConfirm() {
    if (isSaving || isSaved) {
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
    setIsSaved(true);
    onUpdated();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? "Updated" : isSaving ? "Updating..." : "Confirm update"}
        </button>
      }
      className="lead-chat-card"
      hint="Review the changed fields, then confirm."
      icon={<Pencil size={16} />}
      status={status}
      title="Confirm lead details"
      tone="lead"
    >
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
    </AgentOutputCard>
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
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSaving || isSaved) {
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
    setIsSaved(true);
    onSaved();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? "Saved" : isSaving ? "Saving..." : "Confirm & save"}
        </button>
      }
      className="lead-chat-card"
      hint="Confirm before I save this lead."
      icon={<UserPlus size={16} />}
      status={status}
      title="Confirm new lead"
      tone="lead"
    >
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
    </AgentOutputCard>
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
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleConfirm() {
    if (isSaving || isSaved || !preview.status) {
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
    setIsSaved(true);
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button
          className="primary-button small"
          type="button"
          disabled={isSaving || isSaved || !preview.status}
          onClick={handleConfirm}
        >
          <CheckCircle2 size={15} /> {isSaved ? "Updated" : isSaving ? "Updating..." : "Confirm batch update"}
        </button>
      }
      className="lead-chat-card"
      hint="Review the selected leads before updating them."
      icon={<CheckCircle2 size={16} />}
      status={status}
      summary={
        <>
          {preview.leads.length} lead{preview.leads.length === 1 ? "" : "s"} will be changed to{" "}
          {preview.status ?? "the selected status"}
          {preview.urgency ? ` with ${preview.urgency} urgency` : ""}.
        </>
      }
      title="Confirm batch update"
      tone="lead"
    >
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
    </AgentOutputCard>
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
  const [isSaved, setIsSaved] = useState(false);
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
    if (isSaving || isSaved) {
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
    setIsSaved(true);
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? "Updated" : isSaving ? "Updating..." : "Confirm listing"}
        </button>
      }
      className="lead-chat-card"
      hint="Confirm before I change this lead's primary listing."
      icon={<House size={16} />}
      status={status}
      title="Confirm lead listing"
      tone="lead"
    >
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
    </AgentOutputCard>
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
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const entries = Object.entries(preview.changes).filter(([, value]) => value !== undefined);

  async function handleConfirm() {
    if (isSaving || isSaved) {
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
    setIsSaved(true);
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? "Updated" : isSaving ? "Updating..." : "Confirm update"}
        </button>
      }
      className="listing-update-card"
      hint="Review the listing changes, then confirm."
      icon={<Pencil size={16} />}
      status={status}
      title="Confirm listing update"
      tone="listing"
    >
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
    </AgentOutputCard>
  );
}

function ListingUpdateSelectionCard({
  preview,
  onSelect
}: {
  preview: ListingUpdateChoicePreview;
  onSelect: (listing: RecentListingSummary) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AgentOutputCard
      className="listing-update-card"
      hint="Select one listing to continue."
      icon={<House size={16} />}
      summary="I found multiple matching listings. Select the exact property, then I will show the update for confirmation."
      title="Choose listing to update"
      tone="listing"
    >
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
            <button
              className="primary-button small"
              type="button"
              disabled={Boolean(selectedId)}
              onClick={() => {
                setSelectedId(listing.id);
                onSelect(listing);
              }}
            >
              <CheckCircle2 size={15} /> {selectedId === listing.id ? "Selected" : "Select"}
            </button>
          </article>
        ))}
      </div>
    </AgentOutputCard>
  );
}

function EntitySelectionCard({
  preview,
  onSelect,
  onSkip
}: {
  preview: EntitySelectionPreview;
  onSelect: (candidate: AgentResolutionCandidate) => void;
  onSkip?: () => void;
}) {
  const isListingTarget = preview.targetType === "listing";
  const title = isListingTarget ? "Choose listing" : "Choose lead";
  const helper = isListingTarget
    ? "I found multiple matching listings. Select the exact property before I continue."
    : "I found multiple matching leads. Select the exact buyer before I continue.";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const isDone = Boolean(selectedId) || skipped;

  return (
    <AgentOutputCard
      actions={
        onSkip ? (
          <button
            className="outline-button small"
            type="button"
            disabled={isDone}
            onClick={() => {
              setSkipped(true);
              onSkip();
            }}
          >
            {skipped ? "Continued" : "Continue without binding"}
          </button>
        ) : null
      }
      className={isListingTarget ? "listing-update-card" : "lead-chat-card"}
      hint="Select one record to continue."
      icon={isListingTarget ? <House size={16} /> : <MessageCircle size={16} />}
      summary={helper}
      title={title}
      tone={isListingTarget ? "listing" : "lead"}
    >
      <div className={isListingTarget ? "listing-choice-grid" : "lead-chat-list"}>
        {preview.candidates.map((candidate) => {
          const listing = isListingTarget ? resolutionCandidateToListing(candidate) : null;
          const lead = isListingTarget ? null : resolutionCandidateToLead(candidate);

          return isListingTarget && listing ? (
            <article className="listing-choice-card" key={candidate.id}>
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
              <button
                className="primary-button small"
                type="button"
                disabled={isDone}
                onClick={() => {
                  setSelectedId(candidate.id);
                  onSelect(candidate);
                }}
              >
                <CheckCircle2 size={15} /> {selectedId === candidate.id ? "Selected" : "Select"}
              </button>
            </article>
          ) : lead ? (
            <div className="lead-chat-row" key={candidate.id}>
              <div>
                <strong>{lead.full_name || lead.phone || "Unnamed buyer"}</strong>
                <p>{getLeadInterestLine(lead)}</p>
                <small>
                  {lead.status} · {lead.phone || "No phone"}
                  {lead.email ? ` · ${lead.email}` : ""}
                </small>
              </div>
              <div className="lead-chat-row-action">
                <span className={`lead-status ${lead.status}`}>{lead.status}</span>
                <button
                  className="primary-button small"
                  type="button"
                  disabled={isDone}
                  onClick={() => {
                    setSelectedId(candidate.id);
                    onSelect(candidate);
                  }}
                >
                  <CheckCircle2 size={15} /> {selectedId === candidate.id ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          ) : null;
        })}
      </div>
    </AgentOutputCard>
  );
}

function LeadReplyCard({ draft }: { draft: LeadReplyDraftWithLink }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(draft.reply_text);
    setCopied(true);
  }

  return (
    <AgentOutputCard
      actions={
        <>
          <button className="outline-button small" type="button" onClick={() => void handleCopy()}>
            <Copy size={14} /> {copied ? "Copied" : "Copy"}
          </button>
          <a className="primary-button small" href={draft.whatsapp_url} target="_blank" rel="noreferrer">
            <Phone size={14} /> Open WhatsApp
          </a>
        </>
      }
      className="lead-chat-card"
      icon={<MessageCircle size={16} />}
      summary={draft.next_step}
      title="WhatsApp reply draft"
      tone="lead"
    >
      <p className="lead-chat-reply">{draft.reply_text}</p>
    </AgentOutputCard>
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
  onSaved: (
    uploadedCount: number,
    listingId: string,
    mediaPreview: ListingSavedMediaPreview[],
    failedMedia: FailedMediaUpload[]
  ) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => draftToFormState(draft));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [mediaUploadStatus, setMediaUploadStatus] = useState<Record<string, PendingMediaUploadStatus>>({});
  const [status, setStatus] = useState<string | null>(null);
  const previewDraft = useMemo(() => formStateToDraft(form), [form]);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }

    setIsSaving(true);
    setMediaUploadStatus(Object.fromEntries(pendingMedia.map((item) => [item.id, "pending"])));
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
      const { uploadedMedia, failedMedia } = await uploadListingMedia(listingId, pendingMedia, (mediaId, nextStatus) => {
        setMediaUploadStatus((current) => ({
          ...current,
          [mediaId]: nextStatus
        }));
      });
      const uploadedCount = uploadedMedia.length;
      const failedCount = failedMedia.length;
      const failedDetails = failedMedia
        .slice(0, 3)
        .map((item) => `${item.name}: ${item.error}`)
        .join("; ");
      setStatus(
        failedCount
          ? `Listing saved. ${uploadedCount} media uploaded; ${failedCount} failed${failedDetails ? `: ${failedDetails}` : ""}.`
          : uploadedCount
            ? `Added to listing library with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}.`
            : "Added to listing library."
      );
      setIsSaved(true);
      onSaved(
        uploadedCount,
        listingId,
        uploadedMedia.slice(0, 3).map((item, index) => ({
          id: item.id,
          name: `Uploaded media ${index + 1}`,
          previewUrl: item.signed_url ?? "",
          mediaType: item.media_type
        })),
        failedMedia
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Listing saved, but media upload failed.");
      setIsSaved(true);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AgentOutputCard
      actions={
        <>
          <button className="primary-button small" type="button" onClick={handleConfirm} disabled={isSaving || isSaved}>
            <CheckCircle2 size={15} /> {isSaved ? "Saved" : isSaving ? "Adding..." : "Confirm & add"}
          </button>
          <button
            className="outline-button small"
            type="button"
            disabled={isSaving || isSaved}
            onClick={() => setIsEditing(!isEditing)}
          >
            <Pencil size={14} /> {isEditing ? "Preview" : "Edit card"}
          </button>
        </>
      }
      className="agent-draft-card"
      icon={<Sparkles size={16} />}
      status={status}
      summary={isEditing ? "Edit the parsed listing fields before saving." : "Review the key listing details before adding it to your library."}
      title="Listing preview"
      tone="listing"
    >

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
        {pendingMedia.length ? (
          <div className="agent-media-preview">
            {pendingMedia.map((item) => {
              const uploadStatus = mediaUploadStatus[item.id] ?? "pending";
              const isUploading = uploadStatus === "uploading";
              const isUploaded = uploadStatus === "uploaded";
              const isFailed = uploadStatus === "failed";

              return (
                <div className={`agent-media-thumb ${uploadStatus}`} key={item.id}>
                  {item.mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt={item.file.name} />
                  ) : (
                    <video src={item.previewUrl} muted playsInline />
                  )}
                  {uploadStatus !== "pending" ? (
                    <span className="agent-media-upload-state" aria-label={`${item.file.name} ${uploadStatus}`}>
                      {isUploading ? (
                        <LoaderCircle className="spin-icon" size={16} />
                      ) : isUploaded ? (
                        <CheckCircle2 size={16} />
                      ) : isFailed ? (
                        <X size={15} />
                      ) : null}
                    </span>
                  ) : null}
                  <button
                    aria-label={`Remove ${item.file.name}`}
                    className="agent-media-remove"
                    disabled={isSaving || isSaved}
                    type="button"
                    onClick={() => onRemoveMedia(item.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
            <button className="agent-media-add" type="button" disabled={isSaving || isSaved} onClick={onAttachMedia}>
              <Upload size={14} /> Add more
            </button>
          </div>
        ) : (
          <button className="agent-media-add empty" type="button" disabled={isSaving || isSaved} onClick={onAttachMedia}>
            <ImagePlus size={16} /> Add photos / video
          </button>
        )}
      </div>
    </AgentOutputCard>
  );
}

function ListingSavedCard({
  mediaPreview = [],
  onAskAgent,
  preview
}: {
  mediaPreview?: ListingSavedMediaPreview[];
  onAskAgent?: (preview: ListingSavedPreview, mediaPreview: ListingSavedMediaPreview[]) => void;
  preview: ListingSavedPreview;
}) {
  const visibleMedia = mediaPreview.filter((item) => item.previewUrl).slice(0, 3);

  return (
    <AgentOutputCard
      actions={
        <>
          <a className="primary-button small" href={preview.libraryHref}>
            <House size={14} /> Open listing
          </a>
          <button className="outline-button small" type="button" onClick={() => onAskAgent?.(preview, mediaPreview)}>
            <MessageCircle size={14} /> Ask Agent
          </button>
        </>
      }
      className="listing-saved-card"
      icon={<CheckCircle2 size={16} />}
      title="Listing saved"
      tone="listing"
    >
      <div className="listing-saved-summary">
        <div>
          <strong>{preview.title || "Saved listing"}</strong>
          {preview.location ? <span>{preview.location}</span> : null}
        </div>
        <div className="listing-saved-media" aria-label="Saved listing media">
          {visibleMedia.length ? (
            <>
              <div className="listing-saved-thumbs">
                {visibleMedia.map((item) => (
                  <span className="listing-saved-thumb" key={item.id}>
                    {item.mediaType === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={item.name} src={item.previewUrl} />
                    ) : (
                      <video muted playsInline src={item.previewUrl} />
                    )}
                  </span>
                ))}
              </div>
              <span>
                {preview.uploadedCount} media file{preview.uploadedCount === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span className="listing-saved-badge">
              <ImageIcon size={14} /> No media added
            </span>
          )}
        </div>
      </div>
    </AgentOutputCard>
  );
}

function SchedulePreviewCard({
  event,
  onSaved,
  timeZone
}: {
  event: BrokerEventDraftInput;
  onSaved: () => void;
  timeZone?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => eventToFormState(event, timeZone));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const previewEvent = useMemo(() => formStateToEvent(form, timeZone), [form, timeZone]);
  const hasScheduleTime = Boolean(previewEvent.start_at || previewEvent.reminder_at);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }

    if (!hasScheduleTime) {
      setStatus("Please add a start or reminder time before saving.");
      setIsEditing(true);
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
    setIsSaved(true);
    onSaved();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <>
          <button
            className="primary-button small"
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || isSaved || !hasScheduleTime}
          >
            <CheckCircle2 size={15} /> {isSaved ? "Added" : isSaving ? "Adding..." : "Confirm schedule"}
          </button>
          <button
            className="outline-button small"
            type="button"
            disabled={isSaving || isSaved}
            onClick={() => setIsEditing(!isEditing)}
          >
            <Pencil size={14} /> {isEditing ? "Preview" : "Edit card"}
          </button>
        </>
      }
      className="schedule-preview-card"
      hint={isEditing ? "Edit the timing before saving." : "Review the schedule item before adding it."}
      icon={<CalendarClock size={16} />}
      status={status}
      summary={isEditing ? "Edit timing and references before saving." : "Review the schedule item before adding it."}
      title="Schedule preview"
      tone="schedule"
    >

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
              {form.lead_id ? <small>Bound lead</small> : null}
              <input
                value={form.lead_name}
                onChange={(event) => setForm({ ...form, lead_name: event.target.value })}
              />
            </label>
            <label>
              <span>Listing</span>
              {form.listing_id ? <small>Bound listing</small> : null}
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
            <span>{formatEventTime(previewEvent, timeZone)}</span>
            {previewEvent.lead_name ? <span>{previewEvent.lead_name}</span> : null}
            {previewEvent.listing_reference ? <span>{previewEvent.listing_reference}</span> : null}
          </div>
        </div>
      )}
    </AgentOutputCard>
  );
}

function ScheduleResultsCard({ events, timeZone }: { events: BrokerEventRecord[]; timeZone?: string | null }) {
  return (
    <AgentOutputCard
      className="chat-card schedule-results-card"
      icon={<CalendarClock size={16} />}
      title="Schedule items"
      tone="schedule"
    >
      {events.length === 0 ? (
        <p>No matching schedule items.</p>
      ) : (
        <div className="event-mini-list">
          {events.map((event) => (
            <div className="event-mini-row" key={event.id}>
              <time dateTime={getScheduleResultTime(event)}>{formatScheduleResultTime(event, timeZone)}</time>
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
    </AgentOutputCard>
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
  const [userTimeZone, setUserTimeZone] = useState(() => getResolvedTimeZone());
  const [input, setInput] = useState("");
  const [composerMedia, setComposerMedia] = useState<PendingMedia[]>([]);
  const [composerFiles, setComposerFiles] = useState<PendingFileAttachment[]>([]);
  const [contextAttachments, setContextAttachments] = useState<ChatContextAttachment[]>(initialContextAttachments);
  const [contextPickerMode, setContextPickerMode] = useState<"listing" | "lead" | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [draftMediaByMessageId, setDraftMediaByMessageId] = useState<Record<string, PendingMedia[]>>({});
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
  const chatPanelRef = useRef<HTMLElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeTurnAnchorRef = useRef<string | null>(null);
  const activeOutputRef = useRef<string | null>(null);
  const hasPositionedInitialThreadRef = useRef(false);
  const assistantStreamTimersRef = useRef<Map<string, number>>(new Map());
  const pendingProgressMessageIdRef = useRef<string | null>(null);
  const positionedOutputIdsRef = useRef<Set<string>>(new Set());
  const composerMediaRef = useRef<PendingMedia[]>([]);
  const pendingMediaRef = useRef<PendingMedia[]>([]);
  const mediaSelectionTargetRef = useRef<"composer" | "draft">("composer");
  const mediaSelectionDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    setUserTimeZone(getResolvedTimeZone());
  }, []);
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

  useLayoutEffect(() => {
    const panelElement = chatPanelRef.current;
    if (!panelElement) {
      return;
    }
    const panelNode: HTMLElement = panelElement;

    function updateComposerReserve() {
      const composer = panelNode.querySelector<HTMLElement>(".workspace-agent-composer");
      if (!composer) {
        return;
      }

      const panelRect = panelNode.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      const composerMidpoint = composerRect.top + composerRect.height * 0.5;
      const reserve = Math.max(0, Math.round(panelRect.bottom - composerMidpoint));
      const overlap = Math.max(0, Math.round(composerMidpoint - composerRect.top));
      panelNode.style.setProperty("--agent-composer-reserved", `${reserve}px`);
      panelNode.style.setProperty("--agent-composer-overlap", `${overlap}px`);
    }

    updateComposerReserve();

    const observer = new ResizeObserver(updateComposerReserve);
    observer.observe(panelNode);

    const composer = panelNode.querySelector<HTMLElement>(".workspace-agent-composer");
    if (composer) {
      observer.observe(composer);
    }

    window.addEventListener("resize", updateComposerReserve);
    return () => {
      window.removeEventListener("resize", updateComposerReserve);
      observer.disconnect();
    };
  }, [hasStarted, composerFiles.length, composerMedia.length, contextAttachments.length, isListening, isTranscribing]);

  function positionMessageStart(messageId: string, offsetRatio: number, behavior: ScrollBehavior = "smooth") {
    const container = messagesContainerRef.current;
    const messageElement = container?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);

    if (!container || !messageElement) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const messageRect = messageElement.getBoundingClientRect();
    const anchorOffset = containerRect.height * offsetRatio;
    const currentMessageTop = messageRect.top - containerRect.top;
    const nextScrollTop = container.scrollTop + currentMessageTop - anchorOffset;

    container.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior
    });
  }

  function scheduleMessagePosition(messageId: string, offsetRatio: number, behavior: ScrollBehavior = "smooth") {
    window.requestAnimationFrame(() => {
      positionMessageStart(messageId, offsetRatio, behavior);
      window.requestAnimationFrame(() => positionMessageStart(messageId, offsetRatio, behavior));
    });
    window.setTimeout(() => positionMessageStart(messageId, offsetRatio, behavior), 90);
  }

  function positionTurnAnchor(messageId: string) {
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    scheduleMessagePosition(messageId, isDesktop ? 0.18 : 0.3);
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
    const readableBottom = composerRect
      ? Math.max(0, composerRect.top - containerRect.top - (isDesktop ? 28 : 20))
      : containerRect.height - (isDesktop ? 36 : 28);
    const topReserve = isDesktop ? containerRect.height * 0.28 : containerRect.height * 0.36;
    const visibleTop = Math.max(24, topReserve);
    const visibleBottom = Math.max(visibleTop + 80, readableBottom);
    const messageTop = messageRect.top - containerRect.top;
    const messageBottom = messageRect.bottom - containerRect.top;

    if (!positionedOutputIdsRef.current.has(messageId)) {
      positionedOutputIdsRef.current.add(messageId);
      const isComfortablyVisible = messageTop >= 24 && messageTop <= visibleBottom;
      if (!isComfortablyVisible) {
        scheduleMessagePosition(messageId, isDesktop ? 0.34 : 0.42);
      }
      return;
    }

    if (messageTop < 24) {
      container.scrollTo({
        top: Math.max(0, container.scrollTop + messageTop - 24),
        behavior: "smooth"
      });
      return;
    }

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

    const activeTurnAnchor = activeTurnAnchorRef.current;
    if (activeTurnAnchor) {
      positionTurnAnchor(activeTurnAnchor);
      activeTurnAnchorRef.current = null;
      const activeOutputAfterTurn = activeOutputRef.current;
      if (activeOutputAfterTurn) {
        window.setTimeout(() => keepOutputVisible(activeOutputAfterTurn), 220);
      }
      return;
    }

    const activeOutput = activeOutputRef.current;
    if (activeOutput) {
      window.requestAnimationFrame(() => keepOutputVisible(activeOutput));
      return;
    }

    if (!hasPositionedInitialThreadRef.current) {
      hasPositionedInitialThreadRef.current = true;
      window.requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: "end" }));
    }
    // The scroll targets are stored in refs so this effect runs only when the rendered message list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      summary: item.summary,
      media: item.media
    }));
  }

  function addSavedListingContext(preview: ListingSavedPreview, mediaPreview: ListingSavedMediaPreview[] = []) {
    const nextAttachment: ChatContextAttachment = {
      id: `listing:${preview.listingId}`,
      type: "listing",
      entity_id: preview.listingId,
      label: preview.title || "Saved listing",
      summary: [
        preview.location,
        preview.uploadedCount
          ? `${preview.uploadedCount} media file${preview.uploadedCount === 1 ? "" : "s"}`
          : null
      ]
        .filter(Boolean)
        .join(" · "),
      media: mediaPreview.filter((item) => item.previewUrl).slice(0, 3),
      snapshot: {
        title: preview.title,
        location: preview.location,
        media_count: preview.uploadedCount
      }
    };

    setActiveListingId(preview.listingId);
    setContextAttachments((current) => [
      ...current.filter((item) => !(item.type === "listing" && item.entity_id === preview.listingId)),
      nextAttachment
    ]);
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

  function appendProgressMessage(content: string) {
    const progressMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content,
      isProgress: true,
      isStreaming: true
    };

    pendingProgressMessageIdRef.current = progressMessage.id;
    activeOutputRef.current = progressMessage.id;
    setActiveOutputId(progressMessage.id);
    setMessages((current) => [...current, progressMessage]);

    return progressMessage.id;
  }

  function updateProgressMessage(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId && message.isProgress ? { ...message, content } : message
      )
    );
  }

  function appendAssistantMessage(message: Omit<ChatMessage, "id" | "role"> & { id?: string }) {
    const progressMessageId = pendingProgressMessageIdRef.current;
    const nextMessage: ChatMessage = {
      ...message,
      id: message.id ?? progressMessageId ?? createId(),
      role: "assistant"
    };
    const streamingMessage: ChatMessage = {
      ...nextMessage,
      content: "",
      isProgress: false,
      isStreaming: true
    };

    activeOutputRef.current = nextMessage.id;
    setActiveOutputId(nextMessage.id);
    if (progressMessageId) {
      pendingProgressMessageIdRef.current = null;
      setMessages((current) =>
        current.map((currentMessage) =>
          currentMessage.id === progressMessageId ? streamingMessage : currentMessage
        )
      );
    } else {
      setMessages((current) => [...current, streamingMessage]);
    }
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
      appendEntitySelectionMessage({
        targetType: "listing",
        intent: "create_campaign_links",
        candidates: target.candidates,
        actionResponse: "Please confirm the property and choose channels before I generate campaign links.",
        originalMessage: messageText,
        payload: { query: messageText }
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
    const range = getScheduleDateRange(payload.date_filter, userTimeZone);

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

  function appendEntitySelectionMessage({
    targetType,
    intent,
    candidates,
    actionResponse,
    originalMessage,
    payload
  }: EntitySelectionPreview) {
    appendAssistantMessage({
      content:
        targetType === "listing"
          ? "I found multiple matching listings. Choose the exact property before I continue."
          : "I found multiple matching leads. Choose the exact buyer before I continue.",
      entitySelection: {
        targetType,
        intent,
        candidates,
        actionResponse,
        originalMessage,
        payload
      }
    });
  }

  function showScheduleResolutionMessage(
    actionResponse: string,
    event: BrokerEventDraftInput,
    resolution?: AgentResolution
  ) {
    if (!resolution || resolution.status === "matched") {
      return false;
    }

    const isListingTarget = resolution.target_type === "listing";
    if (resolution.status === "ambiguous" && (resolution.target_type === "lead" || resolution.target_type === "listing")) {
      appendEntitySelectionMessage({
        targetType: resolution.target_type,
        intent: "create_schedule_event",
        candidates: resolution.candidates ?? [],
        actionResponse,
        originalMessage: event.source_payload?.original_message as string | undefined ?? event.description ?? event.title,
        payload: event as Record<string, unknown>
      });
      return true;
    }

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
      appendEntitySelectionMessage({
        targetType: "lead",
        intent: "update_lead_status",
        candidates: target.candidates,
        actionResponse,
        originalMessage: payload.query ?? payload.lead_name ?? "",
        payload: payload as Record<string, unknown>
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
      appendEntitySelectionMessage({
        targetType: "lead",
        intent: "update_lead_details",
        candidates: target.candidates,
        actionResponse,
        originalMessage: payload.query ?? payload.lead_name ?? "",
        payload: payload as Record<string, unknown>
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
      appendEntitySelectionMessage({
        targetType: "listing",
        intent: "update_lead_listing",
        candidates: resolution.candidates ?? [],
        actionResponse,
        originalMessage: payload.query ?? payload.listing_query ?? payload.lead_name ?? "",
        payload: payload as Record<string, unknown>
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
      appendEntitySelectionMessage({
        targetType: "lead",
        intent: "update_lead_listing",
        candidates: target.candidates,
        actionResponse,
        originalMessage: payload.query ?? payload.listing_query ?? payload.lead_name ?? "",
        payload: payload as Record<string, unknown>
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
      appendEntitySelectionMessage({
        targetType: "lead",
        intent: "draft_lead_reply",
        candidates: target.candidates,
        actionResponse,
        originalMessage: payload.query ?? payload.lead_name ?? "",
        payload: payload as Record<string, unknown>
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

  async function continueAfterEntitySelection(preview: EntitySelectionPreview, candidate: AgentResolutionCandidate) {
    if (preview.targetType === "listing") {
      const listing = candidateToListing(candidate);
      const nextPayload = {
        ...preview.payload,
        listing_id: candidate.id
      };

      setActiveListingId(candidate.id);

      if (preview.intent === "create_campaign_links") {
        appendAssistantMessage({
          content: preview.actionResponse,
          promotionTarget: listing,
          promotionInstruction: preview.originalMessage,
          promotionChannels: extractPromotionChannels(preview.originalMessage)
        });
        return;
      }

      if (preview.intent === "update_lead_listing") {
        proposeLeadListingUpdate(
          preview.actionResponse,
          nextPayload as LeadListingUpdatePayload,
          {
            status: "matched",
            target_type: "listing",
            target_id: candidate.id,
            matched: candidate
          }
        );
        return;
      }

      if (preview.intent === "create_schedule_event") {
        const schedulePayload = nextPayload as BrokerEventDraftInput;
        appendAssistantMessage({
          content: preview.actionResponse,
          scheduleEvent: {
            ...schedulePayload,
            listing_id: candidate.id,
            listing_reference: schedulePayload.listing_reference ?? listing.title ?? candidate.label
          }
        });
        return;
      }
    }

    const lead = candidateToLead(candidate);
    const nextPayload = {
      ...preview.payload,
      lead_id: candidate.id
    };
    const matchedLeadResolution: AgentResolution = {
      status: "matched",
      target_type: "lead",
      target_id: candidate.id,
      matched: candidate
    };

    if (preview.intent === "update_lead_status") {
      appendAssistantMessage({
        content: preview.actionResponse,
        leadStatusUpdate: {
          lead,
          status: (nextPayload as LeadOperationPayload).status,
          urgency: (nextPayload as LeadOperationPayload).urgency
        }
      });
      return;
    }

    if (preview.intent === "update_lead_details") {
      appendAssistantMessage({
        content: preview.actionResponse,
        leadDetailsUpdate: {
          lead,
          changes: leadDetailsPayloadToChanges(nextPayload as LeadDetailsUpdatePayload)
        }
      });
      return;
    }

    if (preview.intent === "draft_lead_reply") {
      await draftReplyForLead(preview.actionResponse, nextPayload as LeadOperationPayload, matchedLeadResolution);
      return;
    }

    if (preview.intent === "update_lead_listing") {
      proposeLeadListingUpdate(preview.actionResponse, nextPayload as LeadListingUpdatePayload, matchedLeadResolution);
      return;
    }

    if (preview.intent === "create_schedule_event") {
      const schedulePayload = nextPayload as BrokerEventDraftInput;
      appendAssistantMessage({
        content: preview.actionResponse,
        scheduleEvent: {
          ...schedulePayload,
          lead_id: candidate.id,
          lead_name: schedulePayload.lead_name ?? lead.full_name ?? lead.phone ?? candidate.label
        }
      });
    }
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
      if (activeDraftId) {
        setDraftMediaByMessageId((current) => ({
          ...current,
          [activeDraftId]: [...(current[activeDraftId] ?? []), ...outgoingMedia]
        }));
      } else {
        setPendingMedia((current) => [...current, ...outgoingMedia]);
      }
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
    const progressCopy = getProgressCopy(agentMessageContent, {
      hasFiles: hasOutgoingFiles,
      hasLeadContext: outgoingContext.some((item) => item.type === "lead"),
      hasListingContext: outgoingContext.some((item) => item.type === "listing") || Boolean(currentListingId),
      hasMedia: hasOutgoingMedia
    });
    const progressMessageId = appendProgressMessage(progressCopy[0]);
    const progressTimers = [
      window.setTimeout(() => updateProgressMessage(progressMessageId, progressCopy[1]), 900),
      window.setTimeout(() => updateProgressMessage(progressMessageId, progressCopy[2]), 2600),
      window.setTimeout(() => updateProgressMessage(progressMessageId, progressCopy[3]), 7000)
    ];
    let receivedAgentResponse = false;

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
          time_zone: userTimeZone,
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
      if (!payload?.action?.intent) {
        appendAssistantMessage({
          content: "I received a response from the agent service, but it was missing the action details. Please try again."
        });
        return;
      }

      receivedAgentResponse = true;
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
        showScheduleResolutionMessage(
          payload.action.response,
          payload.action.payload as BrokerEventDraftInput,
          payload.action.resolution
        )
      ) {
        return;
      }

      const assistantMessageId = createId();

      if (draft) {
        setActiveDraftId(assistantMessageId);
        const carriedMedia = [...pendingMedia, ...outgoingMedia];
        if (carriedMedia.length) {
          setDraftMediaByMessageId((current) => ({
            ...current,
            [assistantMessageId]: carriedMedia
          }));
          setPendingMedia([]);
        }
      }

      appendAssistantMessage({
        id: assistantMessageId,
        content: payload.action.response,
        draft,
        scheduleEvent
      });
    } catch (error) {
      console.error("Agent message handling failed", error);
      appendAssistantMessage({
        content: receivedAgentResponse
          ? "I received the agent response, but could not show it in the chat. Please try again."
          : "I could not reach the agent service. Please try again in a moment."
      });
    } finally {
      clearTimeout(timeout);
      progressTimers.forEach((timer) => window.clearTimeout(timer));
      if (pendingProgressMessageIdRef.current === progressMessageId) {
        pendingProgressMessageIdRef.current = null;
      }
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
      mediaSelectionDraftIdRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const targetDraftId = mediaSelectionDraftIdRef.current;
    if (mediaSelectionTargetRef.current === "draft" && targetDraftId) {
      setActiveDraftId(targetDraftId);
      setDraftMediaByMessageId((current) => ({
        ...current,
        [targetDraftId]: [...(current[targetDraftId] ?? []), ...accepted]
      }));
    } else {
      setComposerMedia((current) => [...current, ...accepted]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    mediaSelectionTargetRef.current = "composer";
    mediaSelectionDraftIdRef.current = null;
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
    mediaSelectionDraftIdRef.current = null;
    fileInputRef.current?.click();
  }

  function openDocumentPicker() {
    documentFileInputRef.current?.click();
  }

  function openDraftMediaPicker(draftMessageId: string) {
    mediaSelectionTargetRef.current = "draft";
    mediaSelectionDraftIdRef.current = draftMessageId;
    setActiveDraftId(draftMessageId);
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

  function removeDraftMedia(draftMessageId: string, mediaId: string) {
    setDraftMediaByMessageId((current) => {
      const currentMedia = current[draftMessageId] ?? [];
      const item = currentMedia.find((media) => media.id === mediaId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }

      return {
        ...current,
        [draftMessageId]: currentMedia.filter((media) => media.id !== mediaId)
      };
    });
  }

  return (
    <section
      className={`chat-panel ${hasStarted ? "has-thread" : "is-empty"} ${activeTurnAnchorId || activeOutputId ? "has-active-turn" : ""}`}
      ref={chatPanelRef}
    >
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

        {messages.map((message, index) => {
          const hasOutputCard = message.role === "assistant" && hasStructuredOutput(message);

          return index === 0 ? null : (
          <article
            className={`message ${message.role} ${hasOutputCard ? "has-output-card" : ""} ${message.isProgress ? "progress" : ""}`.trim()}
            data-message-id={message.id}
            key={message.id}
          >
            {message.content ? (
              <p>
                {message.content}
                {message.isProgress ? (
                  <span className="thinking-dots inline" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : null}
              </p>
            ) : null}
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
                    onAttachMedia={() => openDraftMediaPicker(message.id)}
                    onRemoveMedia={(mediaId) => removeDraftMedia(message.id, mediaId)}
                    pendingMedia={draftMediaByMessageId[message.id] ?? []}
                    onSaved={(uploadedCount, listingId, mediaPreview, failedMedia) => {
                      const location = [message.draft?.location_area, message.draft?.city].filter(Boolean).join(", ");
                      const failedCount = failedMedia.length;
                      const failedNames = failedMedia.slice(0, 3).map((item) => item.name).join(", ");
                      setActiveListingId(listingId);
                      appendAssistantMessage({
                        content: failedCount
                          ? `Done. I saved the listing and uploaded ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}. ${failedCount} media file${failedCount === 1 ? "" : "s"} failed${failedNames ? `: ${failedNames}` : ""}.`
                          : uploadedCount
                            ? `Done. I added it to your listing library with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}.`
                            : "Done. I added it to your listing library.",
                        listingSaved: {
                          listingId,
                          title: message.draft?.title ?? null,
                          location: location || null,
                          uploadedCount,
                          libraryHref: `/listings#listing-${listingId}`,
                          agentHref: `/?listing=${listingId}`
                        },
                        listingSavedMedia: mediaPreview
                      });
                    }}
                  />
                ) : null}
                {message.listingSaved ? (
                  <ListingSavedCard
                    mediaPreview={message.listingSavedMedia}
                    onAskAgent={addSavedListingContext}
                    preview={message.listingSaved}
                  />
                ) : null}
                {message.scheduleEvent ? (
                  <SchedulePreviewCard
                    event={message.scheduleEvent}
                    timeZone={userTimeZone}
                    onSaved={() => {
                      appendAssistantMessage({
                        content:
                          "Done. I added it to Schedule. Next, I can show today's appointments and reminders from the workspace."
                      });
                    }}
                  />
                ) : null}
                {message.scheduleEvents ? <ScheduleResultsCard events={message.scheduleEvents} timeZone={userTimeZone} /> : null}
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
                {message.entitySelection ? (
                  <EntitySelectionCard
                    preview={message.entitySelection}
                    onSelect={(candidate) => {
                      void continueAfterEntitySelection(message.entitySelection as EntitySelectionPreview, candidate);
                    }}
                    onSkip={
                      message.entitySelection.intent === "create_schedule_event"
                        ? () => {
                            appendAssistantMessage({
                              content: message.entitySelection?.actionResponse ?? "Please confirm this schedule item.",
                              scheduleEvent: message.entitySelection?.payload as BrokerEventDraftInput
                            });
                          }
                        : undefined
                    }
                  />
                ) : null}
                {message.leadReply ? <LeadReplyCard draft={message.leadReply} /> : null}
                {message.promotion ? <PromotionPack promotion={message.promotion} /> : null}
                {message.promotionTarget ? (
                  <PromotionConfirmCard
                    initialChannels={message.promotionChannels}
                    listing={message.promotionTarget}
                    onGenerate={(channels) =>
                      generatePromotionForListing(
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
          );
        })}

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
