"use client";

import {
  Bell,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  MessageCircle,
  Phone,
  Search,
  ThumbsDown,
  ThumbsUp,
  Upload,
  UserRound,
  Users,
  X
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatLeadStatusLabel, getLeadStatusClassName } from "@/lib/leads/display";
import type { LeadListItem, LeadRecord, TodayFollowUpLead } from "@/lib/leads/types";
import type { LeadReplyDraft } from "@/lib/leads/reply-types";

type LeadListPanelProps = {
  leads: LeadListItem[];
  className?: string;
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

function LeadDetailPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}

function formatLeadAge(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function formatLeadDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBudget(summary: ChatFollowupSummary) {
  if (summary.budget.text) {
    return summary.budget.text;
  }

  if (summary.budget.min) {
    return `PKR ${summary.budget.min.toLocaleString("en-PK")}`;
  }

  return "Not detected";
}

function getDefaultReminderLocalValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getLeadInterest(lead: LeadListItem) {
  const listing = [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ");
  const channel = lead.campaign_channel ?? lead.source_channel;

  return [listing || "Listing not set", channel ? `via ${channel}` : null].filter(Boolean).join(" · ");
}

export function LeadListPanel({ className = "", leads }: LeadListPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [localLeads, setLocalLeads] = useState(leads);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, LeadReplyDraftWithLink>>({});
  const [todayFollowUps, setTodayFollowUps] = useState<TodayFollowUpLead[]>([]);
  const [todayFollowUpsError, setTodayFollowUpsError] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [importLeadId, setImportLeadId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [zipTextCandidates, setZipTextCandidates] = useState<ZipTextCandidate[]>([]);
  const [selectedZipTextName, setSelectedZipTextName] = useState("");
  const [saveOriginalChatText, setSaveOriginalChatText] = useState(false);
  const [importResult, setImportResult] = useState<ChatFollowupSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isGlobalImportOpen, setIsGlobalImportOpen] = useState(false);
  const [selectedImportLeadId, setSelectedImportLeadId] = useState<string | null>(null);
  const [reminderLeadId, setReminderLeadId] = useState<string | null>(null);
  const [reminderAt, setReminderAt] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const channelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          localLeads
            .map((lead) => lead.campaign_channel ?? lead.source_channel)
            .filter((channel): channel is string => Boolean(channel))
        )
      ).sort(),
    [localLeads]
  );
  const filteredLeads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return localLeads.filter((lead) => {
      const channel = lead.campaign_channel ?? lead.source_channel ?? "";
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesChannel = channelFilter === "all" || channel === channelFilter;
      const searchable = [
        lead.full_name,
        lead.phone,
        lead.email,
        lead.message,
        lead.listing_title,
        lead.listing_area,
        lead.listing_city,
        lead.campaign_code,
        channel
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesChannel && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [channelFilter, localLeads, searchQuery, statusFilter]);
  const selectedLead = useMemo(
    () => localLeads.find((lead) => lead.id === selectedLeadId) ?? null,
    [localLeads, selectedLeadId]
  );

  async function refreshTodayFollowUps() {
    const response = await fetch("/api/leads/followups/today?limit=8");

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setTodayFollowUpsError(payload?.error ?? "Unable to load today's follow-ups.");
      return;
    }

    const payload = (await response.json()) as { leads?: TodayFollowUpLead[] };
    setTodayFollowUps(payload.leads ?? []);
    setTodayFollowUpsError(null);
  }

  useEffect(() => {
    void refreshTodayFollowUps();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedLeadId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId]
    );
  }

  function openSelectedLeadsInAgent() {
    if (!selectedLeadIds.length) {
      return;
    }

    router.push(`/?leads=${encodeURIComponent(selectedLeadIds.join(","))}`);
  }

  async function generateReplyDraft(leadId: string) {
    setReplyingId(leadId);
    setStatus("Drafting WhatsApp reply...");

    const response = await fetch("/api/leads/reply-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ lead_id: leadId })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to draft reply");
      setReplyingId(null);
      return;
    }

    const payload = (await response.json()) as { draft: LeadReplyDraftWithLink };
    setReplyDrafts((current) => ({ ...current, [leadId]: payload.draft }));
    setStatus("Reply draft ready.");
    setReplyingId(null);
  }

  function mergeUpdatedLead(updatedLead: LeadRecord) {
    setLocalLeads((current) =>
      current.map((lead) =>
        lead.id === updatedLead.id
          ? {
              ...lead,
              ...updatedLead
            }
          : lead
      )
    );
  }

  async function recordFollowUpActivity(
    lead: LeadListItem,
    payload: {
      activity_type:
        | "whatsapp_opened"
        | "message_sent"
        | "status_changed"
        | "followup_summary_saved"
        | "reminder_created";
      summary?: string;
      message_draft?: string;
      new_status?: LeadRecord["status"];
      urgency?: LeadRecord["urgency"];
      next_follow_up_at?: string;
      source_type?: "manual" | "whatsapp_paste" | "whatsapp_txt_upload" | "whatsapp_zip_upload";
      original_chat_saved?: boolean;
      original_chat_text?: string | null;
    }
  ) {
    setActivityId(lead.id);
    setStatus("Saving follow-up...");

    const response = await fetch("/api/leads/followup-activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        lead_id: lead.id,
        channel: "whatsapp",
        ...payload
      })
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(errorPayload?.error ?? "Unable to save follow-up");
      setActivityId(null);
      return false;
    }

    const result = (await response.json()) as { lead?: LeadRecord };
    if (result.lead) {
      mergeUpdatedLead(result.lead);
    }

    await refreshTodayFollowUps();
    setStatus("Follow-up saved.");
    setActivityId(null);
    return true;
  }

  async function openWhatsApp(lead: LeadListItem, draft: LeadReplyDraftWithLink) {
    const saved = await recordFollowUpActivity(lead, {
      activity_type: "whatsapp_opened",
      summary: "Opened WhatsApp with drafted reply.",
      message_draft: draft.reply_text,
      source_type: "manual"
    });

    if (saved) {
      window.open(draft.whatsapp_url, "_blank", "noopener,noreferrer");
      setStatus("WhatsApp opened. Mark Sent only after you send it.");
    }
  }

  async function markSent(lead: LeadListItem, draft?: LeadReplyDraftWithLink) {
    await recordFollowUpActivity(lead, {
      activity_type: "message_sent",
      summary: "Sent WhatsApp message.",
      message_draft: draft?.reply_text,
      new_status: lead.status === "new" ? "contacted" : undefined,
      source_type: "manual"
    });
  }

  async function markInterested(lead: LeadListItem) {
    await recordFollowUpActivity(lead, {
      activity_type: "status_changed",
      summary: "Customer is interested. Marked as hot lead.",
      new_status: "qualified",
      urgency: "high",
      source_type: "manual"
    });
  }

  async function markNotInterested(lead: LeadListItem) {
    await recordFollowUpActivity(lead, {
      activity_type: "status_changed",
      summary: "Customer is not interested.",
      new_status: "lost",
      source_type: "manual"
    });
  }

  function openImportPanel(leadId: string) {
    router.push(`/?lead=${leadId}&import=whatsapp`);
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!importLeadId && !isGlobalImportOpen) {
      setStatus("Choose a lead or open global Import Chat.");
      return;
    }

    if (!importText.trim() && !importFile) {
      setStatus("Paste chat text or upload a .txt file.");
      return;
    }

    setIsImporting(true);
    setStatus("Summarizing WhatsApp chat...");
    const formData = new FormData();
    if (importLeadId) {
      formData.append("lead_id", importLeadId);
    }
    formData.append("save_original_chat_text", String(saveOriginalChatText));

    if (importFile) {
      const isZip = importFile.name.toLowerCase().endsWith(".zip");
      formData.append("source_type", isZip ? "whatsapp_zip_upload" : "whatsapp_txt_upload");
      if (selectedZipTextName) {
        formData.append("selected_txt_name", selectedZipTextName);
      }
      formData.append("file", importFile);
    } else {
      formData.append("source_type", "whatsapp_paste");
      formData.append("text", importText);
    }

    const response = await fetch("/api/leads/import-whatsapp-chat", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(errorPayload?.error ?? "Unable to summarize WhatsApp chat");
      setIsImporting(false);
      return;
    }

    const payload = (await response.json()) as ChatFollowupSummary & {
      needs_txt_selection?: boolean;
      txt_candidates?: ZipTextCandidate[];
    };

    if (payload.needs_txt_selection) {
      setZipTextCandidates(payload.txt_candidates ?? []);
      setStatus("Choose which .txt chat file to summarize.");
      setIsImporting(false);
      return;
    }

    setZipTextCandidates([]);
    setImportResult(payload);
    setSelectedImportLeadId(payload.matched_lead?.id ?? importLeadId);
    setStatus("Chat summary ready. Review before saving.");
    setIsImporting(false);
  }

  async function saveImportedSummary(lead: LeadListItem, summary: ChatFollowupSummary) {
    const saved = await recordFollowUpActivity(lead, {
      activity_type: "followup_summary_saved",
      summary: summary.chat_summary,
      message_draft: summary.reply_draft.reply_text,
      source_type: summary.source_type,
      original_chat_saved: summary.save_original_chat_text,
      original_chat_text: summary.original_chat_text
    });

    if (saved) {
      setImportResult(null);
      setImportLeadId(null);
    }
  }

  async function saveReminder(lead: LeadListItem) {
    if (!reminderAt) {
      setStatus("Choose a follow-up reminder time.");
      return;
    }

    const isoReminder = new Date(reminderAt).toISOString();
    const saved = await recordFollowUpActivity(lead, {
      activity_type: "reminder_created",
      summary: reminderNote.trim() || "Follow-up reminder created.",
      next_follow_up_at: isoReminder,
      source_type: "manual"
    });

    if (saved) {
      setReminderLeadId(null);
      setReminderAt("");
      setReminderNote("");
    }
  }

  function getImportedLeadTarget(summary: ChatFollowupSummary | null) {
    if (!summary) {
      return null;
    }

    return (
      localLeads.find((lead) => lead.id === selectedImportLeadId) ??
      (summary.matched_lead ? localLeads.find((lead) => lead.id === summary.matched_lead?.id) ?? summary.matched_lead : null)
    );
  }

  async function copyReply(text: string) {
    await navigator.clipboard.writeText(text);
    setStatus("Reply copied.");
  }

  function renderImportPanel(options: { lead?: LeadListItem; compact?: boolean }) {
    const importTarget = options.lead ?? getImportedLeadTarget(importResult);
    const hasAmbiguousCandidates = Boolean(importResult?.candidate_leads.length);

    return (
      <div className={options.compact ? "lead-import-card" : "lead-import-card standalone"}>
        <div className="lead-reply-header">
          <strong>Import WhatsApp chat</strong>
          <button
            className="icon-button compact"
            type="button"
            aria-label="Close WhatsApp chat import"
            onClick={() => {
              setImportLeadId(null);
              setIsGlobalImportOpen(false);
              setImportResult(null);
              setZipTextCandidates([]);
            }}
          >
            <X size={15} />
          </button>
        </div>
        <form className="lead-import-form" onSubmit={(event) => void handleImportSubmit(event)}>
          <label>
            <span>Paste chat text</span>
            <textarea
              placeholder="Ahmed: Is the DHA Phase 5 villa still available?"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
            />
          </label>
          <label>
            <span>Or upload .txt / .zip</span>
            <input
              accept=".txt,.zip,text/plain,application/zip"
              type="file"
              onChange={(event) => {
                setImportFile(event.target.files?.[0] ?? null);
                setZipTextCandidates([]);
                setSelectedZipTextName("");
              }}
            />
          </label>
          {zipTextCandidates.length ? (
            <div className="zip-candidate-list" role="group" aria-label="Choose chat text file">
              <span>Choose chat text</span>
              {zipTextCandidates.map((candidate) => (
                <button
                  className={selectedZipTextName === candidate.name ? "primary-button small" : "outline-button small"}
                  key={candidate.name}
                  type="button"
                  onClick={() => setSelectedZipTextName(candidate.name)}
                >
                  <FileText size={14} /> {candidate.name}
                </button>
              ))}
            </div>
          ) : null}
          <label className="lead-import-checkbox">
            <input
              checked={saveOriginalChatText}
              type="checkbox"
              onChange={(event) => setSaveOriginalChatText(event.target.checked)}
            />
            <span>Save original chat text</span>
          </label>
          <div className="card-actions">
            <button className="primary-button small" type="submit" disabled={isImporting}>
              <FileText size={14} /> {isImporting ? "Summarizing..." : "Generate summary"}
            </button>
          </div>
        </form>
        {importResult ? (
          <div className="chat-summary-card">
            {hasAmbiguousCandidates ? (
              <div className="lead-candidate-list" role="group" aria-label="Choose matching lead">
                <span>Choose matching lead</span>
                {importResult.candidate_leads.map((candidate) => (
                  <button
                    className={selectedImportLeadId === candidate.id ? "primary-button small" : "outline-button small"}
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedImportLeadId(candidate.id)}
                  >
                    <UserRound size={14} /> {candidate.full_name || candidate.phone || "Unnamed buyer"}
                  </button>
                ))}
              </div>
            ) : null}
            {importResult.resolution_status === "no_match" ? (
              <p className="agent-draft-status">No matching lead found. P0 can preview this chat, but saving needs an existing selected lead.</p>
            ) : null}
            <div className="chat-summary-grid">
              <div>
                <span>Summary</span>
                <strong>{importResult.chat_summary}</strong>
              </div>
              <div>
                <span>Status suggestion</span>
                <strong>
                  {formatLeadStatusLabel(importResult.status_suggestion, importResult.urgency_suggestion)}
                </strong>
              </div>
              <div>
                <span>Budget</span>
                <strong>{formatBudget(importResult)}</strong>
              </div>
              <div>
                <span>Area / listing</span>
                <strong>{importResult.interested_listing_text || importResult.interested_area || "Not detected"}</strong>
              </div>
            </div>
            {importResult.customer_needs.length ? <p>{importResult.customer_needs.join(", ")}</p> : null}
            {importResult.viewing_intent ? <p>{importResult.viewing_intent}</p> : null}
            <blockquote>{importResult.reply_draft.reply_text}</blockquote>
            <div className="card-actions">
              <button
                className="primary-button small"
                type="button"
                disabled={activityId === importTarget?.id || !importTarget}
                onClick={() => importTarget && void saveImportedSummary(importTarget, importResult)}
              >
                <Check size={14} /> Save follow-up
              </button>
              <button
                className="outline-button small"
                type="button"
                disabled={activityId === importTarget?.id || !importTarget}
                onClick={() => importTarget && void markInterested(importTarget)}
              >
                <ThumbsUp size={14} /> Mark hot lead
              </button>
              <button
                className="outline-button small"
                type="button"
                disabled={activityId === importTarget?.id || !importTarget}
                onClick={() => importTarget && void markNotInterested(importTarget)}
              >
                <ThumbsDown size={14} /> Mark not interested
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className={`listing-library glass-panel ${className}`}>
      <div className="widget-header">
        <h3>
          <Users size={18} /> Lead Inbox
        </h3>
        <div className="widget-header-actions">
          <span className="count-pill">{filteredLeads.length}</span>
        </div>
      </div>

      <section className="today-followups-panel" aria-labelledby="today-followups-title">
        <div className="today-followups-header">
          <div>
            <span>Follow-up Lite</span>
            <h4 id="today-followups-title">Today&apos;s Follow-ups</h4>
          </div>
          <button className="outline-button small" type="button" onClick={() => void refreshTodayFollowUps()}>
            <Clock size={14} /> Refresh
          </button>
        </div>
        {todayFollowUps.length ? (
          <div className="today-followups-list">
            {todayFollowUps.map((lead) => (
              <article className="today-followup-card" key={lead.id}>
                <div>
                  <strong>{lead.full_name || lead.phone || "Unnamed buyer"}</strong>
                  <p>{lead.recommended_reason}</p>
                  <small>
                    {lead.phone || "No phone"} · {formatLeadStatusLabel(lead.status, lead.urgency)} · Last contact {formatLeadDate(lead.last_contacted_at)}
                  </small>
                </div>
                <div className="today-followup-actions">
                  <button
                    className="outline-button small"
                    type="button"
                    disabled={replyingId === lead.id}
                    onClick={() => void generateReplyDraft(lead.id)}
                  >
                    <MessageCircle size={14} /> AI Reply
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    disabled={activityId === lead.id}
                    onClick={() => void markSent(lead, replyDrafts[lead.id])}
                  >
                    <Check size={14} /> Sent
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    disabled={activityId === lead.id}
                    onClick={() => void markInterested(lead)}
                  >
                    <ThumbsUp size={14} /> Interested
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    disabled={activityId === lead.id}
                    onClick={() => void markNotInterested(lead)}
                  >
                    <ThumbsDown size={14} /> Not Interested
                  </button>
                  <button className="outline-button small" type="button" onClick={() => openImportPanel(lead.id)}>
                    <FileText size={14} /> Import Chat
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    onClick={() => {
                      setReminderLeadId(lead.id);
                      setReminderAt(getDefaultReminderLocalValue());
                      setReminderNote("");
                    }}
                  >
                    <Bell size={14} /> Reminder
                  </button>
                </div>
                {reminderLeadId === lead.id ? (
                  <div className="lead-reminder-card compact">
                    <div className="lead-reply-header">
                      <strong>Follow-up reminder</strong>
                      <button
                        className="icon-button compact"
                        type="button"
                        aria-label="Close reminder"
                        onClick={() => setReminderLeadId(null)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="lead-reminder-form">
                      <label>
                        <span>Reminder time</span>
                        <input
                          type="datetime-local"
                          value={reminderAt}
                          onChange={(event) => setReminderAt(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Note</span>
                        <input
                          placeholder="Follow up on WhatsApp"
                          value={reminderNote}
                          onChange={(event) => setReminderNote(event.target.value)}
                        />
                      </label>
                      <div className="card-actions">
                        <button
                          className="primary-button small"
                          type="button"
                          disabled={activityId === lead.id}
                          onClick={() => void saveReminder(lead)}
                        >
                          <Bell size={14} /> Save reminder
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state compact">
            {todayFollowUpsError ?? "No due follow-ups right now."}
          </p>
        )}
      </section>

      <div className="lead-filter-bar">
        <label>
          <Search size={14} />
          <input
            placeholder="Search buyer, phone, listing..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <label>
          <Filter size={14} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Interested / Hot</option>
            <option value="closed">Closed</option>
            <option value="lost">Not interested</option>
          </select>
        </label>
        <label>
          <Filter size={14} />
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
            <option value="all">All channels</option>
            {channelOptions.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedLeadIds.length ? (
        <div className="lead-bulk-bar" role="status">
          <strong>{selectedLeadIds.length} selected</strong>
          <button className="outline-button small" type="button" onClick={openSelectedLeadsInAgent}>
            <MessageCircle size={14} /> Ask Agent
          </button>
          <button className="outline-button small" type="button" onClick={openSelectedLeadsInAgent}>
            Draft follow-ups
          </button>
          <button className="outline-button small" type="button" onClick={openSelectedLeadsInAgent}>
            Change status
          </button>
          <button className="outline-button small" type="button" onClick={openSelectedLeadsInAgent}>
            Schedule follow-up
          </button>
          <button className="icon-button compact" type="button" aria-label="Clear selected leads" onClick={() => setSelectedLeadIds([])}>
            <X size={15} />
          </button>
        </div>
      ) : null}

      {localLeads.length === 0 ? (
        <p className="empty-state">Buyer inquiries from public campaign pages will appear here.</p>
      ) : filteredLeads.length === 0 ? (
        <p className="empty-state">No leads match these filters.</p>
      ) : (
        <div className="lead-list-stack">
          {filteredLeads.map((lead) => (
            <article className={`lead-list-row ${lead.urgency === "high" ? "urgent-lead" : ""}`} key={lead.id}>
              <label className="lead-select-box" aria-label={`Select ${lead.full_name || lead.phone || "lead"}`}>
                <input
                  checked={selectedLeadIds.includes(lead.id)}
                  type="checkbox"
                  onChange={() => toggleLeadSelection(lead.id)}
                />
              </label>
              <div className="lead-list-main">
                <div className="lead-list-header">
                  <strong>
                    <UserRound size={16} /> {lead.full_name || "Unnamed buyer"}
                  </strong>
                  <span className={getLeadStatusClassName(lead.status, lead.urgency)}>{formatLeadStatusLabel(lead.status, lead.urgency)}</span>
                </div>
                <p>{getLeadInterest(lead)}</p>
                {lead.ai_summary ? (
                  <blockquote className="lead-summary">{lead.ai_summary}</blockquote>
                ) : lead.message ? (
                  <blockquote>{lead.message}</blockquote>
                ) : null}
                <div className="lead-list-meta">
                  <span>
                    <Phone size={14} /> {lead.phone || "No phone"}
                  </span>
                  <span>
                    <Clock size={14} /> {formatLeadAge(lead.created_at)}
                  </span>
                  {lead.email ? <span>{lead.email}</span> : null}
                  {lead.campaign_code ? <span>{lead.campaign_code}</span> : null}
                </div>
              </div>
              <div className="lead-list-actions">
                <button
                  className="outline-button small"
                  type="button"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  Details
                </button>
                <button
                  className="outline-button small"
                  type="button"
                  onClick={() => router.push(`/?lead=${lead.id}`)}
                >
                  <MessageCircle size={14} /> Ask Agent
                </button>
                <button
                  className="outline-button small"
                  type="button"
                  disabled={replyingId === lead.id}
                  onClick={() => void generateReplyDraft(lead.id)}
                >
                  <MessageCircle size={14} /> {replyingId === lead.id ? "Drafting..." : "AI Reply"}
                </button>
                <button
                  className="outline-button small"
                  type="button"
                  disabled={activityId === lead.id}
                  onClick={() => void markSent(lead, replyDrafts[lead.id])}
                >
                  <Check size={14} /> Sent
                </button>
                <button
                  className="outline-button small"
                  type="button"
                  disabled={activityId === lead.id}
                  onClick={() => void markInterested(lead)}
                >
                  <ThumbsUp size={14} /> Interested
                </button>
                <button
                  className="outline-button small"
                  type="button"
                  disabled={activityId === lead.id}
                  onClick={() => void markNotInterested(lead)}
                >
                  <ThumbsDown size={14} /> Not Interested
                </button>
                <button className="outline-button small" type="button" onClick={() => openImportPanel(lead.id)}>
                  <Upload size={14} /> Import Chat
                </button>
                <button
                  className="outline-button small"
                  type="button"
                  onClick={() => {
                    setReminderLeadId(lead.id);
                    setReminderAt(getDefaultReminderLocalValue());
                    setReminderNote("");
                  }}
                >
                  <Bell size={14} /> Reminder
                </button>
              </div>
              {replyDrafts[lead.id] ? (
                <div className="lead-reply-card">
                  <div className="lead-reply-header">
                    <strong>WhatsApp reply draft</strong>
                    <span>{replyDrafts[lead.id].tone}</span>
                  </div>
                  <p>{replyDrafts[lead.id].reply_text}</p>
                  <small>{replyDrafts[lead.id].next_step}</small>
                  <div className="card-actions">
                    <button
                      className="outline-button small"
                      type="button"
                      onClick={() => void copyReply(replyDrafts[lead.id].reply_text)}
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <button
                      className="primary-button small"
                      type="button"
                      disabled={activityId === lead.id}
                      onClick={() => void openWhatsApp(lead, replyDrafts[lead.id])}
                    >
                      <ExternalLink size={14} /> Open WhatsApp
                    </button>
                  </div>
                </div>
              ) : null}
              {reminderLeadId === lead.id ? (
                <div className="lead-reminder-card">
                  <div className="lead-reply-header">
                    <strong>Follow-up reminder</strong>
                    <button
                      className="icon-button compact"
                      type="button"
                      aria-label="Close reminder"
                      onClick={() => setReminderLeadId(null)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="lead-reminder-form">
                    <label>
                      <span>Reminder time</span>
                      <input
                        type="datetime-local"
                        value={reminderAt}
                        onChange={(event) => setReminderAt(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Note</span>
                      <input
                        placeholder="Follow up on WhatsApp"
                        value={reminderNote}
                        onChange={(event) => setReminderNote(event.target.value)}
                      />
                    </label>
                    <div className="card-actions">
                      <button
                        className="primary-button small"
                        type="button"
                        disabled={activityId === lead.id}
                        onClick={() => void saveReminder(lead)}
                      >
                        <Bell size={14} /> Save reminder
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {selectedLead ? (
        <LeadDetailPortal>
        <div className="schedule-detail-backdrop" role="presentation" onClick={() => setSelectedLeadId(null)}>
          <aside
            className="schedule-detail-modal"
            aria-label="Lead details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lead-detail-header">
              <div>
                <span>Lead details</span>
                <h3>{selectedLead.full_name || "Unnamed buyer"}</h3>
              </div>
              <button
                className="icon-button compact"
                type="button"
                aria-label="Close lead details"
                onClick={() => setSelectedLeadId(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="lead-detail-section">
              <strong>Summary</strong>
              <p>{selectedLead.ai_summary || selectedLead.message || "No summary yet."}</p>
            </div>

            <div className="lead-detail-grid">
              <div>
                <span>Phone</span>
                <strong>{selectedLead.phone || "Not provided"}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{selectedLead.email || "Not provided"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{selectedLead.status}</strong>
              </div>
              <div>
                <span>Channel</span>
                <strong>{selectedLead.campaign_channel ?? selectedLead.source_channel ?? "Unknown"}</strong>
              </div>
              <div>
                <span>Listing</span>
                <strong>{selectedLead.listing_title || "Listing not set"}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>
                  {[selectedLead.listing_area, selectedLead.listing_city].filter(Boolean).join(", ") ||
                    "Location not set"}
                </strong>
              </div>
            </div>

            <div className="lead-detail-section">
              <strong>Original message</strong>
              <pre>{selectedLead.message || "No message provided."}</pre>
            </div>

            {replyDrafts[selectedLead.id] ? (
              <div className="lead-detail-section">
                <strong>AI WhatsApp draft</strong>
                <p>{replyDrafts[selectedLead.id].reply_text}</p>
                <div className="card-actions">
                  <button
                    className="outline-button small"
                    type="button"
                    onClick={() => void copyReply(replyDrafts[selectedLead.id].reply_text)}
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <button
                    className="primary-button small"
                    type="button"
                    disabled={activityId === selectedLead.id}
                    onClick={() => void openWhatsApp(selectedLead, replyDrafts[selectedLead.id])}
                  >
                    <ExternalLink size={14} /> Open WhatsApp
                  </button>
                </div>
              </div>
            ) : null}

            <div className="lead-detail-actions">
              <button
                className="primary-button small"
                type="button"
                disabled={replyingId === selectedLead.id}
                onClick={() => void generateReplyDraft(selectedLead.id)}
              >
                <MessageCircle size={14} /> {replyingId === selectedLead.id ? "Drafting..." : "Draft AI reply"}
              </button>
              <button
                className="outline-button small"
                type="button"
                disabled={activityId === selectedLead.id}
                onClick={() => void markSent(selectedLead, replyDrafts[selectedLead.id])}
              >
                <Check size={14} /> Sent
              </button>
              <button
                className="outline-button small"
                type="button"
                disabled={activityId === selectedLead.id}
                onClick={() => void markInterested(selectedLead)}
              >
                <ThumbsUp size={14} /> Interested
              </button>
              <button
                className="outline-button small"
                type="button"
                disabled={activityId === selectedLead.id}
                onClick={() => void markNotInterested(selectedLead)}
              >
                <ThumbsDown size={14} /> Not Interested
              </button>
            </div>
          </aside>
        </div>
        </LeadDetailPortal>
      ) : null}

      {status ? (
        <p className="form-status inline-status" role="status">
          <Check size={14} /> {status}
        </p>
      ) : null}
    </section>
  );
}
