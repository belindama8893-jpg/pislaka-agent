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
import { AnalyticsSummaryCard } from "@/components/analytics/AnalyticsDashboard";
import { AgentComposer } from "@/components/agent/AgentComposer";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";
import {
  createAgentActionResponseHandlers,
  handleAgentActionResponse
} from "@/components/agent/agent-action-response-handlers";
import { createAgentAttachComposerActions } from "@/components/agent/agent-composer-attachments";
import {
  createAgentComposerContextPreviews,
  type AgentComposerContextAttachment
} from "@/components/agent/agent-composer-context";
import {
  formatAgentComposerFileSize,
} from "@/components/agent/agent-composer-files";
import { createAgentGuidanceComposerActions } from "@/components/agent/agent-guidance-actions";
import {
  buildAgentTurnContent,
  createRecentAgentContextMessages,
  getSelectedAgentContextEntityId,
  inferAgentWorkflowState
} from "@/components/agent/agent-submit-context";
import {
  canHandlePendingActionConfirmation,
  findLatestPendingPromotionAction,
  findLatestPendingSocialCopyAction,
  getBulkLeadWriteGuard,
  getEmptyAgentTurnResponse,
  type AgentPendingPromotionAction,
  type AgentPendingSocialCopyAction
} from "@/components/agent/agent-submit-workflow";
import {
  getWhatsAppImportTurn,
  isWhatsAppChatFile,
  type ChatImportRequestedAction
} from "@/components/agent/agent-whatsapp-import-turn";
import { AuthForm } from "@/components/auth/AuthForm";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AgentChatMessageRecord } from "@/lib/agent/conversations";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BrokerEventDraftInput, BrokerEventRecord } from "@/lib/events/types";
import { formatLeadStatusLabel, getLeadStatusClassName } from "@/lib/leads/display";
import {
  formatBrokerDateTime,
  fromBrokerDatetimeLocal,
  getBrokerDayRange,
  getResolvedTimeZone,
  toBrokerDatetimeLocal
} from "@/lib/events/time";
import type { LeadListItem, LeadRecord, TodayFollowUpLead } from "@/lib/leads/types";
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
import { isScheduleRequest } from "@/lib/agent/intent-router";
import {
  buildAgentGuidanceContext,
  getAgentComposerPlaceholder,
  getAgentGuidanceSuggestions
} from "@/lib/agent/guidance";
import {
  detectAgentResponseLanguage,
  formatScheduleQueryResponse,
  type AgentResponseLanguage
} from "@/lib/agent/response-language";
import {
  detectExplicitResponseLanguage,
  detectTurnUiLanguage,
  getAgentCardCopy,
  getCardLanguage,
  getLeadCardCopy,
  getScheduleCardCopy,
  getWhatsAppImportProgressCopy
} from "@/lib/agent/agent-ui-copy";
import type { ListingDraftInput, ListingDraftUpdateInput, ListingMediaRecord } from "@/lib/listings/types";
import type { ListingPromotion, PromotionChannel } from "@/lib/promotions/types";
import type { AnalyticsFocus, AnalyticsRange, AnalyticsSummary } from "@/lib/analytics/types";

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
  conversationId?: string;
  firstName: string;
  hasOlderMessages: boolean;
  initialAuthOpen?: boolean;
  initialWhatsAppImportOpen?: boolean;
  initialMessages: AgentChatMessageRecord[];
  initialContextAttachments?: ChatContextAttachment[];
  isGuest?: boolean;
  recentListings: RecentListingSummary[];
  recentLeads: LeadListItem[];
};

const FOLLOW_UP_NUDGE_DISMISS_PREFIX = "pislaka_followup_nudge_dismissed";
const AUTH_REQUIRED_STATUS = "Sign in to save this to your workspace.";
const GUEST_CHAT_STORAGE_KEY = "pislaka_guest_chat_v1";
const GUEST_CHAT_RESTORE_FLAG = "pislaka_restore_guest_chat";
const GUEST_CHAT_IMPORT_SUCCESS_FLAG = "pislaka_guest_chat_import_success";
const GUEST_CHAT_TTL_MS = 24 * 60 * 60 * 1000;

type AuthRequiredReason =
  | "chat_history"
  | "save_listing"
  | "save_lead"
  | "update_lead"
  | "save_followup"
  | "save_schedule"
  | "read_workspace";

type AuthRequiredHandler = (reason: AuthRequiredReason) => void;

function isUnauthorizedResponse(response: Response) {
  return response.status === 401;
}

function getAuthRequiredMessage(reason: AuthRequiredReason) {
  switch (reason) {
    case "read_workspace":
      return "I need access to your saved workspace to check this. Sign in and I can continue from here.";
    case "save_listing":
      return "I can preview the listing draft here. To save it to your workspace, sign in and I can continue from this draft.";
    case "save_lead":
      return "I can preview the lead details here. To save the lead and keep the chat history, sign in and I can continue from this point.";
    case "update_lead":
      return "Updating a saved lead needs your workspace account. Sign in and I can continue with this change.";
    case "save_followup":
      return "To save this follow-up and keep the chat history, sign in and I can continue from here.";
    case "save_schedule":
      return "To save this schedule item to your workspace, sign in and I can continue from here.";
    case "chat_history":
    default:
      return "Sign in to save this chat history and workspace data.";
  }
}

type LeadCardItem = LeadListItem | TodayFollowUpLead;

type ChatMessage = {
  id: string;
  createdAt?: string;
  role: "user" | "assistant";
  content: string;
  authRequiredReason?: AuthRequiredReason;
  sourceMessage?: string;
  uiLanguage?: AgentResponseLanguage;
  isProgress?: boolean;
  isStreaming?: boolean;
  attachments?: PendingMedia[];
  draftMedia?: PendingMedia[];
  contextAttachments?: ChatContextAttachment[];
  fileAttachments?: PendingFileAttachment[];
  draft?: ListingDraftInput;
  scheduleEvent?: BrokerEventDraftInput;
  scheduleEvents?: BrokerEventRecord[];
  scheduleSourceMessage?: string;
  leadResults?: LeadCardItem[];
  leadSourceMessage?: string;
  leadLatestOffer?: boolean;
  analyticsSummary?: AnalyticsSummary;
  leadDetailsUpdate?: LeadDetailsUpdatePreview;
  leadCreate?: LeadCreatePreview;
  leadBatchStatusUpdate?: LeadBatchStatusUpdatePreview;
  leadListingUpdate?: LeadListingUpdatePreview;
  leadStatusUpdate?: LeadStatusUpdatePreview;
  leadReply?: LeadReplyDraftWithLink;
  chatImport?: ChatImportPreview;
  chatReplyAction?: ChatReplyActionPreview;
  chatFollowupManage?: ChatFollowupManagePreview;
  chatFollowupNote?: ChatFollowupManagePreview;
  chatReminder?: ChatFollowupManagePreview;
  chatStatus?: ChatFollowupManagePreview;
  chatLeadChoice?: ChatLeadChoicePreview;
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

type GuestStoredMessage = {
  role: "user" | "assistant";
  content: string;
  message_type?: string;
  structured_payload?: Record<string, unknown>;
};

type GuestStoredTranscript = {
  createdAt: number;
  messages: GuestStoredMessage[];
};

type PendingPromotionAction = AgentPendingPromotionAction<RecentListingSummary, PromotionChannel>;

type PendingSocialCopyAction = AgentPendingSocialCopyAction<ListingPromotion, PromotionChannel>;

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
  activityType?: "message_sent" | "status_changed";
  summary?: string;
};

type LeadDetailsUpdateChanges = Partial<Pick<LeadDetailsUpdatePayload, "full_name" | "phone" | "email" | "message">>;

type LeadDetailsUpdatePreview = {
  lead: LeadListItem;
  changes: LeadDetailsUpdateChanges;
};

type LeadCreatePreview = {
  payload: LeadCreatePayload;
  followUp?: LeadCreateFollowUpPreview;
};

type LeadCreateFollowUpPreview = {
  summary: string;
  sourceType: ChatFollowupSummary["source_type"];
  messageDraft?: string;
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
  lead_id?: string;
};

type ChatFollowupSummary = {
  source_type: "whatsapp_paste" | "whatsapp_txt_upload" | "whatsapp_zip_upload";
  save_original_chat_text: boolean;
  original_chat_text: string | null;
  resolution_status: "matched" | "ambiguous" | "no_match" | "needs_clarification";
  matched_lead: LeadListItem | null;
  candidate_leads: LeadListItem[];
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
  status_suggestion: LeadRecord["status"];
  urgency_suggestion: LeadRecord["urgency"];
  next_action_suggestion: string;
  reply_draft: LeadReplyDraft;
};

type ZipTextCandidate = {
  name: string;
  size: number;
};

type ChatImportPreview = {
  summary?: ChatFollowupSummary;
  zipCandidates?: ZipTextCandidate[];
  pendingZipFile?: File;
  selectedLead?: LeadListItem | null;
  selectedLeadId?: string | null;
};

type ChatImportAction = "reply" | "manage_followup" | "choose_lead" | "create_lead";

type ChatReplyActionPreview = {
  summary: ChatFollowupSummary;
  lead?: LeadListItem | null;
};

type ChatFollowupManagePreview = {
  summary: ChatFollowupSummary;
  lead: LeadListItem;
  suggestedAction?: ChatFollowupNextAction;
};

type ChatLeadChoicePreview = {
  summary: ChatFollowupSummary;
  candidates: LeadListItem[];
};

type ChatFollowupNextAction = "note" | "reminder" | "status";

type AgentResolution = NonNullable<AgentAction["resolution"]>;
type AgentResolutionCandidate = NonNullable<AgentResolution["matched"]>;

type ListingResolutionCandidate = AgentResolutionCandidate;

type ChatMessageUiPayload = Partial<
  Pick<
    ChatMessage,
    | "sourceMessage"
    | "uiLanguage"
    | "attachments"
    | "draftMedia"
    | "contextAttachments"
    | "fileAttachments"
    | "draft"
    | "scheduleEvent"
    | "scheduleEvents"
    | "scheduleSourceMessage"
    | "leadResults"
    | "leadSourceMessage"
    | "leadLatestOffer"
    | "leadDetailsUpdate"
    | "leadCreate"
    | "leadBatchStatusUpdate"
    | "leadListingUpdate"
    | "leadStatusUpdate"
    | "leadReply"
    | "chatImport"
    | "chatReplyAction"
    | "chatFollowupManage"
    | "chatFollowupNote"
    | "chatReminder"
    | "chatStatus"
    | "chatLeadChoice"
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

type ChatContextAttachment = AgentComposerContextAttachment;

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
    last_contacted_at: null,
    next_follow_up_at: null,
    last_note: null,
    budget_min: null,
    budget_max: null,
    interested_area: null,
    interested_listing_id: null,
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

function serializeFileAttachments(fileAttachments: PendingFileAttachment[] | undefined) {
  return fileAttachments?.map((item) => ({
    id: item.id,
    kind: item.kind,
    file: {
      name: item.file.name,
      size: item.file.size,
      type: item.file.type
    }
  }));
}

function dataUrlToFile(dataUrl: string, name: string, type: string) {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] ?? type;
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], name, { type: mime || type });
}

function deserializeMediaAttachments(value: unknown): PendingMedia[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const restored = value
    .map((item): PendingMedia | null => {
      if (!isRecord(item) || typeof item.dataUrl !== "string") {
        return null;
      }
      const fileRecord = isRecord(item.file) ? item.file : {};
      const name = typeof fileRecord.name === "string" ? fileRecord.name : "uploaded-image.jpg";
      const type = typeof fileRecord.type === "string" ? fileRecord.type : "image/jpeg";
      const size = typeof fileRecord.size === "number" ? fileRecord.size : 0;
      const mediaType = item.mediaType === "video" ? "video" : "image";
      return {
        id: typeof item.id === "string" ? item.id : createId(),
        file: { name, size, type } as File,
        previewUrl: item.dataUrl,
        mediaType,
        dataUrl: item.dataUrl
      };
    })
    .filter((item): item is PendingMedia => Boolean(item));

  return restored.length ? restored : undefined;
}

function serializeMediaAttachments(media: PendingMedia[] | undefined) {
  return media
    ?.filter((item) => item.dataUrl)
    .map((item) => ({
      id: item.id,
      mediaType: item.mediaType,
      dataUrl: item.dataUrl,
      file: {
        name: item.file.name,
        size: item.file.size,
        type: item.file.type
      }
    }));
}

function chatMessageFromRecord(record: AgentChatMessageRecord): ChatMessage {
  const uiPayload = getMessageUiPayload(record.structured_payload);
  return {
    id: record.id,
    createdAt: record.created_at,
    role: record.role,
    content: record.content,
    ...uiPayload,
    attachments: deserializeMediaAttachments(uiPayload.attachments),
    draftMedia: deserializeMediaAttachments(uiPayload.draftMedia)
  };
}

function detectLatestExplicitLanguagePreference(messages: AgentChatMessageRecord[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") {
      continue;
    }

    const language = detectExplicitResponseLanguage(message.content);
    if (language) {
      return language;
    }
  }

  return null;
}

function hasStructuredOutput(message: ChatMessage) {
  return Boolean(
    message.draft ||
      message.scheduleEvent ||
      message.scheduleEvents ||
      message.leadResults ||
      message.leadLatestOffer ||
      message.analyticsSummary ||
      message.leadDetailsUpdate ||
      message.leadCreate ||
      message.leadBatchStatusUpdate ||
      message.leadListingUpdate ||
      message.leadStatusUpdate ||
      message.leadReply ||
      message.chatImport ||
      message.chatReplyAction ||
      message.chatFollowupManage ||
      message.chatFollowupNote ||
      message.chatReminder ||
      message.chatStatus ||
      message.chatLeadChoice ||
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
    "sourceMessage",
    "uiLanguage",
    "contextAttachments",
    "draft",
    "scheduleEvent",
    "scheduleEvents",
    "scheduleSourceMessage",
    "leadResults",
    "leadSourceMessage",
    "leadLatestOffer",
    "analyticsSummary",
    "leadDetailsUpdate",
    "leadCreate",
    "leadBatchStatusUpdate",
    "leadListingUpdate",
    "leadStatusUpdate",
    "leadReply",
    "chatImport",
    "chatReplyAction",
    "chatFollowupManage",
    "chatFollowupNote",
    "chatReminder",
    "chatStatus",
    "chatLeadChoice",
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
      ui[key] =
        key === "chatImport"
          ? {
              summary: message.chatImport?.summary,
              selectedLead: message.chatImport?.selectedLead,
              selectedLeadId: message.chatImport?.selectedLeadId,
              zipCandidates: message.chatImport?.pendingZipFile ? undefined : message.chatImport?.zipCandidates
            }
          : message[key];
    }
  }

  const fileAttachments = serializeFileAttachments(message.fileAttachments);
  if (fileAttachments?.length) {
    ui.fileAttachments = fileAttachments;
  }
  const attachments = serializeMediaAttachments(message.attachments);
  if (attachments?.length) {
    ui.attachments = attachments;
  }
  const draftMedia = serializeMediaAttachments(message.draftMedia);
  if (draftMedia?.length) {
    ui.draftMedia = draftMedia;
  }

  return Object.keys(ui).length ? { ui } : {};
}

function isGuestTranscriptExpired(transcript: GuestStoredTranscript) {
  return Date.now() - transcript.createdAt > GUEST_CHAT_TTL_MS;
}

function readGuestTranscript() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(GUEST_CHAT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as GuestStoredTranscript;
    if (!parsed?.createdAt || !Array.isArray(parsed.messages) || isGuestTranscriptExpired(parsed)) {
      window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
    return null;
  }
}

function writeGuestTranscript(messages: ChatMessage[]) {
  if (typeof window === "undefined") {
    return;
  }

  const transcriptMessages = messages
    .filter((message) => !message.isProgress && message.content.trim())
    .filter((message) => !message.authRequiredReason)
    .filter((message, index) => !(index === 0 && message.role === "assistant" && !hasStructuredOutput(message)))
    .map((message) => {
      const structuredPayload = structuredPayloadForMessage(message);
      return {
        role: message.role,
        content: message.content,
        message_type: "text",
        structured_payload: Object.keys(structuredPayload).length ? structuredPayload : undefined
      } satisfies GuestStoredMessage;
    });

  if (!transcriptMessages.length) {
    window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
    return;
  }

  const existing = readGuestTranscript();
  window.localStorage.setItem(
    GUEST_CHAT_STORAGE_KEY,
    JSON.stringify({
      createdAt: existing?.createdAt ?? Date.now(),
      messages: transcriptMessages.slice(-100)
    } satisfies GuestStoredTranscript)
  );
}

function clearGuestTranscript() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(GUEST_CHAT_STORAGE_KEY);
  window.localStorage.removeItem(GUEST_CHAT_RESTORE_FLAG);
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

function looksLikeExternalChannelPromotion(messageText: string) {
  return (
    /\b(?:share|post|publish|send)\b|发布|分享|发送/iu.test(messageText) &&
    /\b(?:whats\s*app|whatsapp|wa|facebook|fb|instagram|insta|ig|portal|zameen|olx)\b|门户|平台/iu.test(
      messageText
    )
  );
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
  dataUrl?: string;
};

type RemoteListingImage = {
  url: string;
  alt?: string;
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

type AgentVisionAnalyzeResponse = {
  analyses?: Array<{
    image_type?: string;
    summary?: string;
    extracted_text?: string;
    entities?: Record<string, unknown>;
    suggested_intent?: string;
    confidence?: number;
    missing_information?: string[];
  }>;
  agent_context?: string;
  error?: string;
};

type PendingFileAttachment = {
  id: string;
  file: File;
  kind?: "document" | "whatsapp_chat";
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
      .slice(8, 10)
      .join("")}-${hex.slice(10).join("")}`;
  }

  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function formatChatImportBudget(summary: ChatFollowupSummary) {
  if (summary.budget.text) {
    return summary.budget.text;
  }

  if (summary.budget.min) {
    return `PKR ${summary.budget.min.toLocaleString("en-PK")}`;
  }

  return "Not detected";
}

function getDefaultFollowUpReminderLocalValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function buildChatImportNarrative(
  summary: ChatFollowupSummary,
  lead: LeadListItem | null,
  uiLanguage: AgentResponseLanguage = "english"
) {
  const leadLabel = lead?.full_name || lead?.phone;
  const detectedLabel = [summary.detected_customer_name, summary.detected_phone].filter(Boolean).join(" · ");

  if (uiLanguage === "chinese") {
    const lines = [
      `我已阅读这段 WhatsApp 聊天。${summary.chat_summary}`,
      lead
        ? `它看起来关联到 ${leadLabel || "已选择的线索"}（${formatLeadStatusForLanguage(lead.status, lead.urgency, uiLanguage)}）。`
        : detectedLabel
          ? `我识别到 ${detectedLabel}，但还没有确认匹配的现有线索。`
          : "我还不能确认这段聊天属于哪条线索。"
    ];

    return lines.join("\n\n");
  }

  if (uiLanguage === "urdu") {
    const lines = [
      `میں نے WhatsApp chat پڑھ لی ہے۔ ${summary.chat_summary}`,
      lead
        ? `یہ ${leadLabel || "selected lead"} سے connected لگتی ہے (${formatLeadStatusForLanguage(lead.status, lead.urgency, uiLanguage)})۔`
        : detectedLabel
          ? `مجھے ${detectedLabel} detect ہوا، لیکن existing lead ابھی confirm نہیں ہوئی۔`
          : "ابھی confirm نہیں ہوا کہ یہ chat کس lead سے belong کرتی ہے۔"
    ];

    return lines.join("\n\n");
  }

  if (uiLanguage === "roman_urdu") {
    const lines = [
      `Main ne WhatsApp chat parh li hai. ${summary.chat_summary}`,
      lead
        ? `Yeh ${leadLabel || "selected lead"} se connected lagti hai (${formatLeadStatusForLanguage(lead.status, lead.urgency, uiLanguage)}).`
        : detectedLabel
          ? `Mujhe ${detectedLabel} detect hua, lekin existing lead abhi confirm nahi hui.`
          : "Abhi confirm nahi hua ke yeh chat kis lead se belong karti hai."
    ];

    return lines.join("\n\n");
  }

  const lines = [
    `I read the WhatsApp chat. ${summary.chat_summary}`,
    lead
      ? `It looks connected to ${leadLabel || "the selected lead"} (${formatLeadStatusForLanguage(lead.status, lead.urgency, uiLanguage)}).`
      : summary.detected_customer_name || summary.detected_phone
        ? `I detected ${[summary.detected_customer_name, summary.detected_phone].filter(Boolean).join(" · ")}, but I have not confirmed an existing lead yet.`
        : "I have not confirmed which lead this belongs to yet."
  ];

  return lines.join("\n\n");
}

function recommendChatFollowupAction(summary: ChatFollowupSummary, lead: LeadListItem): ChatFollowupNextAction | null {
  const signalText = [
    summary.chat_summary,
    summary.next_action_suggestion,
    summary.viewing_intent,
    summary.interested_area,
    summary.interested_listing_text,
    ...summary.customer_needs,
    ...summary.main_objections
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasViewingTime = Boolean(summary.viewing_intent) || /\b(today|tomorrow|tonight|morning|evening|pm|am|visit|viewing|schedule|appointment|6pm|7pm|8pm)\b/i.test(signalText);
  const isStrongLost = summary.status_suggestion === "lost" || /not interested|no longer|stop|don't contact|dont contact|not looking/i.test(signalText);
  const isStrongQualified =
    summary.status_suggestion === "qualified" ||
    summary.urgency_suggestion === "high" ||
    /interested|serious|confirm|budget|final demand|documents clear|ready to visit/i.test(signalText);

  if (isStrongLost) {
    return "status";
  }

  if ((lead.status === "new" || lead.status === "contacted") && isStrongQualified) {
    return "status";
  }

  if (hasViewingTime) {
    return "reminder";
  }

  if (summary.chat_summary && summary.chat_summary.length > 24) {
    return "note";
  }

  return null;
}

function getSuggestedLeadStatus(summary: ChatFollowupSummary): {
  status: LeadRecord["status"];
  urgency?: LeadRecord["urgency"];
} {
  if (summary.status_suggestion === "qualified") {
    return {
      status: "qualified",
      urgency: summary.urgency_suggestion === "high" ? "high" : summary.urgency_suggestion
    };
  }

  if (summary.status_suggestion === "lost") {
    return { status: "lost" };
  }

  return {
    status: summary.status_suggestion || "contacted",
    urgency: summary.urgency_suggestion ?? undefined
  };
}

function buildLeadCreateFollowUpFromChat(summary: ChatFollowupSummary): LeadCreateFollowUpPreview {
  return {
    summary: summary.chat_summary,
    sourceType: summary.source_type,
    messageDraft: summary.reply_draft?.reply_text
  };
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
    summary: [formatLeadStatusLabel(lead.status, lead.urgency), getLeadInterestLine(lead), lead.phone || null].filter(Boolean).join(" · "),
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

function uniqueLeadsById(leads: LeadListItem[]) {
  const seen = new Set<string>();
  const unique: LeadListItem[] = [];

  for (const lead of leads) {
    if (seen.has(lead.id)) {
      continue;
    }
    seen.add(lead.id);
    unique.push(lead);
  }

  return unique;
}

function leadFromContextAttachment(attachment: ChatContextAttachment): LeadListItem | null {
  if (attachment.type !== "lead") {
    return null;
  }

  const snapshot = attachment.snapshot ?? {};

  return {
    id: attachment.entity_id,
    broker_id: "",
    listing_id: null,
    campaign_link_id: null,
    source_channel: typeof snapshot.source_channel === "string" ? snapshot.source_channel : null,
    full_name: typeof snapshot.full_name === "string" ? snapshot.full_name : attachment.label,
    phone: typeof snapshot.phone === "string" ? snapshot.phone : null,
    email: typeof snapshot.email === "string" ? snapshot.email : null,
    message: null,
    status: (typeof snapshot.status === "string" ? snapshot.status : "new") as LeadRecord["status"],
    urgency: (typeof snapshot.urgency === "string" ? snapshot.urgency : null) as LeadRecord["urgency"],
    ai_summary: null,
    last_contacted_at: null,
    next_follow_up_at: null,
    last_note: null,
    budget_min: null,
    budget_max: null,
    interested_area: null,
    interested_listing_id: null,
    created_at: new Date().toISOString(),
    updated_at: null,
    listing_title: typeof snapshot.listing_title === "string" ? snapshot.listing_title : null,
    listing_area: typeof snapshot.listing_area === "string" ? snapshot.listing_area : null,
    listing_city: typeof snapshot.listing_city === "string" ? snapshot.listing_city : null,
    campaign_code: null,
    campaign_channel: typeof snapshot.campaign_channel === "string" ? snapshot.campaign_channel : null
  };
}

async function prepareImageForVision(file: File) {
  if (typeof window === "undefined" || typeof document === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.72);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "uploaded-image";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

async function createPendingMedia(file: File): Promise<PendingMedia> {
  const mediaType = file.type.startsWith("image/") ? ("image" as const) : ("video" as const);
  const restorableFile = mediaType === "image" ? await prepareImageForVision(file) : file;
  const dataUrl = mediaType === "image" ? await fileToDataUrl(restorableFile).catch(() => undefined) : undefined;

  return {
    id: createId(),
    file: restorableFile,
    previewUrl: dataUrl ?? URL.createObjectURL(restorableFile),
    mediaType,
    dataUrl
  };
}

async function analyzeComposerImages(messageText: string, media: PendingMedia[]) {
  const imageMedia = media.filter((item) => item.mediaType === "image").slice(0, 4);

  if (!imageMedia.length) {
    return { agentContext: "", payload: {} };
  }

  const formData = new FormData();
  formData.append("message", messageText);
  const preparedImages = await Promise.all(imageMedia.map((item) => prepareImageForVision(item.file)));
  preparedImages.forEach((file) => {
    formData.append("images", file);
  });

  const response = await fetch("/api/agent/vision/analyze", {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as AgentVisionAnalyzeResponse | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to analyze uploaded images.");
  }

  return {
    agentContext: payload?.agent_context?.trim() ?? "",
    payload: payload ?? {}
  };
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
    const uploadFile = item.dataUrl ? dataUrlToFile(item.dataUrl, item.file.name, item.file.type) : item.file;

    try {
      const prepareResponse = await fetch("/api/listings/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "prepare-upload",
          content_type: uploadFile.type,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          listing_id: listingId
        })
      });

      if (!prepareResponse.ok) {
        const payload = (await prepareResponse.json().catch(() => null)) as { error?: string } | null;
        failedMedia.push({
          id: item.id,
          name: uploadFile.name,
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
          name: uploadFile.name,
          error: "Upload response did not include a signed upload URL"
        });
        onStatusChange?.(item.id, "failed");
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(uploadPayload.bucket ?? "listing-media")
        .uploadToSignedUrl(uploadPayload.storage_path, uploadPayload.token, uploadFile, {
          contentType: uploadFile.type
        });

      if (uploadError) {
        failedMedia.push({
          id: item.id,
          name: uploadFile.name,
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
          content_type: uploadFile.type,
          file_size: uploadFile.size,
          listing_id: listingId,
          media_type: uploadPayload.media_type,
          storage_path: uploadPayload.storage_path
        })
      });

      if (!completeResponse.ok) {
        const payload = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
        failedMedia.push({
          id: item.id,
          name: uploadFile.name,
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
          name: uploadFile.name,
          error: "Upload response did not include saved media"
        });
        onStatusChange?.(item.id, "failed");
      }
    } catch (error) {
      failedMedia.push({
        id: item.id,
        name: uploadFile.name,
        error: error instanceof Error ? error.message : "Network error while uploading media"
      });
      onStatusChange?.(item.id, "failed");
    }
  }

  return { uploadedMedia, failedMedia };
}

function getDraftRemoteImages(draft: ListingDraftInput): RemoteListingImage[] {
  const payload = draft.ai_extracted_payload;
  const remoteImages = payload?.remote_images;

  if (!Array.isArray(remoteImages)) {
    return [];
  }

  return remoteImages
    .flatMap((item): RemoteListingImage[] => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const record = item as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";
      if (!url) {
        return [];
      }

      const image: RemoteListingImage = { url };
      if (typeof record.alt === "string") {
        image.alt = record.alt;
      }

      return [image];
    });
}

function getRemoteImagePreviewUrl(url: string) {
  return `/api/listings/remote-image?url=${encodeURIComponent(url)}`;
}

async function importRemoteListingImages(
  listingId: string,
  images: RemoteListingImage[],
  onStatusChange?: (mediaId: string, status: PendingMediaUploadStatus) => void
): Promise<ListingMediaUploadResult> {
  const uploadedMedia: ListingMediaRecord[] = [];
  const failedMedia: FailedMediaUpload[] = [];

  for (const [index, image] of images.entries()) {
    const id = `remote-${index}`;
    onStatusChange?.(id, "uploading");

    try {
      const response = await fetch("/api/listings/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "import-remote",
          listing_id: listingId,
          url: image.url
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        failedMedia.push({
          id,
          name: image.alt || `Imported image ${index + 1}`,
          error: payload?.error ?? "Unable to import remote image"
        });
        onStatusChange?.(id, "failed");
        continue;
      }

      const payload = (await response.json()) as { media?: ListingMediaRecord };
      if (payload.media) {
        uploadedMedia.push(payload.media);
        onStatusChange?.(id, "uploaded");
      } else {
        failedMedia.push({
          id,
          name: image.alt || `Imported image ${index + 1}`,
          error: "Import response did not include saved media"
        });
        onStatusChange?.(id, "failed");
      }
    } catch (error) {
      failedMedia.push({
        id,
        name: image.alt || `Imported image ${index + 1}`,
        error: error instanceof Error ? error.message : "Network error while importing image"
      });
      onStatusChange?.(id, "failed");
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
  return /这套|这个|刚才|刚刚|链接|推广链接|专属链接|link|links|tracking|current|this listing|this property/i.test(message);
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

function draftToRecentListingSummary(listingId: string, draft: ListingDraftInput): RecentListingSummary {
  return {
    id: listingId,
    status: "draft",
    title: draft.title ?? null,
    description: draft.description ?? null,
    location_area: draft.location_area ?? null,
    city: draft.city ?? null,
    property_type: draft.property_type ?? null,
    listing_type: draft.listing_type ?? null,
    price_amount: draft.price_amount ?? null,
    price_currency: draft.price_currency ?? null,
    area_value: draft.area_value ?? null,
    area_unit: draft.area_unit ?? null,
    bedrooms: draft.bedrooms ?? null,
    bathrooms: draft.bathrooms ?? null,
    features: draft.features ?? null
  };
}

function getPromotionAssetChannels(draft: ListingDraftInput): PromotionChannel[] {
  const channels = draft.ai_extracted_payload?.channels;

  if (!Array.isArray(channels)) {
    return ["facebook"];
  }

  const validChannels = channels.filter((channel): channel is PromotionChannel =>
    ["whatsapp", "facebook", "instagram", "portal"].includes(String(channel))
  );

  return validChannels.length ? validChannels : ["facebook"];
}

function formatLeadStatusForLanguage(
  status: LeadRecord["status"],
  urgency: LeadRecord["urgency"] | null | undefined,
  language: AgentResponseLanguage
) {
  const copy = getLeadCardCopy(language);
  if (status === "qualified" && urgency === "high") {
    return copy.statuses.hot;
  }

  return copy.statuses[status];
}

function getLeadInterestLine(lead: LeadListItem, language: AgentResponseLanguage = "english") {
  const copy = getLeadCardCopy(language);
  const listing = [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ");
  const channel = lead.campaign_channel ?? lead.source_channel;

  return [listing || copy.listingNotSet, channel ? `${copy.via} ${channel}` : null].filter(Boolean).join(" · ");
}

function getLeadChannelLabel(lead: LeadListItem) {
  return lead.campaign_channel ?? lead.source_channel ?? "Unknown channel";
}

function getLeadListingLabel(lead: LeadListItem) {
  return [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ") || "Listing not set";
}

function getLeadContactTimeLabel(lead: LeadListItem) {
  if (lead.last_contacted_at) {
    return `Last contact ${formatLeadCreatedAt(lead.last_contacted_at)}`;
  }

  return `Inquiry ${formatLeadCreatedAt(lead.created_at)}`;
}

function getLeadContentSummary(lead: LeadListItem) {
  return lead.last_note || lead.ai_summary || lead.message || "No inquiry content captured yet.";
}

function isTodayFollowUpLead(lead: LeadCardItem): lead is TodayFollowUpLead {
  return "recommended_reason" in lead && "recommended_action" in lead;
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

function getChatLeadCandidateEvidence(summary: ChatFollowupSummary, lead: LeadListItem) {
  const detectedPhone = normalizeWhatsAppPhone(summary.detected_phone);
  const leadPhone = normalizeWhatsAppPhone(lead.phone);
  const detectedName = normalizeListingText(summary.detected_customer_name ?? "");
  const leadName = normalizeListingText(lead.full_name ?? "");
  const chatText = normalizeListingText(
    [
      summary.detected_customer_name,
      summary.detected_phone,
      summary.chat_summary,
      summary.interested_area,
      summary.interested_listing_text,
      ...summary.customer_needs,
      ...summary.main_objections
    ]
      .filter(Boolean)
      .join(" ")
  );
  const evidence: string[] = [];

  if (detectedPhone && leadPhone) {
    const shorterPhone = detectedPhone.length < leadPhone.length ? detectedPhone : leadPhone;
    const longerPhone = detectedPhone.length < leadPhone.length ? leadPhone : detectedPhone;
    if (shorterPhone.length >= 7 && longerPhone.endsWith(shorterPhone)) {
      evidence.push("phone");
    }
  }

  if (detectedName && leadName) {
    const detectedNameTokens = detectedName.split(" ").filter((token) => token.length >= 3);
    const leadNameTokens = leadName.split(" ").filter((token) => token.length >= 3);
    const sharedNameTokens = detectedNameTokens.filter((token) => leadNameTokens.includes(token));

    if (detectedName === leadName || sharedNameTokens.length >= 1) {
      evidence.push("name");
    }
  }

  if (lead.email && chatText.includes(normalizeListingText(lead.email))) {
    evidence.push("email");
  }

  if (lead.listing_title && chatText.includes(normalizeListingText(lead.listing_title))) {
    evidence.push("listing");
  }

  return evidence;
}

function getVerifiedChatLeadCandidates(summary: ChatFollowupSummary) {
  return uniqueLeadsById(summary.candidate_leads).filter((lead) => getChatLeadCandidateEvidence(summary, lead).length > 0);
}

function filterLeadsByPayload(leads: LeadListItem[], payload: LeadOperationPayload, fallbackQuery = "") {
  const queryText = [payload.query, payload.lead_name, fallbackQuery].filter(Boolean).join(" ");
  const inferredFilter = inferLeadStatusFilterFromQuery(queryText);
  const statusFilter = payload.status_filter && payload.status_filter !== "all" ? payload.status_filter : inferredFilter?.status_filter;
  const urgencyFilter = payload.urgency ?? inferredFilter?.urgency;
  const channelFilter = payload.channel_filter?.toLowerCase();
  const explicitLeadQuery = payload.lead_name ? normalizeListingText(payload.lead_name) : "";

  return leads
    .filter((lead) => !statusFilter || lead.status === statusFilter)
    .filter((lead) => !urgencyFilter || lead.urgency === urgencyFilter)
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

function describeLeadResultSet(payload: LeadOperationPayload, fallbackQuery = "", language: AgentResponseLanguage = "english") {
  const queryText = [payload.query, payload.lead_name, fallbackQuery].filter(Boolean).join(" ");
  const inferredFilter = inferLeadStatusFilterFromQuery(queryText);
  const statusFilter = payload.status_filter && payload.status_filter !== "all" ? payload.status_filter : inferredFilter?.status_filter;
  const urgencyFilter = payload.urgency ?? inferredFilter?.urgency;
  const descriptors = {
    english: {
      hot: ["hot lead", "hot leads"],
      interested: ["interested lead", "interested leads"],
      lost: ["not interested lead", "not interested leads"],
      contacted: ["contacted lead", "contacted leads"],
      new: ["new lead", "new leads"],
      matching: ["matching lead", "matching leads"]
    },
    urdu: {
      hot: ["ہاٹ لیڈ", "ہاٹ لیڈز"],
      interested: ["دلچسپی رکھنے والی لیڈ", "دلچسپی رکھنے والی لیڈز"],
      lost: ["دلچسپی نہ رکھنے والی لیڈ", "دلچسپی نہ رکھنے والی لیڈز"],
      contacted: ["رابطہ شدہ لیڈ", "رابطہ شدہ لیڈز"],
      new: ["نئی لیڈ", "نئی لیڈز"],
      matching: ["میچنگ لیڈ", "میچنگ لیڈز"]
    },
    roman_urdu: {
      hot: ["hot lead", "hot leads"],
      interested: ["interested lead", "interested leads"],
      lost: ["not interested lead", "not interested leads"],
      contacted: ["contacted lead", "contacted leads"],
      new: ["new lead", "new leads"],
      matching: ["matching lead", "matching leads"]
    },
    chinese: {
      hot: ["高意向线索", "高意向线索"],
      interested: ["有意向线索", "有意向线索"],
      lost: ["不感兴趣线索", "不感兴趣线索"],
      contacted: ["已联系线索", "已联系线索"],
      new: ["新线索", "新线索"],
      matching: ["匹配线索", "匹配线索"]
    }
  }[language];

  const result = (key: keyof typeof descriptors) => ({
    singular: descriptors[key][0],
    plural: descriptors[key][1]
  });

  if (statusFilter === "qualified" && urgencyFilter === "high") {
    return result("hot");
  }

  if (statusFilter === "qualified") {
    return result("interested");
  }

  if (statusFilter === "lost") {
    return result("lost");
  }

  if (statusFilter === "contacted") {
    return result("contacted");
  }

  if (statusFilter === "new") {
    return result("new");
  }

  return result("matching");
}

function formatLeadResultCount(count: number, payload: LeadOperationPayload, fallbackQuery = "") {
  const language = detectAgentResponseLanguage(fallbackQuery);
  const descriptor = describeLeadResultSet(payload, fallbackQuery, language);
  if (language === "urdu") {
    return count === 1 ? `آپ کے پاس 1 ${descriptor.singular} ہے۔` : `آپ کے پاس ${count} ${descriptor.plural} ہیں۔`;
  }
  if (language === "roman_urdu") {
    return count === 1 ? `Aap ke paas 1 ${descriptor.singular} hai.` : `Aap ke paas ${count} ${descriptor.plural} hain.`;
  }
  if (language === "chinese") {
    return `你有 ${count} 个${descriptor.plural}。`;
  }
  return count === 1 ? `You have 1 ${descriptor.singular}.` : `You have ${count} ${descriptor.plural}.`;
}

function inferLeadStatusFilterFromQuery(query: string): Pick<LeadOperationPayload, "status_filter" | "urgency"> | null {
  if (/\bhot\b|high intent|ہائی\s*انٹینٹ|ہاٹ|高意向|强意向/i.test(query)) {
    return { status_filter: "qualified", urgency: "high" };
  }

  if (/interested|有兴趣|感兴趣/i.test(query)) {
    return { status_filter: "qualified" };
  }

  if (/not interested|lost|无效|丢失|不感兴趣|没兴趣/i.test(query)) {
    return { status_filter: "lost" };
  }

  if (/contacted|已联系|联系过|跟进过/i.test(query)) {
    return { status_filter: "contacted" };
  }

  if (/\bnew\b|新线索|新客户/i.test(query)) {
    return { status_filter: "new" };
  }

  return null;
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
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error("Copy is not available in this browser.");
    }
  }
}

async function saveChatFollowUpActivity({
  lead,
  summary,
  activityType,
  newStatus,
  urgency,
  nextFollowUpAt,
  note
}: {
  lead: LeadListItem;
  summary: ChatFollowupSummary;
  activityType: "followup_summary_saved" | "status_changed" | "whatsapp_opened" | "message_sent" | "reminder_created";
  newStatus?: LeadRecord["status"];
  urgency?: LeadRecord["urgency"];
  nextFollowUpAt?: string;
  note?: string;
}) {
  const response = await fetch("/api/leads/followup-activities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      lead_id: lead.id,
      activity_type: activityType,
      channel: "whatsapp",
      summary: note?.trim() || summary.chat_summary,
      message_draft: summary.reply_draft.reply_text,
      source_type: summary.source_type,
      original_chat_saved: summary.save_original_chat_text,
      original_chat_text: summary.original_chat_text,
      new_status: newStatus,
      urgency,
      next_follow_up_at: nextFollowUpAt
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Unable to save follow-up.");
  }

  const payload = (await response.json().catch(() => null)) as { lead?: LeadRecord } | null;
  return payload?.lead ?? null;
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

function PromotionPack({ promotion, sourceMessage }: { promotion: ListingPromotion; sourceMessage?: string }) {
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  async function handleCopy(channel: string, text: string) {
    await copyToClipboard(text);
    setCopiedChannel(channel);
  }

  return (
    <AgentOutputCard
      className="chat-promotion-pack"
      icon={<Megaphone size={16} />}
      title={copy.generic.promotionPack}
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
                aria-label={`${copy.buttons.copy} ${card.channel}`}
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
            {copiedChannel === card.channel ? <small className="copied-hint">{copy.generic.copiedToClipboard}</small> : null}
            {card.whatsapp_share_url ? (
              <div className="promotion-actions">
                <a className="promotion-action-button secondary" href={card.whatsapp_share_url} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} />
                  <span>{copy.buttons.shareToWhatsApp}</span>
                </a>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </AgentOutputCard>
  );
}

function AnalyticsChatCard({ summary }: { summary: AnalyticsSummary }) {
  return <AnalyticsSummaryCard compact summary={summary} />;
}

function PromotionConfirmCard({
  initialChannels,
  listing,
  onGenerate,
  sourceMessage
}: {
  initialChannels?: PromotionChannel[];
  listing: RecentListingSummary;
  onGenerate: (channels: PromotionChannel[]) => Promise<boolean> | boolean;
  sourceMessage?: string;
}) {
  const [selectedChannels, setSelectedChannels] = useState<PromotionChannel[]>(
    initialChannels?.length ? initialChannels : ["whatsapp"]
  );
  const [generationState, setGenerationState] = useState<"idle" | "generating" | "generated">("idle");
  const hasGenerated = generationState === "generated";
  const isGenerating = generationState === "generating";
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

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
            const generated = await onGenerate(selectedChannels);
            setGenerationState(generated ? "generated" : "idle");
          }}
        >
          <CheckCircle2 size={15} />{" "}
          {hasGenerated ? copy.buttons.generated : isGenerating ? copy.buttons.generating : copy.buttons.generatePromotionPack}
        </button>
      }
      className="promotion-confirm-card"
      hint={copy.hints.chooseChannels}
      icon={<Megaphone size={16} />}
      summary={copy.hints.chooseChannels}
      title={copy.generic.promotionTarget}
      tone="promotion"
    >
      <div className="promotion-target-card">
        <strong>{listing.title || copy.generic.untitledListing}</strong>
        <span>
          {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || copy.generic.areaNotSet} ·{" "}
          {[listing.location_area, listing.city].filter(Boolean).join(", ") || copy.generic.locationNotSet}
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
  onSelect,
  sourceMessage
}: {
  leads: LeadCardItem[];
  onSelect?: (lead: LeadCardItem) => void;
  sourceMessage?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const language = detectAgentResponseLanguage(sourceMessage ?? "");
  const copy = getLeadCardCopy(language);

  return (
    <AgentOutputCard
      className="lead-chat-card"
      icon={<MessageCircle size={16} />}
      title={copy.title}
      tone="lead"
    >
      {leads.length ? (
        <div className="lead-chat-list">
          {leads.slice(0, 5).map((lead) => {
            const followUpRecommendation = isTodayFollowUpLead(lead) ? lead : null;

            return (
              <div className="lead-chat-row" key={lead.id}>
                <div>
                  <div className="lead-chat-row-title">
                    <strong>{lead.full_name || copy.unnamedBuyer}</strong>
                    <span className={getLeadStatusClassName(lead.status, lead.urgency)}>
                      {formatLeadStatusForLanguage(lead.status, lead.urgency, language)}
                    </span>
                  </div>
                  <div className="lead-chat-detail-list">
                    <p>
                      <span>Time</span>
                      {getLeadContactTimeLabel(lead)}
                    </p>
                    <p>
                      <span>Listing</span>
                      {lead.listing_id ? (
                        <Link
                          className="lead-chat-listing-link"
                          href={`/listings/${lead.listing_id}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {getLeadListingLabel(lead)}
                        </Link>
                      ) : (
                        getLeadListingLabel(lead)
                      )}
                    </p>
                    <p>
                      <span>Channel</span>
                      {getLeadChannelLabel(lead)}
                    </p>
                    <p>
                      <span>Content</span>
                      {getLeadContentSummary(lead)}
                    </p>
                    {followUpRecommendation ? (
                      <p>
                        <span>Suggested reply</span>
                        {followUpRecommendation.recommended_action}
                      </p>
                    ) : null}
                  </div>
                  <small>{lead.phone || copy.noPhone}</small>
                </div>
                <div className="lead-chat-row-action">
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
                      {selectedId === lead.id ? copy.selected : copy.select}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="agent-draft-status">{copy.empty}</p>
      )}
    </AgentOutputCard>
  );
}

function LeadLatestOfferCard({ onConfirm, sourceMessage }: { onConfirm: () => void; sourceMessage?: string }) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

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
          <CheckCircle2 size={15} /> {isConfirmed ? copy.buttons.shown : copy.buttons.showLatestLead}
        </button>
      }
      className="lead-chat-card"
      icon={<MessageCircle size={16} />}
      title={copy.lead.title}
      tone="lead"
    >
      <p className="lead-chat-reply">
        {sourceMessage && getCardLanguage(sourceMessage) === "urdu"
          ? "مجھے حالیہ ان باکس میں وہ exact لیڈ نہیں ملی۔ میں تازہ ترین لیڈ دکھا سکتا ہوں، پہلے آپ کی کنفرمیشن چاہیے۔"
          : "I did not find that exact lead in the recent inbox. I can show the latest lead instead, but I need your confirmation first."}
      </p>
    </AgentOutputCard>
  );
}

function LeadStatusConfirmCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onUpdated,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: LeadStatusUpdatePreview;
  onUpdated: () => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("update_lead");
      return;
    }

    setIsSaving(true);
    setStatus(preview.activityType ? `${copy.generic.followUpRecord}...` : `${copy.buttons.updating}`);
    const response = await fetch(preview.activityType ? "/api/leads/followup-activities" : "/api/leads", {
      method: preview.activityType ? "POST" : "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        preview.activityType
          ? {
              lead_id: preview.lead.id,
              activity_type: preview.activityType,
              channel: "whatsapp",
              summary: preview.summary,
              new_status: preview.status,
              urgency: preview.urgency ?? undefined,
              source_type: "agent_chat"
            }
          : {
              id: preview.lead.id,
              status: preview.status,
              urgency: preview.urgency ?? undefined
            }
      )
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("update_lead");
        setIsSaving(false);
        return;
      }
      setStatus(payload?.error ?? copy.buttons.updating);
      setIsSaving(false);
      return;
    }

    setStatus(copy.buttons.updated);
    setIsSaved(true);
    onUpdated();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? copy.buttons.updated : isSaving ? copy.buttons.updating : copy.buttons.confirmUpdate}
        </button>
      }
      className="lead-chat-card"
      hint={copy.hints.confirmLeadUpdate}
      icon={<CheckCircle2 size={16} />}
      status={status}
      summary={preview.urgency ? `Urgency: ${preview.urgency}` : undefined}
      title={copy.generic.confirmLeadUpdate}
      tone="lead"
    >
      <div className="lead-chat-row standalone">
        <div>
          <strong>{preview.lead.full_name || copy.lead.unnamedBuyer}</strong>
          <p>{getLeadInterestLine(preview.lead, language)}</p>
          <small>
            {formatLeadStatusForLanguage(preview.lead.status, preview.lead.urgency, language)} {preview.status ? `→ ${formatLeadStatusForLanguage(preview.status, preview.urgency, language)}` : ""} ·{" "}
            {preview.lead.phone || copy.lead.noPhone}
          </small>
        </div>
        <span className={getLeadStatusClassName(preview.status ?? preview.lead.status, preview.urgency ?? preview.lead.urgency)}>
          {formatLeadStatusForLanguage(preview.status ?? preview.lead.status, preview.urgency ?? preview.lead.urgency, language)}
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
  isGuest = false,
  onAuthRequired,
  preview,
  onUpdated,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: LeadDetailsUpdatePreview;
  onUpdated: () => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  const entries = Object.entries(preview.changes).filter(([, value]) => value !== undefined) as Array<
    [keyof LeadDetailsUpdateChanges, string | null]
  >;

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("update_lead");
      return;
    }

    setIsSaving(true);
    setStatus(copy.buttons.updating);
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
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("update_lead");
        setIsSaving(false);
        return;
      }
      setStatus(payload?.error ?? copy.buttons.updating);
      setIsSaving(false);
      return;
    }

    setStatus(copy.buttons.updated);
    setIsSaved(true);
    onUpdated();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? copy.buttons.updated : isSaving ? copy.buttons.updating : copy.buttons.confirmUpdate}
        </button>
      }
      className="lead-chat-card"
      hint={copy.hints.reviewLeadFields}
      icon={<Pencil size={16} />}
      status={status}
      title={copy.generic.confirmLeadDetails}
      tone="lead"
    >
      <div className="lead-chat-row standalone">
        <div>
          <strong>{preview.lead.full_name || copy.lead.unnamedBuyer}</strong>
          <p>{getLeadInterestLine(preview.lead, language)}</p>
          <small>{preview.lead.phone || copy.lead.noPhone}</small>
        </div>
        <span className={getLeadStatusClassName(preview.lead.status, preview.lead.urgency)}>{formatLeadStatusForLanguage(preview.lead.status, preview.lead.urgency, language)}</span>
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
  isGuest = false,
  onAuthRequired,
  preview,
  onSaved,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: LeadCreatePreview;
  onSaved: (lead: LeadRecord | null, savedFollowUp: boolean) => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("save_lead");
      return;
    }

    setIsSaving(true);
    setStatus(copy.buttons.saving);
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preview.payload)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("save_lead");
        setIsSaving(false);
        return;
      }
      setStatus(payload?.error ?? copy.buttons.saving);
      setIsSaving(false);
      return;
    }

    const createPayload = (await response.json().catch(() => null)) as { lead?: LeadRecord } | null;
    const savedLead = createPayload?.lead ?? null;
    let savedFollowUp = false;

    if (preview.followUp && savedLead?.id) {
      const followUpResponse = await fetch("/api/leads/followup-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lead_id: savedLead.id,
          activity_type: "followup_summary_saved",
          channel: "whatsapp",
          summary: preview.followUp.summary,
          message_draft: preview.followUp.messageDraft,
          source_type: preview.followUp.sourceType,
          original_chat_saved: false
        })
      });

      if (!followUpResponse.ok) {
        const payload = (await followUpResponse.json().catch(() => null)) as { error?: string } | null;
        if (isUnauthorizedResponse(followUpResponse)) {
          setStatus(AUTH_REQUIRED_STATUS);
          onAuthRequired?.("save_followup");
          setIsSaving(false);
          return;
        }
        setStatus(payload?.error ?? copy.buttons.saved);
        onSaved(savedLead, false);
        router.refresh();
        setIsSaving(false);
        return;
      }

      savedFollowUp = true;
    }

    setStatus(copy.buttons.saved);
    setIsSaved(true);
    onSaved(savedLead, savedFollowUp);
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? copy.buttons.saved : isSaving ? copy.buttons.saving : copy.buttons.confirmSave}
        </button>
      }
      className="lead-chat-card"
      hint={copy.hints.confirmNewLead}
      icon={<UserPlus size={16} />}
      status={status}
      title={copy.generic.confirmNewLead}
      tone="lead"
    >
      <div className="listing-update-list">
        {[
          [copy.generic.fieldName, preview.payload.full_name],
          [copy.generic.fieldPhone, preview.payload.phone],
          [copy.generic.fieldEmail, preview.payload.email],
          [copy.generic.fieldStatus, formatLeadStatusForLanguage(preview.payload.status ?? "new", preview.payload.urgency ?? "normal", language)],
          [copy.generic.fieldMessage, preview.payload.message]
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
      {preview.followUp ? (
        <div className="listing-update-list compact">
          <div className="listing-update-row">
            <span>{copy.generic.followUpRecord}</span>
            <div>
              <strong>{preview.followUp.summary}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </AgentOutputCard>
  );
}

function LeadBatchStatusConfirmCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onUpdated,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: LeadBatchStatusUpdatePreview;
  onUpdated: () => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);

  async function handleConfirm() {
    if (isSaving || isSaved || !preview.status) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("update_lead");
      return;
    }

    setIsSaving(true);
    setStatus(copy.buttons.updating);
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
      if (results.some(isUnauthorizedResponse)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("update_lead");
        setIsSaving(false);
        return;
      }
      setStatus(`${failed} ${copy.lead.title}`);
      setIsSaving(false);
      return;
    }

    setStatus(copy.buttons.updated);
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
          <CheckCircle2 size={15} /> {isSaved ? copy.buttons.updated : isSaving ? copy.buttons.updating : copy.buttons.confirmBatchUpdate}
        </button>
      }
      className="lead-chat-card"
      hint={copy.hints.confirmLeadUpdate}
      icon={<CheckCircle2 size={16} />}
      status={status}
      summary={
        <>
          {preview.leads.length} {copy.lead.title} →{" "}
          {preview.status ? formatLeadStatusForLanguage(preview.status, preview.urgency, language) : copy.generic.fieldStatus}
        </>
      }
      title={copy.generic.confirmBatchUpdate}
      tone="lead"
    >
      <div className="lead-chat-list">
        {preview.leads.slice(0, 6).map((lead) => (
          <div className="lead-chat-row" key={lead.id}>
            <div>
              <strong>{lead.full_name || lead.phone || copy.lead.unnamedBuyer}</strong>
              <small>
                {formatLeadStatusForLanguage(lead.status, lead.urgency, language)} {preview.status ? `→ ${formatLeadStatusForLanguage(preview.status, preview.urgency, language)}` : ""} · {lead.phone || copy.lead.noPhone}
              </small>
            </div>
            <span className={getLeadStatusClassName(preview.status ?? lead.status, preview.urgency ?? lead.urgency)}>
              {formatLeadStatusForLanguage(preview.status ?? lead.status, preview.urgency ?? lead.urgency, language)}
            </span>
          </div>
        ))}
      </div>
    </AgentOutputCard>
  );
}

function LeadListingConfirmCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onUpdated,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: LeadListingUpdatePreview;
  onUpdated: () => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  const currentListingLabel =
    [preview.lead.listing_title, preview.lead.listing_area, preview.lead.listing_city]
      .filter(Boolean)
      .join(", ") || copy.generic.noPrimaryListing;
  const nextListingLabel =
    preview.listing.title ||
    [preview.listing.area_value, preview.listing.area_unit, preview.listing.property_type]
      .filter(Boolean)
      .join(" ") ||
    copy.generic.untitledListing;

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("update_lead");
      return;
    }

    setIsSaving(true);
    setStatus(copy.buttons.updating);
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
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("update_lead");
        setIsSaving(false);
        return;
      }
      setStatus(payload?.error ?? copy.buttons.updating);
      setIsSaving(false);
      return;
    }

    setStatus(copy.buttons.updated);
    setIsSaved(true);
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? copy.buttons.updated : isSaving ? copy.buttons.updating : copy.buttons.confirmListing}
        </button>
      }
      className="lead-chat-card"
      hint={copy.hints.confirmLeadListing}
      icon={<House size={16} />}
      status={status}
      title={copy.generic.confirmLeadListing}
      tone="lead"
    >
      <div className="lead-chat-row standalone">
        <div>
          <strong>{preview.lead.full_name || preview.lead.phone || copy.lead.unnamedBuyer}</strong>
          <p>{getLeadInterestLine(preview.lead, language)}</p>
          <small>{preview.lead.phone || copy.lead.noPhone}</small>
        </div>
        <span className={getLeadStatusClassName(preview.lead.status, preview.lead.urgency)}>{formatLeadStatusForLanguage(preview.lead.status, preview.lead.urgency, language)}</span>
      </div>
      <div className="listing-update-list">
        <div className="listing-update-row">
          <span>{copy.generic.primaryListing}</span>
          <div>
            <small>{currentListingLabel}</small>
            <strong>
              {nextListingLabel} ·{" "}
              {[preview.listing.location_area, preview.listing.city].filter(Boolean).join(", ") ||
                copy.generic.locationNotSet}
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
  isGuest = false,
  onAuthRequired,
  preview,
  onUpdated,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: ListingUpdatePreview;
  onUpdated: () => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));
  const entries = Object.entries(preview.changes).filter(([, value]) => value !== undefined);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("save_listing");
      return;
    }

    setIsSaving(true);
    setStatus(copy.buttons.updating);
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
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("save_listing");
        setIsSaving(false);
        return;
      }
      setStatus(payload?.error ?? copy.buttons.updating);
      setIsSaving(false);
      return;
    }

    setStatus(copy.buttons.updated);
    setIsSaved(true);
    onUpdated();
    router.refresh();
    setIsSaving(false);
  }

  return (
    <AgentOutputCard
      actions={
        <button className="primary-button small" type="button" disabled={isSaving || isSaved} onClick={handleConfirm}>
          <CheckCircle2 size={15} /> {isSaved ? copy.buttons.updated : isSaving ? copy.buttons.updating : copy.buttons.confirmUpdate}
        </button>
      }
      className="listing-update-card"
      hint={copy.hints.listingUpdate}
      icon={<Pencil size={16} />}
      status={status}
      title={copy.generic.confirmListingUpdate}
      tone="listing"
    >
      <div className="promotion-target-card">
        <strong>{preview.listing.title || copy.generic.untitledListing}</strong>
        <span>
          {[preview.listing.area_value, preview.listing.area_unit].filter(Boolean).join(" ") || copy.generic.areaNotSet} ·{" "}
          {[preview.listing.location_area, preview.listing.city].filter(Boolean).join(", ") || copy.generic.locationNotSet}
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
  onSelect,
  sourceMessage
}: {
  preview: ListingUpdateChoicePreview;
  onSelect: (listing: RecentListingSummary) => void;
  sourceMessage?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  return (
    <AgentOutputCard
      className="listing-update-card"
      hint={copy.hints.selectListing}
      icon={<House size={16} />}
      summary={copy.hints.selectListing}
      title={copy.generic.chooseListingToUpdate}
      tone="listing"
    >
      <div className="listing-choice-grid">
        {preview.candidates.map((listing) => (
          <article className="listing-choice-card" key={listing.id}>
            <div>
              <strong>{listing.title || copy.generic.untitledListing}</strong>
              <p>
                {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || copy.generic.areaNotSet} ·{" "}
                {[listing.location_area, listing.city].filter(Boolean).join(", ") || copy.generic.locationNotSet}
              </p>
              <small>
                {formatListingCurrency(listing.price_amount, listing.price_currency ?? "PKR")} ·{" "}
                {listing.bedrooms ?? "-"} {copy.generic.beds} / {listing.bathrooms ?? "-"} {copy.generic.baths}
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
              <CheckCircle2 size={15} /> {selectedId === listing.id ? copy.buttons.selected : copy.buttons.select}
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
  onSkip,
  sourceMessage
}: {
  preview: EntitySelectionPreview;
  onSelect: (candidate: AgentResolutionCandidate) => void;
  onSkip?: () => void;
  sourceMessage?: string;
}) {
  const isListingTarget = preview.targetType === "listing";
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  const title = isListingTarget ? copy.generic.chooseListing : copy.generic.chooseLead;
  const helper = copy.hints.selectRecord;
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
            {skipped ? copy.buttons.continued : copy.buttons.continueWithoutBinding}
          </button>
        ) : null
      }
      className={isListingTarget ? "listing-update-card" : "lead-chat-card"}
      hint={copy.hints.selectRecord}
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
                <strong>{listing.title || copy.generic.untitledListing}</strong>
                <p>
                  {[listing.area_value, listing.area_unit].filter(Boolean).join(" ") || copy.generic.areaNotSet} ·{" "}
                  {[listing.location_area, listing.city].filter(Boolean).join(", ") || copy.generic.locationNotSet}
                </p>
                <small>
                  {formatListingCurrency(listing.price_amount, listing.price_currency ?? "PKR")} ·{" "}
                  {listing.bedrooms ?? "-"} {copy.generic.beds} / {listing.bathrooms ?? "-"} {copy.generic.baths}
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
                <CheckCircle2 size={15} /> {selectedId === candidate.id ? copy.buttons.selected : copy.buttons.select}
              </button>
            </article>
          ) : lead ? (
            <div className="lead-chat-row" key={candidate.id}>
              <div>
                <strong>{lead.full_name || lead.phone || copy.lead.unnamedBuyer}</strong>
                <p>{getLeadInterestLine(lead, language)}</p>
                <small>
                  {formatLeadStatusForLanguage(lead.status, lead.urgency, language)} · {lead.phone || copy.lead.noPhone}
                  {lead.email ? ` · ${lead.email}` : ""}
                </small>
              </div>
              <div className="lead-chat-row-action">
                <span className={getLeadStatusClassName(lead.status, lead.urgency)}>{formatLeadStatusForLanguage(lead.status, lead.urgency, language)}</span>
                <button
                  className="primary-button small"
                  type="button"
                  disabled={isDone}
                  onClick={() => {
                    setSelectedId(candidate.id);
                    onSelect(candidate);
                  }}
                >
                  <CheckCircle2 size={15} /> {selectedId === candidate.id ? copy.buttons.selected : copy.buttons.select}
                </button>
              </div>
            </div>
          ) : null;
        })}
      </div>
    </AgentOutputCard>
  );
}

function LeadReplyCard({
  draft,
  isGuest = false,
  onAuthRequired,
  sourceMessage
}: {
  draft: LeadReplyDraftWithLink;
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  sourceMessage?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  async function handleCopy() {
    await copyToClipboard(draft.reply_text);
    setCopied(true);
  }

  async function handleOpenWhatsApp() {
    if (draft.lead_id) {
      if (isGuest) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("save_followup");
        return;
      }
      const response = await fetch("/api/leads/followup-activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lead_id: draft.lead_id,
          activity_type: "whatsapp_opened",
          channel: "whatsapp",
          message_draft: draft.reply_text,
          summary: "Opened WhatsApp with drafted reply.",
          source_type: "agent_chat"
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (isUnauthorizedResponse(response)) {
          setStatus(AUTH_REQUIRED_STATUS);
          onAuthRequired?.("save_followup");
          return;
        }
        setStatus(payload?.error ?? copy.buttons.openWhatsApp);
        return;
      }
    }

    window.open(draft.whatsapp_url, "_blank", "noopener,noreferrer");
    setStatus(copy.buttons.openWhatsApp);
  }

  return (
    <AgentOutputCard
      actions={
        <>
          <button className="outline-button small" type="button" onClick={() => void handleCopy()}>
            <Copy size={14} /> {copied ? copy.buttons.copied : copy.buttons.copy}
          </button>
          <button className="primary-button small" type="button" onClick={() => void handleOpenWhatsApp()}>
            <Phone size={14} /> {copy.buttons.openWhatsApp}
          </button>
        </>
      }
      className="lead-chat-card"
      icon={<MessageCircle size={16} />}
      summary={draft.next_step}
      status={status}
      title={copy.generic.whatsappReplyDraft}
      tone="lead"
    >
      <p className="lead-chat-reply">{draft.reply_text}</p>
    </AgentOutputCard>
  );
}

function ChatFollowupSummaryCard({
  preview,
  contextLeads,
  onCreateLead,
  recentLeads,
  onNeedsSummary,
  onDraftReply,
  onManageFollowup,
  sourceMessage
}: {
  preview: ChatImportPreview;
  contextLeads: LeadListItem[];
  onCreateLead: (payload: LeadCreatePayload, followUp?: LeadCreateFollowUpPreview) => void;
  recentLeads: LeadListItem[];
  onNeedsSummary: (summary: ChatFollowupSummary) => void;
  onDraftReply: (summary: ChatFollowupSummary, lead: LeadListItem) => void;
  onManageFollowup: (summary: ChatFollowupSummary, lead: LeadListItem) => void;
  sourceMessage?: string;
}) {
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    preview.selectedLeadId ?? preview.summary?.matched_lead?.id ?? preview.selectedLead?.id ?? contextLeads[0]?.id ?? null
  );
  const [selectedZipTextName, setSelectedZipTextName] = useState("");
  const [summary, setSummary] = useState<ChatFollowupSummary | undefined>(preview.summary);
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [activeAction, setActiveAction] = useState<ChatImportAction | null>(null);
  const targetLead =
    recentLeads.find((lead) => lead.id === selectedLeadId) ??
    contextLeads.find((lead) => lead.id === selectedLeadId) ??
    (preview.selectedLead?.id === selectedLeadId ? preview.selectedLead : null) ??
    summary?.candidate_leads.find((lead) => lead.id === selectedLeadId) ??
    summary?.matched_lead ??
    null;
  const matchedLeadLabel = targetLead?.full_name || targetLead?.phone || targetLead?.email || copy.lead.unnamedBuyer;
  const sourceLabel =
    summary?.source_type === "whatsapp_zip_upload"
      ? "WhatsApp zip"
      : summary?.source_type === "whatsapp_txt_upload"
        ? "WhatsApp txt"
        : "Pasted WhatsApp text";

  async function summarizeSelectedZipText() {
    if (!preview.pendingZipFile || !selectedZipTextName) {
      setStatus(copy.buttons.select);
      return;
    }

    setIsWorking(true);
    setStatus(copy.buttons.generating);
    const formData = new FormData();
    formData.append("source_type", "whatsapp_zip_upload");
    formData.append("selected_txt_name", selectedZipTextName);
    formData.append("save_original_chat_text", "false");
    formData.append("broker_display_language", language);
    if (selectedLeadId) {
      formData.append("lead_id", selectedLeadId);
    }
    formData.append("file", preview.pendingZipFile);

    const response = await fetch("/api/leads/import-whatsapp-chat", {
      method: "POST",
      body: formData
    });

    setIsWorking(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? copy.buttons.generating);
      return;
    }

    const payload = (await response.json()) as ChatFollowupSummary;
    setSummary(payload);
    setSelectedLeadId(payload.matched_lead?.id ?? selectedLeadId);
    setStatus(copy.buttons.generated);
    onNeedsSummary(payload);
  }

  return (
    <div className="chat-import-card">
      <div className="card-title">
        <FileText size={16} /> WhatsApp chat follow-up
      </div>

      {preview.zipCandidates?.length && !summary ? (
        <div className="zip-candidate-list" role="group" aria-label={copy.buttons.select}>
          <span>{copy.buttons.select}</span>
          {preview.zipCandidates.map((candidate) => (
            <button
              className={selectedZipTextName === candidate.name ? "primary-button small" : "outline-button small"}
              key={candidate.name}
              type="button"
              onClick={() => setSelectedZipTextName(candidate.name)}
            >
              <FileText size={14} /> {candidate.name}
            </button>
          ))}
          <button className="primary-button small" type="button" disabled={isWorking} onClick={() => void summarizeSelectedZipText()}>
            <Sparkles size={14} /> {copy.buttons.generatePromotionPack}
          </button>
        </div>
      ) : null}

      {summary ? (
        <>
          {activeAction === "choose_lead" && getVerifiedChatLeadCandidates(summary).length ? (
            <div className="lead-candidate-list" role="group" aria-label={copy.generic.chooseLead}>
              <span>{copy.generic.chooseLead}</span>
              {getVerifiedChatLeadCandidates(summary).map((candidate) => (
                <button
                  className={selectedLeadId === candidate.id ? "primary-button small" : "outline-button small"}
                  key={candidate.id}
                  type="button"
                  onClick={() => {
                    setSelectedLeadId(candidate.id);
                    setActiveAction("manage_followup");
                  }}
                >
                  <UserPlus size={14} /> {candidate.full_name || candidate.phone || copy.lead.unnamedBuyer}
                </button>
              ))}
            </div>
          ) : null}
          <div className="chat-import-fields">
            <div>
              <span>{copy.generic.chooseLead}</span>
              <strong>{targetLead ? matchedLeadLabel : copy.generic.notMatched}</strong>
            </div>
            <div>
              <span>{copy.generic.fieldPhone}</span>
              <strong>{targetLead?.phone || summary.detected_phone || copy.generic.notDetected}</strong>
            </div>
            <div>
              <span>{copy.generic.fieldStatus}</span>
              <strong>{targetLead ? formatLeadStatusForLanguage(targetLead.status, targetLead.urgency, language) : copy.lead.empty}</strong>
            </div>
            <div>
              <span>{copy.generic.fieldName}</span>
              <strong>{summary.detected_customer_name || targetLead?.full_name || copy.generic.notDetected}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{sourceLabel}</strong>
            </div>
          </div>

          <div className="chat-next-actions" aria-label={copy.buttons.select}>
            <span>{copy.buttons.select}</span>
            <div className="card-actions">
              <button
                className={activeAction === "reply" ? "primary-button small" : "outline-button small"}
                type="button"
                disabled={Boolean(activeAction) || !targetLead}
                title={!targetLead ? copy.hints.selectRecord : undefined}
                onClick={() => {
                  if (!targetLead) {
                    setStatus(copy.hints.selectRecord);
                    return;
                  }
                  setActiveAction("reply");
                  onDraftReply(summary, targetLead);
                }}
              >
                <MessageCircle size={14} /> {copy.generic.draftReply}
              </button>
              {targetLead ? (
                <button
                  className={activeAction === "manage_followup" ? "primary-button small" : "outline-button small"}
                  type="button"
                  disabled={Boolean(activeAction)}
                  onClick={() => {
                    setActiveAction("manage_followup");
                    onManageFollowup(summary, targetLead);
                  }}
                >
                  <FileText size={14} /> {copy.generic.manageFollowUp}
                </button>
              ) : (
                <>
                  <button className={activeAction === "choose_lead" ? "primary-button small" : "outline-button small"} type="button" onClick={() => setActiveAction("choose_lead")}>
                    <UserPlus size={14} /> {copy.generic.chooseLead}
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    onClick={() =>
                      onCreateLead({
                        full_name: summary.detected_customer_name ?? undefined,
                        phone: summary.detected_phone ?? undefined,
                        message: summary.chat_summary,
                        source_channel: "whatsapp",
                        status: "new",
                        urgency: summary.urgency_suggestion ?? "normal"
                      }, buildLeadCreateFollowUpFromChat(summary))
                    }
                  >
                    <UserPlus size={14} /> {copy.generic.confirmNewLead}
                  </button>
                </>
              )}
            </div>
          </div>
          {activeAction ? <p className="agent-draft-status">{copy.buttons.selected}</p> : null}
        </>
      ) : null}
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function LeadMiniCard({ lead, sourceMessage }: { lead: LeadListItem; sourceMessage?: string }) {
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  return (
    <div className="chat-lead-mini-card">
      <div>
        <span>{copy.generic.chooseLead}</span>
        <strong>{lead.full_name || lead.phone || copy.lead.unnamedBuyer}</strong>
      </div>
      <div>
        <span>{copy.generic.fieldStatus}</span>
        <strong>{formatLeadStatusForLanguage(lead.status, lead.urgency, language)}</strong>
      </div>
      {lead.phone ? (
        <div>
          <span>{copy.generic.fieldPhone}</span>
          <strong>{lead.phone}</strong>
        </div>
      ) : null}
      {lead.listing_title ? (
        <div>
          <span>{copy.generic.primaryListing}</span>
          <strong>{lead.listing_title}</strong>
        </div>
      ) : null}
    </div>
  );
}

function ChatReplyActionCard({ preview, sourceMessage }: { preview: ChatReplyActionPreview; sourceMessage?: string }) {
  const { summary, lead } = preview;
  const [status, setStatus] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  async function copyReply() {
    try {
      await copyToClipboard(summary.reply_draft.reply_text);
      setIsCopied(true);
      setStatus(copy.buttons.copied);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.buttons.copy);
    }
  }

  return (
    <div className="chat-reply-card" aria-label={copy.generic.whatsappReplyDraft}>
      <button className="icon-button subtle" type="button" aria-label={copy.buttons.copy} title={copy.buttons.copy} onClick={() => void copyReply()}>
        {isCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
      </button>
      <div className="chat-reply-text">
        {summary.reply_draft.reply_text}
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function ChatFollowupManageCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onSaved,
  onNeedsReminder,
  onDeclined,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: ChatFollowupManagePreview;
  onSaved: (message: string, updatedLead?: LeadRecord | null) => void;
  onNeedsReminder: (preview: ChatFollowupManagePreview) => void;
  onDeclined: () => void;
  sourceMessage?: string;
}) {
  const [decision, setDecision] = useState<"yes" | "no" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [followUpTime] = useState(() => new Date());
  const action = preview.suggestedAction ?? recommendChatFollowupAction(preview.summary, preview.lead);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  const suggestedStatus = getSuggestedLeadStatus(preview.summary);
  const title =
    action === "status"
      ? copy.generic.confirmLeadUpdate
      : action === "reminder"
        ? copy.generic.schedulePreview
        : copy.generic.followUpRecord;
  const followUpTimeLabel = followUpTime.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  async function acceptSuggestion() {
    if (!action || decision || isWorking) {
      return;
    }

    if (action === "reminder") {
      if (isGuest) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("save_followup");
        return;
      }
      setDecision("yes");
      onNeedsReminder(preview);
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.(action === "status" ? "update_lead" : "save_followup");
      return;
    }

    setIsWorking(true);
    setStatus(copy.buttons.saving);
    try {
      if (action === "status") {
        const updatedLead = await saveChatFollowUpActivity({
          lead: preview.lead,
          summary: preview.summary,
          activityType: "status_changed",
          newStatus: suggestedStatus.status,
          urgency: suggestedStatus.urgency
        });
        setStatus(copy.buttons.saved);
        onSaved(`Done. I saved the follow-up summary and updated ${preview.lead.full_name || "this lead"} to ${formatLeadStatusLabel(suggestedStatus.status, suggestedStatus.urgency)}.`, updatedLead);
      } else {
        const updatedLead = await saveChatFollowUpActivity({
          lead: preview.lead,
          summary: preview.summary,
          activityType: "followup_summary_saved"
        });
        setStatus(copy.buttons.saved);
        onSaved("Done. I saved this chat summary to the lead follow-up record.", updatedLead);
      }
      setDecision("yes");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.buttons.saving);
    } finally {
      setIsWorking(false);
    }
  }

  function declineSuggestion() {
    if (decision || isWorking) {
      return;
    }

    setDecision("no");
    setStatus("No changes made.");
    onDeclined();
  }

  if (!action) {
    return null;
  }

  return (
    <div className="chat-import-card">
      <div className="card-title">
        <FileText size={16} /> {title}
      </div>
      {action === "status" ? (
        <div className="chat-status-change" aria-label="Suggested status change">
          <span>{preview.lead.full_name || preview.lead.phone || copy.lead.unnamedBuyer}</span>
          <div className="chat-status-change-row">
            <strong className={getLeadStatusClassName(preview.lead.status, preview.lead.urgency)}>{formatLeadStatusForLanguage(preview.lead.status, preview.lead.urgency, language)}</strong>
            <span className="chat-status-arrow">→</span>
            <strong className={getLeadStatusClassName(suggestedStatus.status, suggestedStatus.urgency, "target")}>
              {formatLeadStatusForLanguage(suggestedStatus.status, suggestedStatus.urgency, language)}
            </strong>
          </div>
        </div>
      ) : (
        <div className="chat-compact-lead-line">
          <span>{preview.lead.full_name || preview.lead.phone || copy.lead.unnamedBuyer}</span>
        </div>
      )}
      <div className="chat-followup-record">
        <div className="chat-followup-record-header">
          <span>{copy.generic.followUpRecord}</span>
          <small>{followUpTimeLabel}</small>
        </div>
        <p>{preview.summary.chat_summary}</p>
      </div>
      {action === "reminder" ? (
        <div className="chat-import-fields single">
          <div>
            <span>{copy.generic.fieldMessage}</span>
            <strong>{preview.summary.next_action_suggestion || "Follow up on this WhatsApp chat."}</strong>
          </div>
        </div>
      ) : null}
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={Boolean(decision) || isWorking} onClick={() => void acceptSuggestion()}>
          <CheckCircle2 size={15} /> Yes
        </button>
        <button className="outline-button small" type="button" disabled={Boolean(decision) || isWorking} onClick={declineSuggestion}>
          <X size={15} /> No
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function ChatLeadChoiceCard({
  preview,
  onChooseLead,
  onCreateLead,
  sourceMessage
}: {
  preview: ChatLeadChoicePreview;
  onChooseLead: (lead: LeadListItem) => void;
  onCreateLead: (payload: LeadCreatePayload, followUp?: LeadCreateFollowUpPreview) => void;
  sourceMessage?: string;
}) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const candidates = getVerifiedChatLeadCandidates(preview.summary);
  const hasDetectedIdentity = Boolean(preview.summary.detected_customer_name || preview.summary.detected_phone);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  function createLead() {
    if (created || selectedLeadId) {
      return;
    }

    setCreated(true);
    onCreateLead({
      full_name: preview.summary.detected_customer_name ?? undefined,
      phone: preview.summary.detected_phone ?? undefined,
      message: preview.summary.chat_summary,
      source_channel: "whatsapp",
      status: "new",
      urgency: preview.summary.urgency_suggestion ?? "normal"
    }, buildLeadCreateFollowUpFromChat(preview.summary));
  }

  return (
    <div className="chat-import-card">
      <div className="card-title">
        <UserPlus size={16} /> {copy.generic.chooseLead}
      </div>
      <div className="chat-import-fields">
        <div>
          <span>{copy.generic.fieldName}</span>
          <strong>{preview.summary.detected_customer_name || copy.generic.notDetected}</strong>
        </div>
        <div>
          <span>{copy.generic.fieldPhone}</span>
          <strong>{preview.summary.detected_phone || copy.generic.notDetected}</strong>
        </div>
      </div>
      {candidates.length ? (
        <div className="lead-candidate-list" role="group" aria-label={copy.generic.chooseLead}>
          <span>{copy.generic.chooseLead}</span>
          {candidates.map((candidate) => (
            <button
              className={selectedLeadId === candidate.id ? "primary-button small" : "outline-button small"}
              key={candidate.id}
              type="button"
              disabled={Boolean(selectedLeadId) || created}
              onClick={() => {
                setSelectedLeadId(candidate.id);
                onChooseLead(candidate);
              }}
            >
              <UserPlus size={14} /> {candidate.full_name || candidate.phone || copy.lead.unnamedBuyer}
            </button>
          ))}
        </div>
      ) : (
        <p className="agent-draft-status">{copy.lead.empty}</p>
      )}
      {hasDetectedIdentity ? (
        <div className="card-actions">
          <button className="outline-button small" type="button" disabled={Boolean(selectedLeadId) || created} onClick={createLead}>
            <UserPlus size={14} /> {copy.generic.confirmNewLead}
          </button>
        </div>
      ) : null}
      {selectedLeadId ? <p className="agent-draft-status">{copy.buttons.selected}</p> : null}
      {created ? <p className="agent-draft-status">{copy.generic.confirmNewLead}</p> : null}
    </div>
  );
}

function ChatFollowupNoteCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onSaved,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: ChatFollowupManagePreview;
  onSaved: (message: string) => void;
  sourceMessage?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  async function saveNote() {
    if (isSaved || isWorking) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("save_followup");
      return;
    }

    setIsWorking(true);
    setStatus(copy.buttons.saving);
    try {
      await saveChatFollowUpActivity({ lead: preview.lead, summary: preview.summary, activityType: "followup_summary_saved" });
      setIsSaved(true);
      setStatus(copy.buttons.saved);
      onSaved("Done. I saved the chat summary as a follow-up note. The original chat text was not saved by default.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.buttons.saving);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="chat-import-card">
      <div className="card-title">
        <FileText size={16} /> {copy.generic.followUpRecord}
      </div>
      <LeadMiniCard lead={preview.lead} sourceMessage={sourceMessage} />
      <div className="chat-import-fields single">
        <div>
          <span>{copy.generic.fieldMessage}</span>
          <strong>{preview.summary.chat_summary}</strong>
        </div>
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaved || isWorking} onClick={() => void saveNote()}>
          <CheckCircle2 size={15} /> {copy.buttons.confirmSave}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function ChatReminderCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onSaved,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: ChatFollowupManagePreview;
  onSaved: (message: string) => void;
  sourceMessage?: string;
}) {
  const [reminderAt, setReminderAt] = useState(getDefaultFollowUpReminderLocalValue);
  const [note, setNote] = useState(preview.summary.next_action_suggestion || "Follow up on WhatsApp chat.");
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  async function saveReminder() {
    if (isSaved || isWorking) {
      return;
    }

    if (!reminderAt) {
      setStatus(copy.hints.editSchedule);
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("save_followup");
      return;
    }

    setIsWorking(true);
    setStatus(copy.buttons.saving);
    try {
      await saveChatFollowUpActivity({
        lead: preview.lead,
        summary: preview.summary,
        activityType: "reminder_created",
        nextFollowUpAt: new Date(reminderAt).toISOString(),
        note
      });
      setIsSaved(true);
      setStatus(copy.buttons.saved);
      onSaved("Done. I set the next follow-up reminder on the lead.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.buttons.saving);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="chat-import-card">
      <div className="card-title">
        <CalendarClock size={16} /> {copy.generic.schedulePreview}
      </div>
      <LeadMiniCard lead={preview.lead} sourceMessage={sourceMessage} />
      <div className="chat-action-nested">
        <label>
          <span>{copy.generic.schedulePreview}</span>
          <input type="datetime-local" value={reminderAt} disabled={isSaved} onChange={(event) => setReminderAt(event.target.value)} />
        </label>
        <label>
          <span>{copy.generic.fieldMessage}</span>
          <input value={note} disabled={isSaved} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={isSaved || isWorking} onClick={() => void saveReminder()}>
          <CalendarClock size={15} /> {copy.buttons.confirmSchedule}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function ChatStatusCard({
  isGuest = false,
  onAuthRequired,
  preview,
  onSaved,
  sourceMessage
}: {
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  preview: ChatFollowupManagePreview;
  onSaved: (message: string) => void;
  sourceMessage?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [selected, setSelected] = useState<LeadRecord["status"] | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);

  async function updateStatus(nextStatus: LeadRecord["status"], urgency?: LeadRecord["urgency"]) {
    if (selected || isWorking) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("update_lead");
      return;
    }

    setIsWorking(true);
    setStatus(copy.buttons.updating);
    try {
      await saveChatFollowUpActivity({
        lead: preview.lead,
        summary: preview.summary,
        activityType: "status_changed",
        newStatus: nextStatus,
        urgency
      });
      setSelected(nextStatus);
      setStatus(`${copy.buttons.updated}: ${formatLeadStatusForLanguage(nextStatus, urgency, language)}.`);
      onSaved(`Done. I updated ${preview.lead.full_name || "this lead"} to ${formatLeadStatusLabel(nextStatus, urgency)}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.buttons.updating);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="chat-import-card">
      <div className="card-title">
        <CheckCircle2 size={16} /> {copy.generic.confirmLeadUpdate}
      </div>
      <LeadMiniCard lead={preview.lead} sourceMessage={sourceMessage} />
      <div className="chat-import-fields single">
        <div>
          <span>{copy.generic.fieldStatus}</span>
          <strong>{formatLeadStatusForLanguage(preview.summary.status_suggestion, preview.summary.urgency_suggestion, language)}</strong>
        </div>
      </div>
      <div className="card-actions">
        <button className="primary-button small" type="button" disabled={Boolean(selected) || isWorking} onClick={() => void updateStatus("qualified", "high")}>
          <CheckCircle2 size={15} /> {formatLeadStatusForLanguage("qualified", "high", language)}
        </button>
        <button className="outline-button small" type="button" disabled={Boolean(selected) || isWorking} onClick={() => void updateStatus("contacted")}>
          <CheckCircle2 size={15} /> {formatLeadStatusForLanguage("contacted", undefined, language)}
        </button>
        <button className="outline-button small" type="button" disabled={Boolean(selected) || isWorking} onClick={() => void updateStatus("lost")}>
          <X size={15} /> {formatLeadStatusForLanguage("lost", undefined, language)}
        </button>
      </div>
      {status ? <p className="agent-draft-status">{status}</p> : null}
    </div>
  );
}

function DraftPreviewCard({
  draft,
  isGuest = false,
  onAttachMedia,
  onAuthRequired,
  onRemoveMedia,
  pendingMedia,
  onSaved,
  sourceMessage
}: {
  draft: ListingDraftInput;
  isGuest?: boolean;
  onAttachMedia: () => void;
  onAuthRequired?: AuthRequiredHandler;
  onRemoveMedia: (mediaId: string) => void;
  pendingMedia: PendingMedia[];
  onSaved: (
    uploadedCount: number,
    listingId: string,
    savedDraft: ListingDraftInput,
    mediaPreview: ListingSavedMediaPreview[],
    failedMedia: FailedMediaUpload[]
  ) => void;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => draftToFormState(draft));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [mediaUploadStatus, setMediaUploadStatus] = useState<Record<string, PendingMediaUploadStatus>>({});
  const [status, setStatus] = useState<string | null>(null);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));
  const previewDraft = useMemo(() => formStateToDraft(form), [form]);
  const remoteImages = useMemo(() => getDraftRemoteImages(draft), [draft]);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("save_listing");
      return;
    }

    const draftToSave: ListingDraftInput = {
      ...previewDraft,
      ai_extracted_payload: draft.ai_extracted_payload
        ? {
            ...draft.ai_extracted_payload,
            edited_in_agent_workspace: isEditing
          }
        : previewDraft.ai_extracted_payload,
      ai_confidence: draft.ai_confidence ?? previewDraft.ai_confidence
    };
    const remoteStatusEntries = remoteImages.map((_, index) => [`remote-${index}`, "pending"] as const);

    setIsSaving(true);
    setMediaUploadStatus(Object.fromEntries([...pendingMedia.map((item) => [item.id, "pending"] as const), ...remoteStatusEntries]));
    setStatus(pendingMedia.length || remoteImages.length ? "Adding listing and media..." : "Adding to library...");
    const response = await fetch("/api/listings/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draftToSave)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("save_listing");
        setIsSaving(false);
        return;
      }
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
      const updateMediaStatus = (mediaId: string, nextStatus: PendingMediaUploadStatus) => {
        setMediaUploadStatus((current) => ({
          ...current,
          [mediaId]: nextStatus
        }));
      };
      const localUploadResult = await uploadListingMedia(listingId, pendingMedia, updateMediaStatus);
      const remoteUploadResult = await importRemoteListingImages(listingId, remoteImages, updateMediaStatus);
      const uploadedMedia = [...localUploadResult.uploadedMedia, ...remoteUploadResult.uploadedMedia];
      const failedMedia = [...localUploadResult.failedMedia, ...remoteUploadResult.failedMedia];
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
        draftToSave,
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
            <CheckCircle2 size={15} /> {isSaved ? copy.buttons.saved : isSaving ? copy.buttons.generating : copy.buttons.confirmAdd}
          </button>
          <button
            className="outline-button small"
            type="button"
            disabled={isSaving || isSaved}
            onClick={() => setIsEditing(!isEditing)}
          >
            <Pencil size={14} /> {isEditing ? copy.buttons.preview : copy.buttons.editCard}
          </button>
        </>
      }
      className="agent-draft-card"
      icon={<Sparkles size={16} />}
      status={status}
      summary={isEditing ? copy.hints.reviewListing : copy.hints.reviewListing}
      title={copy.generic.listingPreview}
      tone="listing"
    >

      {isEditing ? (
        <div className="agent-draft-form">
          <label>
            <span>{copy.generic.fieldTitle}</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label>
            <span>{copy.generic.fieldDescription}</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div className="agent-draft-grid">
            <label>
              <span>{copy.generic.fieldCity}</span>
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.generic.fieldArea}</span>
              <input
                value={form.location_area}
                onChange={(event) => setForm({ ...form, location_area: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.generic.fieldPropertyType}</span>
              <input
                value={form.property_type}
                onChange={(event) => setForm({ ...form, property_type: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.generic.fieldIntent}</span>
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
              <span>{copy.generic.fieldPrice} PKR</span>
              <input
                inputMode="numeric"
                value={form.price_amount}
                onChange={(event) => setForm({ ...form, price_amount: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.generic.fieldAreaSize}</span>
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
              <span>{copy.generic.fieldBeds}</span>
              <input
                inputMode="numeric"
                value={form.bedrooms}
                onChange={(event) => setForm({ ...form, bedrooms: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.generic.fieldBaths}</span>
              <input
                inputMode="numeric"
                value={form.bathrooms}
                onChange={(event) => setForm({ ...form, bathrooms: event.target.value })}
              />
            </label>
          </div>
          <label>
            <span>{copy.generic.fieldFeatures}</span>
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
              {[previewDraft.area_value, previewDraft.area_unit].filter(Boolean).join(" ") || copy.generic.areaNotSet}
            </span>
            <span>
              {previewDraft.bedrooms ?? "-"} {copy.generic.beds} / {previewDraft.bathrooms ?? "-"} {copy.generic.baths}
            </span>
          </div>
        </div>
      )}

      <div className="agent-media-panel" aria-label="Listing photos and video">
        {pendingMedia.length || remoteImages.length ? (
          <div className="agent-media-preview">
            {remoteImages.map((item, index) => {
              const uploadStatus = mediaUploadStatus[`remote-${index}`] ?? "pending";
              const isUploading = uploadStatus === "uploading";
              const isUploaded = uploadStatus === "uploaded";
              const isFailed = uploadStatus === "failed";

              return (
                <div className={`agent-media-thumb ${uploadStatus}`} key={item.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getRemoteImagePreviewUrl(item.url)}
                    alt={item.alt || `Imported property image ${index + 1}`}
                    referrerPolicy="no-referrer"
                  />
                  <span className="agent-media-source">Link</span>
                  {uploadStatus !== "pending" ? (
                    <span className="agent-media-upload-state" aria-label={`Imported image ${index + 1} ${uploadStatus}`}>
                      {isUploading ? (
                        <LoaderCircle className="spin-icon" size={16} />
                      ) : isUploaded ? (
                        <CheckCircle2 size={16} />
                      ) : isFailed ? (
                        <X size={15} />
                      ) : null}
                    </span>
                  ) : null}
                </div>
              );
            })}
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
              <Upload size={14} /> {copy.buttons.addMore}
            </button>
          </div>
        ) : (
          <button className="agent-media-add empty" type="button" disabled={isSaving || isSaved} onClick={onAttachMedia}>
            <ImagePlus size={16} /> {copy.buttons.addMedia}
          </button>
        )}
      </div>
    </AgentOutputCard>
  );
}

function ListingSavedCard({
  mediaPreview = [],
  onAskAgent,
  preview,
  sourceMessage
}: {
  mediaPreview?: ListingSavedMediaPreview[];
  onAskAgent?: (preview: ListingSavedPreview, mediaPreview: ListingSavedMediaPreview[]) => void;
  preview: ListingSavedPreview;
  sourceMessage?: string;
}) {
  const visibleMedia = mediaPreview.filter((item) => item.previewUrl).slice(0, 3);
  const copy = getAgentCardCopy(getCardLanguage(sourceMessage));

  return (
    <AgentOutputCard
      actions={
        <>
          <a className="primary-button small" href={preview.libraryHref}>
            <House size={14} /> {copy.buttons.openListing}
          </a>
          <button className="outline-button small" type="button" onClick={() => onAskAgent?.(preview, mediaPreview)}>
            <MessageCircle size={14} /> {copy.buttons.askAgent}
          </button>
        </>
      }
      className="listing-saved-card"
      icon={<CheckCircle2 size={16} />}
      title={copy.generic.listingSaved}
      tone="listing"
    >
      <div className="listing-saved-summary">
        <div>
          <strong>{preview.title || copy.generic.savedListing}</strong>
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
                {preview.uploadedCount} {copy.generic.mediaFiles}
              </span>
            </>
          ) : (
            <span className="listing-saved-badge">
              <ImageIcon size={14} /> {copy.generic.noMediaAdded}
            </span>
          )}
        </div>
      </div>
    </AgentOutputCard>
  );
}

function SchedulePreviewCard({
  event,
  isGuest = false,
  onAuthRequired,
  onSaved,
  timeZone,
  sourceMessage
}: {
  event: BrokerEventDraftInput;
  isGuest?: boolean;
  onAuthRequired?: AuthRequiredHandler;
  onSaved: () => void;
  timeZone?: string | null;
  sourceMessage?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => eventToFormState(event, timeZone));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const language = getCardLanguage(sourceMessage);
  const copy = getAgentCardCopy(language);
  const previewEvent = useMemo(() => formStateToEvent(form, timeZone), [form, timeZone]);
  const hasScheduleTime = Boolean(previewEvent.start_at || previewEvent.reminder_at);

  async function handleConfirm() {
    if (isSaving || isSaved) {
      return;
    }

    if (!hasScheduleTime) {
      setStatus(copy.hints.editSchedule);
      setIsEditing(true);
      return;
    }
    if (isGuest) {
      setStatus(AUTH_REQUIRED_STATUS);
      onAuthRequired?.("save_schedule");
      return;
    }

    setIsSaving(true);
    setStatus(copy.buttons.generating);
    const response = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(previewEvent)
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (isUnauthorizedResponse(response)) {
        setStatus(AUTH_REQUIRED_STATUS);
        onAuthRequired?.("save_schedule");
        setIsSaving(false);
        return;
      }
      setStatus(payload?.error ?? copy.hints.editSchedule);
      setIsSaving(false);
      return;
    }

    setStatus(copy.buttons.saved);
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
            <CheckCircle2 size={15} /> {isSaved ? copy.buttons.saved : isSaving ? copy.buttons.generating : copy.buttons.confirmSchedule}
          </button>
          <button
            className="outline-button small"
            type="button"
            disabled={isSaving || isSaved}
            onClick={() => setIsEditing(!isEditing)}
          >
            <Pencil size={14} /> {isEditing ? copy.buttons.preview : copy.buttons.editCard}
          </button>
        </>
      }
      className="schedule-preview-card"
      hint={isEditing ? copy.hints.editSchedule : copy.hints.reviewSchedule}
      icon={<CalendarClock size={16} />}
      status={status}
      summary={isEditing ? copy.hints.editSchedule : copy.hints.reviewSchedule}
      title={copy.generic.schedulePreview}
      tone="schedule"
    >

      {isEditing ? (
        <div className="agent-draft-form">
          <label>
            <span>{copy.generic.fieldTitle}</span>
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
              <span>{copy.generic.fieldPropertyType}</span>
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
              {form.lead_id ? <small>{copy.lead.title}</small> : null}
              <input
                value={form.lead_name}
                onChange={(event) => setForm({ ...form, lead_name: event.target.value })}
              />
            </label>
            <label>
              <span>Listing</span>
              {form.listing_id ? <small>{copy.generic.primaryListing}</small> : null}
              <input
                value={form.listing_reference}
                onChange={(event) => setForm({ ...form, listing_reference: event.target.value })}
              />
            </label>
          </div>
          <label>
            <span>{copy.generic.fieldDescription}</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="schedule-preview">
          <h3>{previewEvent.title}</h3>
          <p>{previewEvent.description || copy.generic.noNotes}</p>
          <div className="schedule-facts">
            <span>{previewEvent.event_category}</span>
            <span>{formatScheduleEventType(previewEvent.event_type, language)}</span>
            <span>{formatEventTime(previewEvent, timeZone)}</span>
            {previewEvent.lead_name ? <span>{previewEvent.lead_name}</span> : null}
            {previewEvent.listing_reference ? <span>{previewEvent.listing_reference}</span> : null}
          </div>
        </div>
      )}
    </AgentOutputCard>
  );
}

function formatScheduleEventType(eventType: BrokerEventRecord["event_type"], language: AgentResponseLanguage) {
  const copy = getScheduleCardCopy(language);
  return copy.eventTypes[eventType] ?? eventType.replace(/_/g, " ");
}

function ScheduleResultsCard({
  events,
  timeZone,
  sourceMessage
}: {
  events: BrokerEventRecord[];
  timeZone?: string | null;
  sourceMessage?: string;
}) {
  const language = detectAgentResponseLanguage(sourceMessage ?? "");
  const copy = getScheduleCardCopy(language);

  return (
    <AgentOutputCard
      className="chat-card schedule-results-card"
      icon={<CalendarClock size={16} />}
      title={copy.title}
      tone="schedule"
    >
      {events.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <div className="event-mini-list">
          {events.map((event) => (
            <div className="event-mini-row" key={event.id}>
              <time dateTime={getScheduleResultTime(event)}>{formatScheduleResultTime(event, timeZone)}</time>
              <div>
                <strong>{event.title}</strong>
                <small>
                  {[
                    formatScheduleEventType(event.event_type, language),
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
  initialAuthOpen = false,
  initialWhatsAppImportOpen = false,
  initialContextAttachments = [],
  initialMessages,
  isGuest = false,
  recentLeads: initialRecentLeads,
  recentListings
}: AgentWorkspaceProps) {
  const router = useRouter();
  const welcomeMessageContent = `Good morning, ${firstName}. Tell me the property details in English, Urdu, or Roman Urdu. I will draft a listing preview for you to edit and confirm.`;
  const shouldHandleHomeBackNavigation = initialMessages.length === 0;
  const [userTimeZone, setUserTimeZone] = useState(() => getResolvedTimeZone());
  const [input, setInput] = useState("");
  const [composerMedia, setComposerMedia] = useState<PendingMedia[]>([]);
  const [composerFiles, setComposerFiles] = useState<PendingFileAttachment[]>([]);
  const [contextAttachments, setContextAttachments] = useState<ChatContextAttachment[]>(initialContextAttachments);
  const [contextPickerMode, setContextPickerMode] = useState<"listing" | "lead" | null>(null);
  const [isWhatsAppImportMode, setIsWhatsAppImportMode] = useState(initialWhatsAppImportOpen);
  const [workspaceLeads, setWorkspaceLeads] = useState(initialRecentLeads);
  const [sessionSavedListings, setSessionSavedListings] = useState<RecentListingSummary[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [draftMediaByMessageId, setDraftMediaByMessageId] = useState<Record<string, PendingMedia[]>>({});
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeListingId, setActiveListingId] = useState<string | null>(
    initialContextAttachments.find((item) => item.type === "listing")?.entity_id ?? recentListings[0]?.id ?? null
  );
  const [activeLeadId, setActiveLeadId] = useState<string | null>(
    initialContextAttachments.find((item) => item.type === "lead")?.entity_id ?? null
  );
  const [activeLeadSnapshot, setActiveLeadSnapshot] = useState<LeadListItem | null>(() => {
    const initialLeadAttachment = initialContextAttachments.find((item) => item.type === "lead");
    if (!initialLeadAttachment) {
      return null;
    }

    return initialRecentLeads.find((lead) => lead.id === initialLeadAttachment.entity_id) ?? leadFromContextAttachment(initialLeadAttachment);
  });
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [canLoadOlder, setCanLoadOlder] = useState(hasOlderMessages);
  const [oldestMessageCreatedAt, setOldestMessageCreatedAt] = useState<string | null>(
    initialMessages[0]?.created_at ?? null
  );
  const [preferredUiLanguage, setPreferredUiLanguage] = useState<AgentResponseLanguage | null>(() =>
    detectLatestExplicitLanguagePreference(initialMessages)
  );
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      content: welcomeMessageContent
    },
    ...initialMessages.map(chatMessageFromRecord)
  ]);
  const [consumedPendingActionIds, setConsumedPendingActionIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTurnAnchorId, setActiveTurnAnchorId] = useState<string | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFollowUpNudgeVisible, setIsFollowUpNudgeVisible] = useState(false);
  const [isFollowUpNudgeLoading, setIsFollowUpNudgeLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(initialAuthOpen);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceLevels, setVoiceLevels] = useState(idleVoiceLevels);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const whatsAppChatFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatPanelRef = useRef<HTMLElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeTurnAnchorRef = useRef<string | null>(null);
  const activeOutputRef = useRef<string | null>(null);
  const hasPositionedInitialThreadRef = useRef(false);
  const hasStartedRef = useRef(false);
  const hasPushedHomeHistoryRef = useRef(false);
  const assistantStreamTimersRef = useRef<Map<string, number>>(new Map());
  const pendingProgressMessageIdRef = useRef<string | null>(null);
  const lastAuthPromptRef = useRef<AuthRequiredReason | null>(null);
  const positionedOutputIdsRef = useRef<Set<string>>(new Set());
  const composerMediaRef = useRef<PendingMedia[]>([]);
  const pendingMediaRef = useRef<PendingMedia[]>([]);
  const mediaSelectionTargetRef = useRef<"composer" | "draft">("composer");
  const mediaSelectionDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    setUserTimeZone(getResolvedTimeZone());
  }, []);

  useEffect(() => {
    if (isGuest) {
      writeGuestTranscript(messages);
    }
  }, [isGuest, messages]);

  useEffect(() => {
    if (isGuest) {
      return;
    }

    const transcript = readGuestTranscript();
    if (!transcript?.messages.length || window.localStorage.getItem(GUEST_CHAT_RESTORE_FLAG) !== "true") {
      return;
    }

    let cancelled = false;
    const messagesToImport = transcript.messages;

    async function importGuestTranscript() {
      try {
        const response = await fetch("/api/agent/messages/import-guest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: messagesToImport
          })
        });

        if (!response.ok || cancelled) {
          return;
        }

        window.sessionStorage.setItem(GUEST_CHAT_IMPORT_SUCCESS_FLAG, "true");
        clearGuestTranscript();
        router.refresh();
      } catch {
        // Keep the local transcript so the user can retry after a transient failure.
      }
    }

    void importGuestTranscript();

    return () => {
      cancelled = true;
    };
  }, [isGuest, router]);

  useEffect(() => {
    if (isGuest || typeof window === "undefined") {
      return;
    }

    if (window.sessionStorage.getItem(GUEST_CHAT_IMPORT_SUCCESS_FLAG) !== "true") {
      return;
    }

    window.sessionStorage.removeItem(GUEST_CHAT_IMPORT_SUCCESS_FLAG);
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "assistant",
        content:
          "You are signed in. Please confirm the promotion asset/listing draft to save it and generate dedicated tracking links. You can also edit the card before confirming."
      }
    ]);
  }, [isGuest]);

  useEffect(() => {
    if (isGuest) {
      setIsFollowUpNudgeVisible(false);
      return;
    }

    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone });
    const storageKey = `${FOLLOW_UP_NUDGE_DISMISS_PREFIX}:${todayKey}`;
    setIsFollowUpNudgeVisible(window.localStorage.getItem(storageKey) !== "true");
  }, [isGuest, userTimeZone]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`agent-lead-alerts:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const record = payload.new;
          if (!isRecord(record) || record.message_type !== "lead_alert") {
            return;
          }

          const message = chatMessageFromRecord(record as AgentChatMessageRecord);
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message]
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    const detectedPreference = detectLatestExplicitLanguagePreference(initialMessages);
    if (detectedPreference) {
      setPreferredUiLanguage((current) => current ?? detectedPreference);
    }
  }, [initialMessages]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceAnimationFrameRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasStarted = messages.length > 1;

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    if (!shouldHandleHomeBackNavigation || !hasStarted || hasPushedHomeHistoryRef.current) {
      return;
    }

    window.history.pushState({ pislakaAgentChat: true }, "", window.location.href);
    hasPushedHomeHistoryRef.current = true;
  }, [hasStarted, shouldHandleHomeBackNavigation]);

  useEffect(() => {
    if (!shouldHandleHomeBackNavigation) {
      return;
    }

    function resetToHomeState() {
      assistantStreamTimersRef.current.forEach((timer) => window.clearInterval(timer));
      assistantStreamTimersRef.current.clear();
      hasPushedHomeHistoryRef.current = false;
      hasPositionedInitialThreadRef.current = false;
      activeTurnAnchorRef.current = null;
      activeOutputRef.current = null;
      pendingProgressMessageIdRef.current = null;
      setMessages([
        {
          id: createId(),
          role: "assistant",
          content: welcomeMessageContent
        }
      ]);
      setInput("");
      setContextPickerMode(null);
      setActiveTurnAnchorId(null);
      setActiveOutputId(null);
      setIsWhatsAppImportMode(false);
      setIsSubmitting(false);
    }

    function handlePopState() {
      if (!hasPushedHomeHistoryRef.current || !hasStartedRef.current) {
        return;
      }

      resetToHomeState();
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [shouldHandleHomeBackNavigation, welcomeMessageContent]);

  const guidanceContext = useMemo(
    () =>
      buildAgentGuidanceContext({
        leads: workspaceLeads,
        listingCount: recentListings.length,
        sessionListingCount: sessionSavedListings.length,
        hasStarted,
        isWhatsAppImportMode,
        activeLeadId,
        activeListingId,
        timeZone: userTimeZone
      }),
    [
      activeLeadId,
      activeListingId,
      hasStarted,
      isWhatsAppImportMode,
      recentListings.length,
      sessionSavedListings.length,
      userTimeZone,
      workspaceLeads
    ]
  );
  const quickActions = createAgentGuidanceComposerActions(
    getAgentGuidanceSuggestions(guidanceContext, { surface: "home", limit: 4 }),
    appendAssistantMessage
  );
  const composerPlaceholder = getAgentComposerPlaceholder(guidanceContext);
  const attachActions = createAgentAttachComposerActions({
    importWhatsAppChat: () => {
      setIsWhatsAppImportMode(true);
      whatsAppChatFileInputRef.current?.click();
    },
    uploadMedia: openComposerMediaPicker,
    uploadDocument: openDocumentPicker,
    chooseListing: () => setContextPickerMode("listing" as const),
    chooseLead: () => setContextPickerMode("lead" as const)
  });

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
    scheduleMessagePosition(messageId, isDesktop ? 0.18 : 0.12);
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
    const topReserve = isDesktop ? containerRect.height * 0.28 : containerRect.height * 0.16;
    const visibleTop = Math.max(24, topReserve);
    const visibleBottom = Math.max(visibleTop + 80, readableBottom);
    const messageTop = messageRect.top - containerRect.top;
    const messageBottom = messageRect.bottom - containerRect.top;

    if (!positionedOutputIdsRef.current.has(messageId)) {
      positionedOutputIdsRef.current.add(messageId);
      const isComfortablyVisible = messageTop >= visibleTop && messageTop <= visibleBottom;
      if (!isComfortablyVisible) {
        scheduleMessagePosition(messageId, isDesktop ? 0.34 : 0.16);
      }
      return;
    }

    if (messageTop < visibleTop) {
      container.scrollTo({
        top: Math.max(0, container.scrollTop + messageTop - visibleTop),
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

  function prepareGuestTranscriptRestore() {
    if (!isGuest) {
      return;
    }

    writeGuestTranscript(messages);
    if (typeof window !== "undefined" && readGuestTranscript()?.messages.length) {
      window.localStorage.setItem(GUEST_CHAT_RESTORE_FLAG, "true");
    }
  }

  function latestPendingPromotionAction(): PendingPromotionAction | null {
    return findLatestPendingPromotionAction(messages, consumedPendingActionIds, ["whatsapp"]);
  }

  function latestPendingSocialCopyAction(): PendingSocialCopyAction | null {
    return findLatestPendingSocialCopyAction(messages, consumedPendingActionIds);
  }

  function uniquePendingMedia(media: PendingMedia[]) {
    const seen = new Set<string>();
    return media.filter((item) => {
      const key = item.dataUrl ?? `${item.file.name}:${item.file.size}:${item.file.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function latestUploadedMediaFromThread() {
    const media: PendingMedia[] = [];

    for (const message of [...messages].reverse()) {
      if (message.role === "user" && message.attachments?.length) {
        media.push(...message.attachments);
        break;
      }

      if (message.draftMedia?.length) {
        media.push(...message.draftMedia);
        break;
      }
    }

    return uniquePendingMedia(media);
  }

  function socialCopyToDraft(action: PendingSocialCopyAction): ListingDraftInput {
    const primaryCard = action.promotion.cards[0];
    const body = primaryCard?.body ?? action.promotion.summary;
    const firstLine = body
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);
    const sizeMatch = body.match(/\b(\d+(?:\.\d+)?)\s*(sqft|sq\.?\s*ft|square feet|marla|kanal)\b/i);
    const bedMatch = body.match(/\b(\d+)[-\s]*(?:bed|beds|bedroom|bedrooms)\b/i);
    const bathMatch = body.match(/\b(\d+)[-\s]*(?:bath|baths|bathroom|bathrooms)\b/i);
    const locationMatch = body.match(/\bin\s+([^.\n]+(?:Lahore|Karachi|Islamabad)[^.\n]*)/i);
    const rawAreaUnit = sizeMatch?.[2]?.toLowerCase().replace(/\s+/g, " ");
    const areaUnit =
      rawAreaUnit === "sqft" || rawAreaUnit === "sq. ft" || rawAreaUnit === "square feet"
        ? "sqft"
        : rawAreaUnit === "marla" || rawAreaUnit === "kanal"
          ? rawAreaUnit
          : undefined;
    const propertyType = /\b(apartment|flat)\b/i.test(body)
      ? "apartment"
      : /\b(villa|house)\b/i.test(body)
        ? "house"
        : /\b(plot)\b/i.test(body)
          ? "plot"
          : undefined;
    const listingType = /\bfor rent\b/i.test(body) ? "rent" : /\bfor sale\b/i.test(body) ? "sale" : undefined;
    const features = ["balcony", "TV lounge", "dining area", "kitchen", "laundry"].filter((feature) =>
      new RegExp(feature.replace(/\s+/g, "\\s+"), "i").test(body)
    );

    return {
      title: firstLine || primaryCard?.title || "Promotion asset draft",
      description: body,
      city: /karachi/i.test(body) ? "Karachi" : /islamabad/i.test(body) ? "Islamabad" : "Lahore",
      location_area: locationMatch?.[1]?.trim(),
      property_type: propertyType,
      listing_type: listingType,
      price_currency: "PKR",
      area_value: sizeMatch ? Number(sizeMatch[1]) : undefined,
      area_unit: areaUnit,
      bedrooms: bedMatch ? Number(bedMatch[1]) : undefined,
      bathrooms: bathMatch ? Number(bathMatch[1]) : undefined,
      features,
      ai_extracted_payload: {
        source: "social_copy_promotion_asset",
        channels: action.channels,
        social_copy: action.promotion,
        instruction: action.instruction
      },
      ai_confidence: 0.75
    };
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
    setActiveLeadId(lead.id);
    setActiveLeadSnapshot(lead);
    setContextPickerMode(null);
  }

  async function draftRecommendedFollowUp(lead: TodayFollowUpLead) {
    appendAssistantMessage({
      content: `Selected ${lead.full_name || "this lead"}. I am preparing a follow-up draft based on: ${lead.recommended_reason}`
    });

    const response = await fetch("/api/leads/reply-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lead_id: lead.id, preview: true })
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        content: errorPayload?.error ?? "I selected the lead, but could not draft the follow-up yet."
      });
      return;
    }

    const replyPayload = (await response.json()) as { draft: LeadReplyDraftWithLink };

    appendAssistantMessage({
      content: `Here is a recommended follow-up for ${lead.full_name || "this lead"}. Suggested next step: ${lead.recommended_action}`,
      leadReply: replyPayload.draft
    });
  }

  function handleLeadResultSelect(lead: LeadCardItem) {
    addLeadContext(lead);

    if (isTodayFollowUpLead(lead)) {
      void draftRecommendedFollowUp(lead);
    }
  }

  function removeContextAttachment(contextId: string) {
    const removedLeadId = contextId.startsWith("lead:") ? contextId.slice("lead:".length) : null;
    setContextAttachments((current) => current.filter((item) => item.id !== contextId));
    if (removedLeadId && activeLeadId === removedLeadId) {
      setActiveLeadId(null);
      setActiveLeadSnapshot(null);
    }
  }

  function removeComposerFile(fileId: string) {
    setComposerFiles((current) => {
      const nextFiles = current.filter((item) => item.id !== fileId);
      if (!nextFiles.some((item) => item.kind === "whatsapp_chat")) {
        setIsWhatsAppImportMode(false);
      }
      return nextFiles;
    });
  }

  function getActiveLead() {
    const leadId = getSelectedAgentContextEntityId(contextAttachments, "lead") ?? activeLeadId;
    if (!leadId) {
      return null;
    }

    const contextLead =
      contextAttachments
        .filter((item) => item.type === "lead")
        .map(leadFromContextAttachment)
        .find((lead) => lead?.id === leadId) ?? null;

    return workspaceLeads.find((lead) => lead.id === leadId) ?? contextLead ?? (activeLeadSnapshot?.id === leadId ? activeLeadSnapshot : null);
  }

  function mergeUpdatedLead(updatedLead?: LeadRecord | null) {
    if (!updatedLead) {
      return;
    }

    setWorkspaceLeads((current) => {
      const existing = current.find((lead) => lead.id === updatedLead.id);
      const merged: LeadListItem = {
        ...(existing ?? {
          listing_title: null,
          listing_area: null,
          listing_city: null,
          campaign_code: null,
          campaign_channel: null
        }),
        ...updatedLead
      };

      return existing
        ? current.map((lead) => (lead.id === updatedLead.id ? merged : lead))
        : [merged, ...current];
    });

    setActiveLeadSnapshot((current) => {
      if (!current || current.id !== updatedLead.id) {
        return current;
      }

      return {
        ...current,
        ...updatedLead
      };
    });
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
    if (isGuest) {
      return;
    }

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
    if (isGuest) {
      return;
    }

    try {
      const response = await fetch("/api/agent/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          conversationId,
          role: "user",
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
    const lastUserMessage = [...messages].reverse().find((item) => item.role === "user" && item.content.trim());
    const sourceMessage = message.sourceMessage ?? message.scheduleSourceMessage ?? message.leadSourceMessage ?? lastUserMessage?.content;
    const uiLanguage = message.uiLanguage ?? getCardLanguage(sourceMessage);
    const nextMessage: ChatMessage = {
      ...message,
      sourceMessage,
      uiLanguage,
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

  function handleAuthRequired(reason: AuthRequiredReason) {
    if (lastAuthPromptRef.current === reason) {
      prepareGuestTranscriptRestore();
      setIsAuthModalOpen(true);
      return;
    }

    lastAuthPromptRef.current = reason;
    prepareGuestTranscriptRestore();
    setIsAuthModalOpen(true);
    appendAssistantMessage({
      authRequiredReason: reason,
      content: getAuthRequiredMessage(reason)
    });
  }

  function estimateAssistantStreamDuration(content: string) {
    const characters = Array.from(content);
    if (!characters.length) {
      return 140;
    }

    const charactersPerTick = characters.length > 180 ? 3 : 2;
    return 120 + Math.ceil(characters.length / charactersPerTick) * 18;
  }

  async function appendAssistantMessageSequential(message: Omit<ChatMessage, "id" | "role"> & { id?: string }) {
    appendAssistantMessage(message);
    await new Promise((resolve) => window.setTimeout(resolve, estimateAssistantStreamDuration(message.content) + 120));
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
    const availableListings = [...sessionSavedListings, ...recentListings.filter((listing) => !sessionSavedListings.some((saved) => saved.id === listing.id))];

    if (resolution?.status === "ambiguous") {
      return { listing: null, ambiguous: true, candidates: resolution.candidates ?? [] };
    }

    if (resolution?.status === "no_match" || resolution?.status === "needs_clarification") {
      return { listing: null, ambiguous: false, candidates: [] };
    }

    if (resolution?.status === "matched") {
      const matchedListing =
        availableListings.find((listing) => listing.id === resolution.target_id) ??
        (resolution.matched ? candidateToListing(resolution.matched) : null);

      return { listing: matchedListing, ambiguous: false, candidates: [] };
    }

    if (messageMentionsCurrentListing(messageText) && activeListingId) {
      return {
        listing: availableListings.find((listing) => listing.id === activeListingId) ?? null,
        ambiguous: false,
        candidates: []
      };
    }

    const scoredListings = availableListings
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
      listing: availableListings.find((listing) => listing.id === activeListingId) ?? availableListings[0] ?? null,
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
      last_contacted_at: null,
      next_follow_up_at: null,
      last_note: null,
      budget_min: null,
      budget_max: null,
      interested_area: null,
      interested_listing_id: null,
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
        workspaceLeads.find((lead) => lead.id === resolution.target_id) ??
        (resolution.matched ? candidateToLead(resolution.matched) : null);

      return { lead: matchedLead, ambiguous: false, candidates: [] };
    }

    if (payload.lead_id) {
      return {
        lead: workspaceLeads.find((lead) => lead.id === payload.lead_id) ?? null,
        ambiguous: false,
        candidates: []
      };
    }

    const query = [payload.lead_name, payload.query].filter(Boolean).join(" ");
    const scoredLeads = workspaceLeads
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

  function showLeadResults(actionResponse: string, payload: LeadOperationPayload, fallbackQuery = "") {
    const responseContext = [fallbackQuery, actionResponse].filter(Boolean).join(" ");
    const matchedLeads = filterLeadsByPayload(workspaceLeads, payload, responseContext);

    if (!matchedLeads.length) {
      appendAssistantMessage({
        content: formatLeadResultCount(0, payload, responseContext),
        leadLatestOffer: workspaceLeads.length > 0,
        leadSourceMessage: fallbackQuery
      });
      return;
    }

    appendAssistantMessage({
      content: formatLeadResultCount(matchedLeads.length, payload, responseContext),
      leadResults: matchedLeads,
      leadSourceMessage: fallbackQuery
    });
  }

  async function showTodayFollowUps(actionResponse: string) {
    if (isGuest) {
      handleAuthRequired("read_workspace");
      return;
    }

    const followUpParams = new URLSearchParams({ limit: "10" });
    if (window.localStorage.getItem("pislaka_followup_seed_mode") === "followup-test") {
      followUpParams.set("seed", "followup-test");
    }
    const response = await fetch(`/api/leads/followups/today?${followUpParams.toString()}`);

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        content: errorPayload?.error ?? "I could not read today's follow-ups yet. Please try again in a moment."
      });
      return;
    }

    const payload = (await response.json()) as { leads?: TodayFollowUpLead[] };
    const leads = payload.leads ?? [];
    const firstReplyCount = leads.filter((lead) => lead.priority_label === "First reply").length;
    const taskCount = leads.filter((lead) => lead.priority_label === "Open task" || lead.priority_label === "Handle request").length;
    const optionalCount = leads.filter((lead) => lead.priority_label === "Check again").length;
    const followUpIntro = firstReplyCount || taskCount
      ? [
          "I found these follow-up suggestions from your lead history.",
          firstReplyCount ? `${firstReplyCount} new lead${firstReplyCount === 1 ? "" : "s"} have no recorded first contact.` : null,
          taskCount ? `${taskCount} customer request${taskCount === 1 ? "" : "s"} or promised follow-up${taskCount === 1 ? " is" : "s are"} still open.` : null,
          "Review them and choose which ones are worth acting on."
        ]
          .filter(Boolean)
          .join(" ")
      : optionalCount
        ? "There are no new first replies or open customer requests right now. These are optional check-ins worth considering; use your judgment before acting."
        : "No leads are due for follow-up right now.";

    appendAssistantMessage({
      content: leads.length ? followUpIntro : "No leads are due for follow-up right now.",
      leadResults: leads
    });
  }

  function dismissFollowUpNudge() {
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: userTimeZone });
    window.localStorage.setItem(`${FOLLOW_UP_NUDGE_DISMISS_PREFIX}:${todayKey}`, "true");
    setIsFollowUpNudgeVisible(false);
  }

  async function handleFollowUpNudgeOpen() {
    if (isFollowUpNudgeLoading) {
      return;
    }
    if (isGuest) {
      handleAuthRequired("read_workspace");
      return;
    }

    setIsFollowUpNudgeLoading(true);
    try {
      await showTodayFollowUps("Here are the leads that need follow-up today.");
      dismissFollowUpNudge();
    } finally {
      setIsFollowUpNudgeLoading(false);
    }
  }

  async function showScheduleResults(actionResponse: string, payload: ScheduleEventListPayload, sourceMessage: string) {
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
      if (isUnauthorizedResponse(response)) {
        handleAuthRequired("read_workspace");
        return;
      }

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
      content: formatScheduleQueryResponse(payload, sourceMessage) || actionResponse,
      scheduleEvents: result.events ?? [],
      scheduleSourceMessage: sourceMessage
    });
  }

  async function showAnalyticsSummary(
    actionResponse: string,
    payload: Record<string, unknown> | undefined,
    sourceMessage: string
  ) {
    if (isGuest) {
      handleAuthRequired("read_workspace");
      return;
    }

    const range = typeof payload?.range === "string" ? (payload.range as AnalyticsRange) : "week";
    const focus = typeof payload?.focus === "string" ? (payload.focus as AnalyticsFocus) : "overview";
    const params = new URLSearchParams({
      range,
      focus,
      time_zone: userTimeZone
    });
    const response = await fetch(`/api/analytics?${params.toString()}`);

    if (!response.ok) {
      if (isUnauthorizedResponse(response)) {
        handleAuthRequired("read_workspace");
        return;
      }

      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        content: errorPayload?.error ?? "I could not read analytics yet. Please try again in a moment.",
        sourceMessage
      });
      return;
    }

    const result = (await response.json()) as { summary?: AnalyticsSummary };
    if (!result.summary) {
      appendAssistantMessage({
        content: "I could not find analytics data yet. Generate campaign links and collect leads to start tracking.",
        sourceMessage
      });
      return;
    }

    appendAssistantMessage({
      content: actionResponse || "Here is the latest performance summary from your workspace.",
      analyticsSummary: result.summary,
      sourceMessage
    });
  }

  const agentActionResponseHandlers = createAgentActionResponseHandlers({
    appendAssistantMessage,
    draftReplyForLead,
    looksLikeExternalChannelPromotion,
    proposeLeadCreate,
    proposeLeadDetailsUpdate,
    proposeLeadFollowUpRecord,
    proposeLeadListingUpdate,
    proposeLeadStatusUpdate,
    proposeListingUpdateFromMessage,
    proposePromotionFromMessage,
    showAnalyticsSummary,
    showLeadResults,
    showScheduleResolutionMessage,
    showScheduleResults,
    showTodayFollowUps
  });

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

  function proposeLeadFollowUpRecord(
    actionResponse: string,
    payload: LeadOperationPayload,
    resolution?: AgentResolution
  ) {
    const target = getLeadTarget(payload, resolution);

    if (target.ambiguous) {
      appendEntitySelectionMessage({
        targetType: "lead",
        intent: "record_lead_followup",
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
      leadStatusUpdate: {
        lead: target.lead,
        status: payload.status,
        urgency: payload.urgency,
        activityType: payload.activity_type === "message_sent" ? "message_sent" : "status_changed",
        summary: payload.summary ?? payload.query
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

  function proposeLeadCreate(payload: LeadCreatePayload, followUp?: LeadCreateFollowUpPreview) {
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
        },
        followUp
      }
    });
  }

  function proposeBatchLeadStatusUpdate(messageText: string, leadContexts: ChatContextAttachment[]) {
    const nextStatus = leadStatusFromMessage(messageText);
    const leads = leadContexts
      .map((context) => workspaceLeads.find((lead) => lead.id === context.entity_id))
      .filter((lead): lead is LeadListItem => Boolean(lead));

    if (!nextStatus?.status || !leads.length) {
      appendAssistantMessage({
        content:
          "I attached those leads, but I need a clear status before I can prepare a batch update. Try contacted, hot lead, interested, closed, not interested, or new."
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

  async function summarizeWhatsAppChatFromComposer(
    messageText: string,
    files: PendingFileAttachment[],
    selectedLeadId: string | null,
    requestedAction: ChatImportRequestedAction = "unknown",
    uiLanguage: AgentResponseLanguage = "english"
  ) {
    const chatFile = files.find((item) => item.kind === "whatsapp_chat" || isWhatsAppChatFile(item.file));
    const selectedLead = selectedLeadId
      ? workspaceLeads.find((lead) => lead.id === selectedLeadId) ?? (activeLeadSnapshot?.id === selectedLeadId ? activeLeadSnapshot : null)
      : null;
    const formData = new FormData();

    formData.append("save_original_chat_text", "false");
    formData.append("broker_display_language", uiLanguage);
    if (selectedLeadId) {
      formData.append("lead_id", selectedLeadId);
    }

    if (chatFile) {
      const isZip = chatFile.file.name.toLowerCase().endsWith(".zip");
      formData.append("source_type", isZip ? "whatsapp_zip_upload" : "whatsapp_txt_upload");
      formData.append("file", chatFile.file);
    } else {
      formData.append("source_type", "whatsapp_paste");
      formData.append("text", messageText);
    }

    const response = await fetch("/api/leads/import-whatsapp-chat", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      appendAssistantMessage({
        uiLanguage,
        content: errorPayload?.error ?? "I could not summarize that WhatsApp chat yet."
      });
      return;
    }

    const payload = (await response.json()) as ChatFollowupSummary & {
      needs_txt_selection?: boolean;
      txt_candidates?: ZipTextCandidate[];
    };

    if (payload.needs_txt_selection) {
      appendAssistantMessage({
        uiLanguage,
        content: "I found more than one text file in the WhatsApp export. Choose the chat file before I summarize it.",
        chatImport: {
          zipCandidates: payload.txt_candidates ?? [],
          pendingZipFile: chatFile?.file,
          selectedLead,
          selectedLeadId
        }
      });
      return;
    }

    const resolvedLead = payload.matched_lead ?? selectedLead;

    if (requestedAction === "analyze_only") {
      appendAssistantMessage({
        uiLanguage,
        content: buildChatImportNarrative(payload, resolvedLead, uiLanguage)
      });
      return;
    }

    if (requestedAction === "reply") {
      appendAssistantMessage({
        uiLanguage,
        content:
          uiLanguage === "chinese"
            ? `我已阅读聊天并起草了回复${resolvedLead ? `，对象是 ${resolvedLead.full_name || resolvedLead.phone || "这条线索"}` : ""}。打开 WhatsApp 前请先检查。`
            : uiLanguage === "urdu"
              ? `میں نے chat پڑھ کر reply draft کر دیا ہے${resolvedLead ? `، ${resolvedLead.full_name || resolvedLead.phone || "اس lead"} کے لیے` : ""}۔ WhatsApp کھولنے سے پہلے review کر لیں۔`
              : uiLanguage === "roman_urdu"
                ? `Main ne chat parh kar reply draft kar diya hai${resolvedLead ? `, ${resolvedLead.full_name || resolvedLead.phone || "is lead"} ke liye` : ""}. WhatsApp kholne se pehle review kar lein.`
                : `I read the chat and drafted a reply${resolvedLead ? ` for ${resolvedLead.full_name || resolvedLead.phone || "this lead"}` : ""}. Review it before opening WhatsApp.`,
        chatReplyAction: {
          summary: payload,
          lead: resolvedLead
        }
      });
      return;
    }

    if (resolvedLead && requestedAction === "save_followup") {
      appendAssistantMessage({
        uiLanguage,
        content: "",
        chatFollowupManage: {
          summary: payload,
          lead: resolvedLead,
          suggestedAction: "note"
        }
      });
      return;
    }

    if (resolvedLead && requestedAction === "set_reminder") {
      appendAssistantMessage({
        uiLanguage,
        content:
          uiLanguage === "chinese"
            ? `我找到了 ${resolvedLead.full_name || resolvedLead.phone || "匹配线索"}。请选择提醒时间，然后确认。`
            : uiLanguage === "urdu"
              ? `مجھے ${resolvedLead.full_name || resolvedLead.phone || "matching lead"} مل گئی۔ reminder time منتخب کر کے confirm کریں۔`
              : uiLanguage === "roman_urdu"
                ? `Mujhe ${resolvedLead.full_name || resolvedLead.phone || "matching lead"} mil gayi. Reminder time choose karke confirm karein.`
                : `I found ${resolvedLead.full_name || resolvedLead.phone || "the matching lead"}. Choose the reminder time, then confirm.`,
        chatReminder: {
          summary: payload,
          lead: resolvedLead
        }
      });
      return;
    }

    if (resolvedLead && requestedAction === "update_status") {
      appendAssistantMessage({
        uiLanguage,
        content: "",
        chatFollowupManage: {
          summary: payload,
          lead: resolvedLead,
          suggestedAction: "status"
        }
      });
      return;
    }

    await appendAssistantMessageSequential({
      uiLanguage,
      content: buildChatImportNarrative(payload, resolvedLead, uiLanguage)
    });

    await appendAssistantMessageSequential({
      uiLanguage,
      content:
        uiLanguage === "chinese"
          ? "建议回复："
          : uiLanguage === "urdu"
            ? "تجویز کردہ جواب:"
            : uiLanguage === "roman_urdu"
              ? "Suggested reply:"
              : "Suggested reply:",
      chatReplyAction: {
        summary: payload,
        lead: resolvedLead
      }
    });

    if (resolvedLead) {
      const suggestedAction = recommendChatFollowupAction(payload, resolvedLead);
      if (suggestedAction) {
        await appendAssistantMessageSequential({
          uiLanguage,
          content: "",
          chatFollowupManage: {
            summary: payload,
            lead: resolvedLead,
            suggestedAction
          }
        });
      }
      return;
    }

    const verifiedCandidates = getVerifiedChatLeadCandidates(payload).slice(0, 5);
    const hasDetectedIdentity = Boolean(payload.detected_customer_name || payload.detected_phone);

    if (!verifiedCandidates.length && !hasDetectedIdentity) {
      await appendAssistantMessageSequential({
        uiLanguage,
        content:
          uiLanguage === "chinese"
            ? "我没有找到足够的客户身份信息来匹配或创建线索。如果要把这段聊天关联到线索，请发送客户姓名或电话。"
            : uiLanguage === "urdu"
              ? "مجھے lead match یا create کرنے کے لیے کافی customer identity information نہیں ملی۔ اگر اس chat کو lead سے attach کرنا ہے تو customer name یا phone بھیجیں۔"
              : uiLanguage === "roman_urdu"
                ? "Mujhe lead match ya create karne ke liye kaafi customer identity information nahi mili. Agar is chat ko lead se attach karna hai to customer name ya phone bhejein."
                : "I did not find enough customer identity information to match or create a lead. Please send the customer name or phone if you want me to attach this chat to a lead."
      });
      return;
    }

    await appendAssistantMessageSequential({
      uiLanguage,
      content: verifiedCandidates.length
        ? uiLanguage === "chinese"
          ? "我找到了可能匹配的线索。只有确认是同一个客户时才选择。"
          : uiLanguage === "urdu"
            ? "مجھے possible matching leads ملی ہیں۔ صرف اسی وقت select کریں جب یہ same customer ہو۔"
            : uiLanguage === "roman_urdu"
              ? "Mujhe possible matching leads mili hain. Sirf tab select karein jab yeh same customer ho."
              : "I found possible matching leads. Choose one only if it is the same customer."
        : uiLanguage === "chinese"
          ? "我没有找到客户信息匹配的现有线索。你可以用识别到的客户信息创建新线索。"
          : uiLanguage === "urdu"
            ? "مجھے matching customer information والی existing lead نہیں ملی۔ detected customer details سے new lead create کر سکتے ہیں۔"
            : uiLanguage === "roman_urdu"
              ? "Mujhe matching customer information wali existing lead nahi mili. Detected customer details se new lead create kar sakte hain."
              : "I did not find an existing lead with matching customer information. You can create a new lead from the detected customer details.",
      chatLeadChoice: {
        summary: {
          ...payload,
          candidate_leads: verifiedCandidates
        },
        candidates: verifiedCandidates
      }
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

    if (preview.intent === "record_lead_followup") {
      appendAssistantMessage({
        content: preview.actionResponse,
        leadStatusUpdate: {
          lead,
          status: (nextPayload as LeadOperationPayload).status,
          urgency: (nextPayload as LeadOperationPayload).urgency,
          activityType:
            (nextPayload as LeadOperationPayload).activity_type === "message_sent"
              ? "message_sent"
              : "status_changed",
          summary: (nextPayload as LeadOperationPayload).summary ?? (nextPayload as LeadOperationPayload).query
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
  ): Promise<boolean> {
    setActiveListingId(listing.id);
    appendAssistantMessage({
      content: `Confirmed. I am creating ${channels.length} channel campaign link${channels.length === 1 ? "" : "s"} and promotion copy for ${listing.title || "this listing"}...`
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch("/api/agent/promote-listing", {
        method: "POST",
        signal: controller.signal,
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
        return false;
      }

      const payload = (await response.json()) as { promotion: ListingPromotion };
      appendAssistantMessage({
        content: "Here is the promotion pack. Each channel has its own lead page, so later we can attribute leads by listing and channel.",
        promotion: payload.promotion
      });
      return true;
    } catch (error) {
      appendAssistantMessage({
        content:
          error instanceof DOMException && error.name === "AbortError"
            ? "Promotion generation took too long. Please try again in a moment."
            : "I could not reach the promotion service. Please try again in a moment."
      });
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
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

    const { agentMessageContent: initialAgentMessageContent, mediaSummary, visibleUserMessageContent } =
      buildAgentTurnContent({
        message: trimmed,
        mediaCount: outgoingMedia.length,
        fileAttachments: outgoingFiles
      });
    let agentMessageContent = initialAgentMessageContent;
    const currentListingId = getSelectedAgentContextEntityId(outgoingContext, "listing") ?? activeListingId ?? undefined;
    const currentLeadId = getSelectedAgentContextEntityId(outgoingContext, "lead") ?? activeLeadId ?? undefined;
    const outgoingLeadId = outgoingContext.find((item) => item.type === "lead")?.entity_id ?? activeLeadId ?? null;
    const whatsAppImportTurn = getWhatsAppImportTurn({
      message: trimmed,
      files: outgoingFiles,
      hasOutgoingMedia,
      isScheduleRequest: isScheduleRequest(trimmed),
      isWhatsAppImportMode
    });
    const explicitUiLanguage = detectExplicitResponseLanguage(trimmed);
    const turnUiLanguage = await detectTurnUiLanguage(trimmed, outgoingFiles, explicitUiLanguage ?? preferredUiLanguage);
    if (explicitUiLanguage) {
      setPreferredUiLanguage(explicitUiLanguage);
    }

    setInput("");
    setComposerMedia([]);
    setComposerFiles([]);
    setContextAttachments([]);
    if (outgoingLeadId) {
      setActiveLeadId(outgoingLeadId);
      const outgoingLead =
        workspaceLeads.find((lead) => lead.id === outgoingLeadId) ??
        outgoingContext
          .filter((item) => item.type === "lead")
          .map(leadFromContextAttachment)
          .find((lead) => lead?.id === outgoingLeadId) ??
        null;
      setActiveLeadSnapshot(outgoingLead);
    }
    setIsWhatsAppImportMode(false);
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
      fileAttachments: outgoingFiles
    });
    activeTurnAnchorRef.current = userMessage.id;
    activeOutputRef.current = null;
    setActiveTurnAnchorId(userMessage.id);
    setActiveOutputId(null);
    window.requestAnimationFrame(() => positionTurnAnchor(userMessage.id));

    let visionAnalysisContext = "";
    let visionAnalysisError = "";
    let mediaProgressMessageId: string | null = null;
    if (hasOutgoingMedia) {
      mediaProgressMessageId = appendProgressMessage(
        outgoingMedia.some((item) => item.mediaType === "image")
          ? "I am reading the uploaded image and checking the property or chat details."
          : "I attached the media and I am preparing the next step."
      );
      try {
        const visionAnalysis = await analyzeComposerImages(trimmed, outgoingMedia);
        visionAnalysisContext = visionAnalysis.agentContext;
        if (visionAnalysisContext) {
          agentMessageContent = [agentMessageContent, visionAnalysisContext].filter(Boolean).join("\n\n");
          updateProgressMessage(mediaProgressMessageId, "I read the image. I am preparing the next step.");
        }
      } catch (error) {
        visionAnalysisError = error instanceof Error ? error.message : "I could not analyze the uploaded images.";
        if (mediaProgressMessageId) {
          updateProgressMessage(mediaProgressMessageId, "I could not read the image automatically, but I can still use it as attached media.");
        }
      }
    }

    if (whatsAppImportTurn.shouldHandle) {
      const progressCopy = getWhatsAppImportProgressCopy(turnUiLanguage);
      const progressMessageId = appendProgressMessage(progressCopy[0]);
      const progressTimers = [
        window.setTimeout(() => updateProgressMessage(progressMessageId, progressCopy[1]), 900),
        window.setTimeout(() => updateProgressMessage(progressMessageId, progressCopy[2]), 2600),
        window.setTimeout(() => updateProgressMessage(progressMessageId, progressCopy[3]), 7000)
      ];

      try {
        await summarizeWhatsAppChatFromComposer(
          trimmed,
          outgoingFiles,
          outgoingLeadId,
          whatsAppImportTurn.requestedAction,
          turnUiLanguage
        );
      } catch (error) {
        appendAssistantMessage({
          uiLanguage: turnUiLanguage,
          content:
            error instanceof Error
              ? error.message
              : "I could not summarize that WhatsApp chat yet. Please try again."
        });
      } finally {
        progressTimers.forEach((timer) => window.clearTimeout(timer));
        setIsSubmitting(false);
      }
      return;
    }

    if (!trimmed && !visionAnalysisContext) {
      appendAssistantMessage({
        uiLanguage: turnUiLanguage,
        content: getEmptyAgentTurnResponse({
          activeDraftId,
          hasOutgoingMedia,
          visionAnalysisError
        })
      });
      setIsSubmitting(false);
      return;
    }

    const pendingPromotionAction = latestPendingPromotionAction();
    if (
      pendingPromotionAction &&
      canHandlePendingActionConfirmation({
        message: trimmed,
        hasOutgoingMedia,
        hasOutgoingFiles,
        hasOutgoingContext
      })
    ) {
      setConsumedPendingActionIds((current) => [...current, pendingPromotionAction.messageId]);
      const generated = await generatePromotionForListing(
        pendingPromotionAction.listing,
        pendingPromotionAction.instruction,
        pendingPromotionAction.channels
      );

      if (!generated) {
        setConsumedPendingActionIds((current) =>
          current.filter((messageId) => messageId !== pendingPromotionAction.messageId)
        );
      }

      setIsSubmitting(false);
      return;
    }

    const pendingSocialCopyAction = latestPendingSocialCopyAction();
    if (
      pendingSocialCopyAction &&
      canHandlePendingActionConfirmation({
        message: trimmed,
        hasOutgoingMedia,
        hasOutgoingFiles,
        hasOutgoingContext
      })
    ) {
      setConsumedPendingActionIds((current) => [...current, pendingSocialCopyAction.messageId]);
      const assistantMessageId = createId();
      const draft = socialCopyToDraft(pendingSocialCopyAction);
      const carriedMedia = uniquePendingMedia([...pendingMediaRef.current, ...latestUploadedMediaFromThread()]);
      setActiveDraftId(assistantMessageId);
      if (carriedMedia.length) {
        setDraftMediaByMessageId((current) => ({
          ...current,
          [assistantMessageId]: carriedMedia
        }));
        setPendingMedia([]);
      }
      appendAssistantMessage({
        id: assistantMessageId,
        uiLanguage: turnUiLanguage,
        content:
          "I prepared this as a saveable promotion asset/listing draft. Confirm it to save the asset; after it is saved, I can generate the dedicated tracking links.",
        draft,
        draftMedia: carriedMedia,
        sourceMessage: pendingSocialCopyAction.instruction
      });
      setIsSubmitting(false);
      return;
    }

    const selectedLeadContexts = outgoingContext.filter((item) => item.type === "lead");
    const bulkLeadWriteGuard = getBulkLeadWriteGuard(trimmed, selectedLeadContexts);
    if (bulkLeadWriteGuard.kind !== "none") {
      if (bulkLeadWriteGuard.kind === "status_update") {
        proposeBatchLeadStatusUpdate(trimmed, bulkLeadWriteGuard.leadContexts);
        setIsSubmitting(false);
        return;
      }

      appendAssistantMessage({
        uiLanguage: turnUiLanguage,
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
    const progressMessageId = mediaProgressMessageId ?? appendProgressMessage(progressCopy[0]);
    if (mediaProgressMessageId) {
      updateProgressMessage(progressMessageId, progressCopy[0]);
    }
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
          context_messages: createRecentAgentContextMessages(messages),
          workflow_state: inferAgentWorkflowState(messages)
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

      if (await handleAgentActionResponse(agentActionResponseHandlers, payload.action, agentMessageContent)) {
        return;
      }

      const draft =
        payload.action.intent === "create_listing_draft"
          ? (payload.action.payload as ListingDraftInput)
          : undefined;
      const scheduleEvent =
        payload.action.intent === "create_schedule_event"
          ? (payload.action.payload as BrokerEventDraftInput)
          : undefined;
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

    if (isGuest) {
      handleAuthRequired("save_followup");
      return;
    }

    if (isListening) {
      stopVoiceRecording();
      return;
    }

    void startVoiceRecording();
  }

  async function handleMediaSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const accepted = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
        .map((file) => createPendingMedia(file))
    );

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

  function addComposerDocumentFiles(files: File[]) {
    const accepted = files.map((file) => ({
      id: createId(),
      file,
      kind: "document" as const
    }));

    setComposerFiles((current) => [...current, ...accepted].slice(-8));
  }

  function addWhatsAppChatFiles(files: File[]) {
    const accepted = files
      .filter(isWhatsAppChatFile)
      .map((file) => ({
        id: createId(),
        file,
        kind: "whatsapp_chat" as const
      }));

    if (!accepted.length) {
      return false;
    }

    setIsWhatsAppImportMode(true);
    setComposerFiles((current) => [...current, ...accepted].slice(-8));
    return true;
  }

  async function handleComposerFilesDropped(files: File[]) {
    if (!files.length) {
      return;
    }

    const mediaFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    const chatFiles = files.filter(isWhatsAppChatFile);
    const otherFiles = files.filter((file) => !mediaFiles.includes(file) && !chatFiles.includes(file));

    if (mediaFiles.length) {
      const accepted = await Promise.all(mediaFiles.map((file) => createPendingMedia(file)));
      setComposerMedia((current) => [...current, ...accepted]);
    }

    if (chatFiles.length) {
      addWhatsAppChatFiles(chatFiles);
    }

    if (otherFiles.length) {
      addComposerDocumentFiles(otherFiles);
    }
  }

  function handleDocumentSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    addComposerDocumentFiles(Array.from(files));

    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = "";
    }
  }

  function handleWhatsAppChatSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    if (!addWhatsAppChatFiles(Array.from(files))) {
      appendAssistantMessage({
        content: "Choose a WhatsApp export .txt or .zip file."
      });
      if (whatsAppChatFileInputRef.current) {
        whatsAppChatFileInputRef.current.value = "";
      }
      return;
    }

    if (whatsAppChatFileInputRef.current) {
      whatsAppChatFileInputRef.current.value = "";
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
      if (item && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }

      return {
        ...current,
        [draftMessageId]: currentMedia.filter((media) => media.id !== mediaId)
      };
    });
    setMessages((current) =>
      current.map((message) =>
        message.id === draftMessageId
          ? {
              ...message,
              draftMedia: message.draftMedia?.filter((media) => media.id !== mediaId)
            }
          : message
      )
    );
  }

  return (
    <>
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
            {message.authRequiredReason ? (
              <button
                className="message-auth-link"
                type="button"
                onClick={() => {
                  prepareGuestTranscriptRestore();
                  setIsAuthModalOpen(true);
                }}
              >
                Sign in to continue
              </button>
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
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onAttachMedia={() => openDraftMediaPicker(message.id)}
                    onRemoveMedia={(mediaId) => removeDraftMedia(message.id, mediaId)}
                    pendingMedia={draftMediaByMessageId[message.id] ?? message.draftMedia ?? []}
                    onSaved={(uploadedCount, listingId, savedDraft, mediaPreview, failedMedia) => {
                      const savedListing = draftToRecentListingSummary(listingId, savedDraft);
                      const location = [savedDraft.location_area, savedDraft.city].filter(Boolean).join(", ");
                      const failedCount = failedMedia.length;
                      const failedNames = failedMedia.slice(0, 3).map((item) => item.name).join(", ");
                      const isPromotionAssetDraft = savedDraft.ai_extracted_payload?.source === "social_copy_promotion_asset";
                      const promotionChannels = getPromotionAssetChannels(savedDraft);
                      setSessionSavedListings((current) => [
                        savedListing,
                        ...current.filter((listing) => listing.id !== listingId)
                      ]);
                      setActiveListingId(listingId);
                      appendAssistantMessage({
                        content: failedCount
                          ? `Done. I saved the listing and uploaded ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}. ${failedCount} media file${failedCount === 1 ? "" : "s"} failed${failedNames ? `: ${failedNames}` : ""}.`
                          : isPromotionAssetDraft
                            ? `Done. I saved this promotion asset to your library${uploadedCount ? ` with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}` : ""}. I am generating the dedicated tracking links now.`
                            : uploadedCount
                              ? `Done. I added it to your listing library with ${uploadedCount} media file${uploadedCount === 1 ? "" : "s"}.`
                              : "Done. I added it to your listing library.",
                        listingSaved: {
                          listingId,
                          title: savedDraft.title ?? null,
                          location: location || null,
                          uploadedCount,
                          libraryHref: `/listings#listing-${listingId}`,
                          agentHref: `/?listing=${listingId}`
                        },
                        listingSavedMedia: mediaPreview,
                        sourceMessage: message.sourceMessage
                      });
                      if (isPromotionAssetDraft && !failedCount) {
                        void generatePromotionForListing(
                          savedListing,
                          String(savedDraft.ai_extracted_payload?.instruction ?? message.sourceMessage ?? savedDraft.description ?? ""),
                          promotionChannels
                        );
                      }
                    }}
                  />
                ) : null}
                {message.listingSaved ? (
                  <ListingSavedCard
                    mediaPreview={message.listingSavedMedia}
                    onAskAgent={addSavedListingContext}
                    preview={message.listingSaved}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                  />
                ) : null}
                {message.scheduleEvent ? (
                  <SchedulePreviewCard
                    event={message.scheduleEvent}
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    timeZone={userTimeZone}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSaved={() => {
                      appendAssistantMessage({
                        content:
                          "Done. I added it to Schedule. Next, I can show today's appointments and reminders from the workspace.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.scheduleEvents ? (
                  <ScheduleResultsCard
                    events={message.scheduleEvents}
                    timeZone={userTimeZone}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage ?? message.scheduleSourceMessage ?? message.content}
                  />
                ) : null}
                {message.leadResults ? (
                  <LeadResultsCard
                    leads={message.leadResults}
                    onSelect={handleLeadResultSelect}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage ?? message.leadSourceMessage ?? message.content}
                  />
                ) : null}
                {message.leadLatestOffer ? (
                  <LeadLatestOfferCard
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onConfirm={() => {
                      const latestLead = workspaceLeads[0] ? [workspaceLeads[0]] : [];
                      appendAssistantMessage({
                        content: latestLead.length
                          ? "Confirmed. Here is the latest lead from your inbox."
                          : "There are no leads in your recent inbox yet.",
                        leadResults: latestLead,
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.analyticsSummary ? <AnalyticsChatCard summary={message.analyticsSummary} /> : null}
                {message.leadStatusUpdate ? (
                  <LeadStatusConfirmCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.leadStatusUpdate}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the lead status. You can review all lead activity from the Leads page.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.leadDetailsUpdate ? (
                  <LeadDetailsConfirmCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.leadDetailsUpdate}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the lead details. You can review the latest contact record from the Leads page.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.leadCreate ? (
                  <LeadCreateConfirmCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.leadCreate}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSaved={(lead, savedFollowUp) => {
                      mergeUpdatedLead(lead);
                      appendAssistantMessage({
                        content: savedFollowUp
                          ? "Done. I created the lead and saved the WhatsApp chat summary as its first follow-up record."
                          : "Done. I saved the lead. You can review it from the Leads page.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.leadBatchStatusUpdate ? (
                  <LeadBatchStatusConfirmCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.leadBatchStatusUpdate}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the selected leads. You can review them from the Leads page.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.leadListingUpdate ? (
                  <LeadListingConfirmCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.leadListingUpdate}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the lead's primary listing. You can review the latest record from the Leads page.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.listingUpdate ? (
                  <ListingUpdateConfirmCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.listingUpdate}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onUpdated={() => {
                      appendAssistantMessage({
                        content: "Done. I updated the listing. You can open Listings from the sidebar to review it.",
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.listingUpdateChoices ? (
                  <ListingUpdateSelectionCard
                    preview={message.listingUpdateChoices}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSelect={(listing) => {
                      setActiveListingId(listing.id);
                      appendAssistantMessage({
                        content: message.listingUpdateChoices?.actionResponse ?? "Please confirm this listing update.",
                        listingUpdate: {
                          listing,
                          changes: message.listingUpdateChoices?.changes ?? {}
                        },
                        sourceMessage: message.sourceMessage
                      });
                    }}
                  />
                ) : null}
                {message.entitySelection ? (
                  <EntitySelectionCard
                    preview={message.entitySelection}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSelect={(candidate) => {
                      void continueAfterEntitySelection(message.entitySelection as EntitySelectionPreview, candidate);
                    }}
                    onSkip={
                      message.entitySelection.intent === "create_schedule_event"
                        ? () => {
                            appendAssistantMessage({
                              content: message.entitySelection?.actionResponse ?? "Please confirm this schedule item.",
                              scheduleEvent: message.entitySelection?.payload as BrokerEventDraftInput,
                              sourceMessage: message.sourceMessage
                            });
                          }
                        : undefined
                    }
                  />
                ) : null}
                {message.leadReply ? (
                  <LeadReplyCard
                    draft={message.leadReply}
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                  />
                ) : null}
                {message.chatImport ? (
                  <ChatFollowupSummaryCard
                    preview={message.chatImport}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    contextLeads={
                      [
                        ...(message.contextAttachments
                          ?.filter((item) => item.type === "lead")
                          .map((item) => workspaceLeads.find((lead) => lead.id === item.entity_id) ?? leadFromContextAttachment(item))
                          .filter((lead): lead is LeadListItem => Boolean(lead)) ?? []),
                        getActiveLead()
                      ].filter((lead): lead is LeadListItem => Boolean(lead))
                    }
                    onCreateLead={(payload, followUp) => proposeLeadCreate(payload, followUp)}
                    recentLeads={workspaceLeads}
                    onDraftReply={(summary, lead) => {
                      appendAssistantMessage({
                        content: `Here is a reply draft for ${lead.full_name || lead.phone || "this lead"}. Review it, then copy it or open WhatsApp.`,
                        chatReplyAction: {
                          summary,
                          lead
                        }
                      });
                    }}
                    onManageFollowup={(summary, lead) => {
                      const suggestedAction = recommendChatFollowupAction(summary, lead);
                      if (!suggestedAction) {
                        appendAssistantMessage({
                          content: "I do not see a strong follow-up action from this chat. You can still tell me what to do, for example: save this note, update status, or remind me tomorrow."
                        });
                        return;
                      }
                      appendAssistantMessage({
                        content: "",
                        chatFollowupManage: {
                          summary,
                          lead,
                          suggestedAction
                        }
                      });
                    }}
                    onNeedsSummary={(summary) => {
                      setMessages((current) =>
                        current.map((item) =>
                          item.id === message.id
                            ? {
                                ...item,
                                chatImport: {
                                  ...item.chatImport,
                                  summary,
                                  selectedLead: summary.matched_lead ?? item.chatImport?.selectedLead,
                                  selectedLeadId: summary.matched_lead?.id ?? item.chatImport?.selectedLeadId
                                }
                              }
                            : item
                        )
                      );
                    }}
                  />
                ) : null}
                {message.chatReplyAction ? (
                  <ChatReplyActionCard preview={message.chatReplyAction} sourceMessage={message.uiLanguage ?? message.sourceMessage} />
                ) : null}
                {message.chatFollowupManage ? (
                  <ChatFollowupManageCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.chatFollowupManage}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSaved={(content, updatedLead) => {
                      mergeUpdatedLead(updatedLead);
                      appendAssistantMessage({ content });
                    }}
                    onNeedsReminder={(preview) => {
                      appendAssistantMessage({
                        content: `Choose a reminder time for ${preview.lead.full_name || preview.lead.phone || "this lead"}, then confirm.`,
                        chatReminder: preview
                      });
                    }}
                    onDeclined={() => {
                      appendAssistantMessage({
                        content: "No problem. I did not change the lead. Tell me what you want to do next, for example save a note, update status, or remind you later."
                      });
                    }}
                  />
                ) : null}
                {message.chatLeadChoice ? (
                  <ChatLeadChoiceCard
                    preview={message.chatLeadChoice}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onChooseLead={(lead) => {
                      const summary = (message.chatLeadChoice as ChatLeadChoicePreview).summary;
                      const suggestedAction = recommendChatFollowupAction(summary, lead);
                      appendAssistantMessage({
                        content: suggestedAction
                          ? `Matched this chat to ${lead.full_name || lead.phone || "the selected lead"}. I have one recommended next step.`
                          : `Matched this chat to ${lead.full_name || lead.phone || "the selected lead"}. I do not see a strong database action yet.`,
                        chatFollowupManage: suggestedAction
                          ? {
                              summary,
                              lead,
                              suggestedAction
                            }
                          : undefined
                      });
                    }}
                    onCreateLead={(payload, followUp) => proposeLeadCreate(payload, followUp)}
                  />
                ) : null}
                {message.chatFollowupNote ? (
                  <ChatFollowupNoteCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.chatFollowupNote}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSaved={(content) => {
                      appendAssistantMessage({ content });
                    }}
                  />
                ) : null}
                {message.chatReminder ? (
                  <ChatReminderCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.chatReminder}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSaved={(content) => {
                      appendAssistantMessage({ content });
                    }}
                  />
                ) : null}
                {message.chatStatus ? (
                  <ChatStatusCard
                    isGuest={isGuest}
                    onAuthRequired={handleAuthRequired}
                    preview={message.chatStatus}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
                    onSaved={(content) => {
                      appendAssistantMessage({ content });
                    }}
                  />
                ) : null}
                {message.promotion ? <PromotionPack promotion={message.promotion} sourceMessage={message.uiLanguage ?? message.sourceMessage} /> : null}
                {message.promotionTarget ? (
                  <PromotionConfirmCard
                    initialChannels={message.promotionChannels}
                    listing={message.promotionTarget}
                    sourceMessage={message.uiLanguage ?? message.sourceMessage}
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
            ) : workspaceLeads.length ? (
              workspaceLeads.slice(0, 20).map((lead) => (
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
                      {formatLeadStatusLabel(lead.status, lead.urgency)} · {getLeadInterestLine(lead)} · {lead.phone || "No phone"}
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
        onChange={(event) => {
          void handleMediaSelected(event.target.files);
        }}
      />
      <input
        ref={documentFileInputRef}
        className="media-file-input"
        type="file"
        accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        onChange={(event) => handleDocumentSelected(event.target.files)}
      />
      <input
        ref={whatsAppChatFileInputRef}
        className="media-file-input"
        type="file"
        accept=".txt,.zip,text/plain,application/zip"
        onChange={(event) => handleWhatsAppChatSelected(event.target.files)}
      />
      <AgentComposer
        actions={!hasStarted ? quickActions : undefined}
        attachActions={attachActions}
        className="workspace-agent-composer"
        contextAttachments={createAgentComposerContextPreviews(contextAttachments)}
        files={composerFiles.map((item) => ({
          id: item.id,
          label: item.kind === "whatsapp_chat" ? "WhatsApp chat" : "File",
          name: item.file.name,
          sizeLabel: formatAgentComposerFileSize(item.file.size)
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
        onFilesDropped={handleComposerFilesDropped}
        onFilesPasted={handleComposerFilesDropped}
        onRemoveContext={removeContextAttachment}
        onRemoveFile={removeComposerFile}
        onRemoveMedia={removeComposerMedia}
        onSubmit={handleSubmit}
        onVoice={handleVoiceInput}
        placeholder={composerPlaceholder}
        sendDisabled={isSubmitting || isListening || isTranscribing}
        topSlot={
          isFollowUpNudgeVisible ? (
            <div className="agent-followup-nudge" aria-label="Today follow-up suggestions">
              <button
                className="agent-followup-nudge-main"
                disabled={isFollowUpNudgeLoading}
                type="button"
                onClick={() => void handleFollowUpNudgeOpen()}
              >
                <Sparkles size={14} />
                <span>{isFollowUpNudgeLoading ? "Checking today’s follow-ups..." : "Today follow-ups are ready"}</span>
              </button>
              <button
                aria-label="Hide today follow-up suggestion"
                className="agent-followup-nudge-close"
                disabled={isFollowUpNudgeLoading}
                type="button"
                onClick={dismissFollowUpNudge}
              >
                <X size={13} />
              </button>
            </div>
          ) : undefined
        }
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
      {isAuthModalOpen ? (
        <div className="auth-modal-backdrop" role="presentation" onClick={() => setIsAuthModalOpen(false)}>
          <section
            aria-label="Sign in to Pislaka Agent"
            className="auth-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="auth-modal-heading">
              <span>Sign in to continue</span>
              <button type="button" onClick={() => setIsAuthModalOpen(false)}>
                Close
              </button>
            </div>
            <AuthForm onAuthStarted={prepareGuestTranscriptRestore} />
          </section>
        </div>
      ) : null}
    </>
  );
}
