"use client";

import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CalendarClock,
  Camera,
  CheckCircle2,
  Copy,
  Globe2,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Pencil,
  Send,
  Sparkles,
  Square
} from "lucide-react";
import { useRouter } from "next/navigation";
import { isPromotionRequest } from "@/lib/agent/intent-router";
import type { BrokerEventDraftInput } from "@/lib/events/types";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";
import type { LeadReplyDraft } from "@/lib/leads/reply-types";
import type { LeadOperationPayload } from "@/lib/agent/types";
import type { ListingDraftInput } from "@/lib/listings/types";
import type { ListingPromotion, PromotionChannel } from "@/lib/promotions/types";

type RecentListingSummary = {
  id: string;
  title: string | null;
  location_area: string | null;
  city: string | null;
  property_type: string | null;
  area_value: number | null;
  area_unit: "kanal" | "marla" | "sqft" | "sqm" | null;
  bedrooms: number | null;
};

type AgentWorkspaceProps = {
  firstName: string;
  listingsCount: number;
  recentListings: RecentListingSummary[];
  recentLeads: LeadListItem[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  draft?: ListingDraftInput;
  scheduleEvent?: BrokerEventDraftInput;
  leadResults?: LeadListItem[];
  leadLatestOffer?: boolean;
  leadStatusUpdate?: LeadStatusUpdatePreview;
  leadReply?: LeadReplyDraftWithLink;
  promotion?: ListingPromotion;
  promotionTarget?: RecentListingSummary;
  promotionInstruction?: string;
};

type LeadStatusUpdatePreview = {
  lead: LeadListItem;
  status?: LeadRecord["status"];
  urgency?: LeadRecord["urgency"];
};

type LeadReplyDraftWithLink = LeadReplyDraft & {
  whatsapp_url: string;
};

const promotionChannels: Array<{ channel: PromotionChannel; label: string }> = [
  { channel: "whatsapp", label: "WhatsApp" },
  { channel: "facebook", label: "Facebook" },
  { channel: "instagram", label: "Instagram" },
  { channel: "portal", label: "Portal" }
];

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
  lead_name: string;
  listing_reference: string;
  location_text: string;
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
    lead_name: event.lead_name ?? "",
    listing_reference: event.listing_reference ?? "",
    location_text: event.location_text ?? ""
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
    lead_name: form.lead_name.trim() || undefined,
    listing_reference: form.listing_reference.trim() || undefined,
    location_text: form.location_text.trim() || undefined,
    source_payload: {
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
  listing,
  onGenerate
}: {
  listing: RecentListingSummary;
  onGenerate: (channels: PromotionChannel[]) => void;
}) {
  const [selectedChannels, setSelectedChannels] = useState<PromotionChannel[]>([
    "whatsapp",
    "facebook"
  ]);

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

function LeadResultsCard({ leads }: { leads: LeadListItem[] }) {
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
              <span className={`lead-status ${lead.status}`}>{lead.status}</span>
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
  pendingMedia,
  onSaved
}: {
  draft: ListingDraftInput;
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

      {pendingMedia.length ? (
        <div className="agent-media-preview" aria-label="Attached media">
          {pendingMedia.map((item) => (
            <div className="agent-media-thumb" key={item.id}>
              {item.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={item.file.name} />
              ) : (
                <video src={item.previewUrl} muted playsInline />
              )}
            </div>
          ))}
          <span>{pendingMedia.length} media ready</span>
        </div>
      ) : null}

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

export function AgentWorkspace({ firstName, listingsCount, recentLeads, recentListings }: AgentWorkspaceProps) {
  const [input, setInput] = useState("");
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeListingId, setActiveListingId] = useState<string | null>(recentListings[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content: `Good morning, ${firstName}. Tell me the property details in English, Urdu, or Roman Urdu. I will draft a listing preview for you to edit and confirm.`
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceLevels, setVoiceLevels] = useState(idleVoiceLevels);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingMediaRef = useRef<PendingMedia[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceAnimationFrameRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    pendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  useEffect(() => {
    return () => {
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

  function getPromotionTarget(messageText: string) {
    if (messageMentionsCurrentListing(messageText) && activeListingId) {
      return {
        listing: recentListings.find((listing) => listing.id === activeListingId) ?? null,
        ambiguous: false
      };
    }

    const scoredListings = recentListings
      .map((listing) => ({ listing, score: scoreListingMatch(messageText, listing) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    if (scoredListings.length > 1 && scoredListings[0].score === scoredListings[1].score) {
      return { listing: null, ambiguous: true };
    }

    if (scoredListings[0]) {
      return { listing: scoredListings[0].listing, ambiguous: false };
    }

    return {
      listing: recentListings.find((listing) => listing.id === activeListingId) ?? recentListings[0] ?? null,
      ambiguous: false
    };
  }

  function proposePromotionFromMessage(messageText: string) {
    const target = getPromotionTarget(messageText);

    if (target.ambiguous) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I found more than one matching listing. Please add one more detail, like phase, exact area size, price, or bedrooms."
        }
      ]);
      return;
    }

    if (!target.listing) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I need a confirmed listing before I can create a promotion pack. Describe a property first, confirm it, then ask me to promote it."
        }
      ]);
      return;
    }

    const selectedListing = target.listing;

    setActiveListingId(selectedListing.id);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: "I found a matching listing. Please confirm the property and choose channels before I generate campaign links.",
        promotionTarget: selectedListing,
        promotionInstruction: messageText
      }
    ]);
  }

  function getLeadTarget(payload: LeadOperationPayload) {
    if (payload.lead_id) {
      return {
        lead: recentLeads.find((lead) => lead.id === payload.lead_id) ?? null,
        ambiguous: false
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
      return { lead: null, ambiguous: true };
    }

    if (scoredLeads[0]) {
      return { lead: scoredLeads[0].lead, ambiguous: false };
    }

    return { lead: null, ambiguous: false };
  }

  function showLeadResults(actionResponse: string, payload: LeadOperationPayload) {
    const matchedLeads = filterLeadsByPayload(recentLeads, payload);

    if (!matchedLeads.length) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content:
            "I could not find a lead matching that request. I will not show unrelated records unless you confirm.",
          leadLatestOffer: recentLeads.length > 0
        }
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: actionResponse,
        leadResults: matchedLeads
      }
    ]);
  }

  function proposeLeadStatusUpdate(actionResponse: string, payload: LeadOperationPayload) {
    const target = getLeadTarget(payload);

    if (target.ambiguous) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I found more than one matching lead. Please add the buyer phone, full name, or listing detail."
        }
      ]);
      return;
    }

    if (!target.lead) {
      const requestedLead = payload.lead_name ? ` "${payload.lead_name}"` : "";
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: `I could not find a matching recent lead${requestedLead}. Please check the buyer name, phone number, or open Leads to choose the exact record.`
        }
      ]);
      return;
    }

    const matchedLead = target.lead;

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: actionResponse,
        leadStatusUpdate: {
          lead: matchedLead,
          status: payload.status,
          urgency: payload.urgency
        }
      }
    ]);
  }

  async function draftReplyForLead(actionResponse: string, payload: LeadOperationPayload) {
    const target = getLeadTarget(payload);

    if (target.ambiguous) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I found more than one matching lead. Please add the buyer phone, full name, or listing detail."
        }
      ]);
      return;
    }

    if (!target.lead) {
      const requestedLead = payload.lead_name ? ` "${payload.lead_name}"` : "";
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: `I could not find a matching recent lead${requestedLead} to reply to. Please check the buyer name, phone number, or open Leads to choose the exact record.`
        }
      ]);
      return;
    }

    const matchedLead = target.lead;

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: `I found ${matchedLead.full_name || "the buyer"}. Drafting a WhatsApp reply now...`
      }
    ]);

    const response = await fetch("/api/leads/reply-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lead_id: matchedLead.id })
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: errorPayload?.error ?? "I could not draft a reply for that lead yet."
        }
      ]);
      return;
    }

    const replyPayload = (await response.json()) as { draft: LeadReplyDraftWithLink };
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: actionResponse,
        leadReply: replyPayload.draft
      }
    ]);
  }

  async function generatePromotionForListing(
    listing: RecentListingSummary,
    instruction: string,
    channels: PromotionChannel[]
  ) {
    setActiveListingId(listing.id);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: `Confirmed. I am creating ${channels.length} channel campaign link${channels.length === 1 ? "" : "s"} and promotion copy for ${listing.title || "this listing"}...`
      }
    ]);

    const response = await fetch("/api/agent/promote-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ listing_id: listing.id, instruction, channels })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: payload?.error ?? "I could not generate the promotion pack yet. Please try again."
        }
      ]);
      return;
    }

    const payload = (await response.json()) as { promotion: ListingPromotion };
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content: "Here is the promotion pack. Each channel has its own lead page, so later we can attribute leads by listing and channel.",
        promotion: payload.promotion
      }
    ]);
  }

  async function submitMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    setInput("");
    setIsSubmitting(true);
    setMessages((current) => [...current, { id: createId(), role: "user", content: trimmed }]);

    try {
      if (isPromotionRequest(trimmed)) {
        proposePromotionFromMessage(trimmed);
        return;
      }

      const response = await fetch("/api/agent/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: trimmed })
      });

      if (!response.ok) {
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content: "I could not draft that listing yet. Please try again with location, size, and price."
          }
        ]);
        return;
      }

      const payload = (await response.json()) as {
        action: { intent: string; response: string; payload?: Record<string, unknown> };
      };
      const draft =
        payload.action.intent === "create_listing_draft"
          ? (payload.action.payload as ListingDraftInput)
          : undefined;
      const scheduleEvent =
        payload.action.intent === "create_schedule_event"
          ? (payload.action.payload as BrokerEventDraftInput)
          : undefined;
      const leadPayload = payload.action.payload as LeadOperationPayload | undefined;

      if (payload.action.intent === "list_leads" && leadPayload) {
        showLeadResults(payload.action.response, leadPayload);
        return;
      }

      if (payload.action.intent === "update_lead_status" && leadPayload) {
        proposeLeadStatusUpdate(payload.action.response, leadPayload);
        return;
      }

      if (payload.action.intent === "draft_lead_reply" && leadPayload) {
        await draftReplyForLead(payload.action.response, leadPayload);
        return;
      }

      const assistantMessageId = createId();

      if (draft) {
        setActiveDraftId(assistantMessageId);
      }

      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: "assistant",
          content: payload.action.response,
          draft,
          scheduleEvent
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I could not reach the agent service. Please try again in a moment."
        }
      ]);
    } finally {
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
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            role: "assistant",
            content:
              payload?.error ??
              "I could not transcribe that voice note yet. Please try again or type the property details."
          }
        ]);
        return;
      }

      setInput(payload.transcript);
      await submitMessage(payload.transcript);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I could not reach the voice transcription service. Please try again in a moment."
        }
      ]);
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "Voice recording is not available in this browser. You can type the listing details for now."
        }
      ]);
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
          setMessages((current) => [
            ...current,
            {
              id: createId(),
              role: "assistant",
              content: "I did not capture any audio. Please try recording again."
            }
          ]);
          return;
        }

        void transcribeVoiceNote(audioBlob, durationSeconds);
      };

      recorder.start();
      setIsListening(true);
    } catch {
      stopVoiceVisualization();
      setIsListening(false);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I could not access the microphone. Please allow microphone permission and try again."
        }
      ]);
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
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: "I can attach images or videos to a listing. Please choose media files."
        }
      ]);
      return;
    }

    setPendingMedia((current) => [...current, ...accepted]);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "user",
        content: `Attached ${accepted.length} media file${accepted.length === 1 ? "" : "s"} for this listing.`
      },
      {
        id: createId(),
        role: "assistant",
        content: activeDraftId
          ? "I attached the media to the current listing preview. It will upload when you confirm the listing."
          : "I attached the media. Now describe the property, and I will include these files when you confirm the listing."
      }
    ]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearPendingMedia() {
    pendingMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingMedia([]);
  }

  return (
    <section className={`chat-panel glass-panel ${messages.length === 1 ? "is-empty" : "has-thread"}`}>
      <div className="panel-header">
        <h2>
          <Bot size={20} /> Agent Workspace
        </h2>
        <span className="status-pill">Online</span>
      </div>

      <div className="messages">
        {messages.length === 1 ? (
          <div className="agent-start">
            <span>Pislaka Agent</span>
            <h2>What should we handle today?</h2>
            <p>
              Publish listings, capture leads, schedule viewings, or draft WhatsApp follow-ups in one conversation.
            </p>
          </div>
        ) : null}

        {messages.map((message, index) => (
          messages.length === 1 && index === 0 ? null : (
          <article className={`message ${message.role}`} key={message.id}>
            <p>{message.content}</p>
            {message.draft ? (
              <DraftPreviewCard
                draft={message.draft}
                pendingMedia={message.id === activeDraftId ? pendingMedia : []}
                onSaved={(uploadedCount, listingId) => {
                  clearPendingMedia();
                  setActiveDraftId(null);
                  setActiveListingId(listingId);
                  setMessages((current) => [
                    ...current,
                    {
                      id: createId(),
                      role: "assistant",
                      content: uploadedCount
                        ? `Done. I added it to your listing library with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}. You can open Listings from the sidebar to review and edit.`
                        : "Done. I added it to your listing library. You can open Listings from the sidebar to review media and edit details."
                    }
                  ]);
                }}
              />
            ) : null}
            {message.scheduleEvent ? (
              <SchedulePreviewCard
                event={message.scheduleEvent}
                onSaved={() => {
                  setMessages((current) => [
                    ...current,
                    {
                      id: createId(),
                      role: "assistant",
                      content:
                        "Done. I added it to Schedule. Next, I can show today's appointments and reminders from the workspace."
                    }
                  ]);
                }}
              />
            ) : null}
            {message.leadResults ? <LeadResultsCard leads={message.leadResults} /> : null}
            {message.leadLatestOffer ? (
              <LeadLatestOfferCard
                onConfirm={() => {
                  const latestLead = recentLeads[0] ? [recentLeads[0]] : [];
                  setMessages((current) => [
                    ...current,
                    {
                      id: createId(),
                      role: "assistant",
                      content: latestLead.length
                        ? "Confirmed. Here is the latest lead from your inbox."
                        : "There are no leads in your recent inbox yet.",
                      leadResults: latestLead
                    }
                  ]);
                }}
              />
            ) : null}
            {message.leadStatusUpdate ? (
              <LeadStatusConfirmCard
                preview={message.leadStatusUpdate}
                onUpdated={() => {
                  setMessages((current) => [
                    ...current,
                    {
                      id: createId(),
                      role: "assistant",
                      content: "Done. I updated the lead status. You can review all lead activity from the Leads page."
                    }
                  ]);
                }}
              />
            ) : null}
            {message.leadReply ? <LeadReplyCard draft={message.leadReply} /> : null}
            {message.promotion ? <PromotionPack promotion={message.promotion} /> : null}
            {message.promotionTarget ? (
              <PromotionConfirmCard
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
          </article>
          )
        ))}

        <div ref={messagesEndRef} />
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <div className="composer-row">
          <input
            ref={fileInputRef}
            className="media-file-input"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(event) => handleMediaSelected(event.target.files)}
          />
          <button type="button" aria-label="Attach listing media" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={20} />
          </button>
          {isListening || isTranscribing ? (
            <VoiceWaveform
              isTranscribing={isTranscribing}
              levels={voiceLevels}
              seconds={recordingSeconds}
            />
          ) : (
            <input
              placeholder="Ask Pislaka Agent to publish, follow up, or schedule..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          )}
          <button
            type="button"
            className={`voice-button ${isListening ? "recording" : ""}`}
            aria-label={isListening ? "Stop recording" : "Record voice"}
            aria-pressed={isListening}
            disabled={isTranscribing}
            onClick={handleVoiceInput}
          >
            {isTranscribing ? <LoaderCircle className="spin-icon" size={18} /> : isListening ? <Square size={15} /> : <Mic size={20} />}
          </button>
          <button
            type="submit"
            className="send-button"
            aria-label="Send message"
            disabled={isSubmitting || isListening || isTranscribing}
          >
            <Send size={19} />
          </button>
        </div>

        {messages.length === 1 ? (
          <div className="prompt-suggestions" aria-label="Common agent actions">
            <button
              type="button"
              onClick={() =>
                void submitMessage("Create a listing for 1 Kanal house in DHA Phase 6, price 8.5 crore.")
              }
            >
              <Sparkles size={15} /> Publish a listing
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Camera size={15} /> Add property media
            </button>
            <button type="button" onClick={() => void submitMessage("Record a new lead named Ahmed. He wants a 5 marla house in DHA Phase 5 with a budget around 1 crore.")}>
              <MessageCircle size={15} /> Capture a lead
            </button>
            <button type="button" onClick={() => void submitMessage("Schedule a viewing with Ahmed tomorrow at 3pm for my DHA Phase 5 villa.")}>
              <CalendarClock size={15} /> Create a schedule
            </button>
            <button type="button" onClick={() => void submitMessage("Promote my latest listing for WhatsApp, Facebook, Instagram, and portals.")}>
              <Megaphone size={15} /> Promote latest listing
            </button>
            <button type="button" onClick={() => void submitMessage("Which new leads should I follow up today?")}>
              <MessageCircle size={15} /> Review leads
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
