"use client";

import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  MessageCircle,
  Phone,
  Search,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";
import type { LeadReplyDraft } from "@/lib/leads/reply-types";

type LeadListPanelProps = {
  leads: LeadListItem[];
  className?: string;
};

type LeadReplyDraftWithLink = LeadReplyDraft & {
  whatsapp_url: string;
};

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

function getLeadInterest(lead: LeadListItem) {
  const listing = [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ");
  const channel = lead.campaign_channel ?? lead.source_channel;

  return [listing || "Listing not set", channel ? `via ${channel}` : null].filter(Boolean).join(" · ");
}

export function LeadListPanel({ className = "", leads }: LeadListPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [localLeads, setLocalLeads] = useState(leads);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, LeadReplyDraftWithLink>>({});
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

  async function updateLeadStatus(leadId: string, nextStatus: LeadRecord["status"]) {
    setUpdatingId(leadId);
    setStatus("Updating lead...");

    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: leadId, status: nextStatus })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to update lead");
      setUpdatingId(null);
      return;
    }

    setLocalLeads((current) =>
      current.map((lead) => (lead.id === leadId ? { ...lead, status: nextStatus } : lead))
    );
    setStatus("Lead updated.");
    setUpdatingId(null);
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

  async function copyReply(text: string) {
    await navigator.clipboard.writeText(text);
    setStatus("Reply copied.");
  }

  return (
    <section className={`listing-library glass-panel ${className}`}>
      <div className="widget-header">
        <h3>
          <Users size={18} /> Lead Inbox
        </h3>
        <span className="count-pill">{filteredLeads.length}</span>
      </div>

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
            <option value="qualified">Qualified</option>
            <option value="closed">Closed</option>
            <option value="lost">Lost</option>
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
                  <span className={`lead-status ${lead.status}`}>{lead.status}</span>
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
                  View details
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
                  disabled={updatingId === lead.id}
                  onClick={() => void updateLeadStatus(lead.id, "contacted")}
                >
                  <Check size={14} /> Contacted
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
                    <a
                      className="primary-button small"
                      href={replyDrafts[lead.id].whatsapp_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} /> Open WhatsApp
                    </a>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {selectedLead ? (
        <div className="lead-detail-backdrop" role="presentation" onClick={() => setSelectedLeadId(null)}>
          <aside
            className="lead-detail-drawer"
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
                  <a
                    className="primary-button small"
                    href={replyDrafts[selectedLead.id].whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={14} /> Open WhatsApp
                  </a>
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
                disabled={updatingId === selectedLead.id}
                onClick={() => void updateLeadStatus(selectedLead.id, "contacted")}
              >
                <Check size={14} /> Mark contacted
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {status ? (
        <p className="form-status inline-status" role="status">
          <Check size={14} /> {status}
        </p>
      ) : null}
    </section>
  );
}
