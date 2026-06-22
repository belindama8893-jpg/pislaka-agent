"use client";

import { Clock, ExternalLink, Filter, MessageCircle, Phone, Search, Trash2, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatLeadStatusLabel, getLeadStatusClassName } from "@/lib/leads/display";
import type { LeadListItem } from "@/lib/leads/types";

type LeadListPanelProps = {
  leads: LeadListItem[];
  className?: string;
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

function formatBudget(lead: LeadListItem) {
  if (lead.budget_min && lead.budget_max) {
    return `PKR ${lead.budget_min.toLocaleString("en-PK")} - ${lead.budget_max.toLocaleString("en-PK")}`;
  }

  if (lead.budget_min) {
    return `From PKR ${lead.budget_min.toLocaleString("en-PK")}`;
  }

  if (lead.budget_max) {
    return `Up to PKR ${lead.budget_max.toLocaleString("en-PK")}`;
  }

  return "Budget not set";
}

function getLeadInterest(lead: LeadListItem) {
  const listing = [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ");
  const area = lead.interested_area;

  return listing || area || "Interest not captured";
}

function getLeadSource(lead: LeadListItem) {
  return lead.campaign_channel ?? lead.source_channel ?? "Unknown source";
}

function getLeadRowClassName(lead: LeadListItem) {
  return [
    "lead-list-row",
    lead.status,
    lead.status === "qualified" && lead.urgency === "high" ? "hot" : null
  ]
    .filter(Boolean)
    .join(" ");
}

export function LeadListPanel({ className = "", leads }: LeadListPanelProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const channelOptions = useMemo(
    () =>
      Array.from(new Set(leads.map(getLeadSource).filter((channel) => channel !== "Unknown source"))).sort(),
    [leads]
  );
  const filteredLeads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return leads.filter((lead) => {
      const channel = getLeadSource(lead);
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesChannel = channelFilter === "all" || channel === channelFilter;
      const searchable = [
        lead.full_name,
        lead.phone,
        lead.email,
        lead.message,
        lead.ai_summary,
        lead.listing_title,
        lead.listing_area,
        lead.listing_city,
        lead.interested_area,
        lead.campaign_code,
        channel
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesChannel && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [channelFilter, leads, searchQuery, statusFilter]);

  async function deleteLead(lead: LeadListItem) {
    const label = lead.full_name || lead.phone || "this lead";
    if (!window.confirm(`Delete ${label}? This will remove the lead and its follow-up history.`)) {
      return;
    }

    setDeletingId(lead.id);
    setStatus("Deleting lead...");
    const response = await fetch("/api/leads", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: lead.id })
    });

    setDeletingId(null);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to delete lead");
      return;
    }

    setStatus("Lead deleted.");
    router.refresh();
  }

  return (
    <section className={`listing-library glass-panel ${className}`}>
      <div className="widget-header">
        <h3>
          <Users size={18} /> Lead Directory
        </h3>
        <div className="widget-header-actions">
          <span className="count-pill">{filteredLeads.length}</span>
        </div>
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

      {leads.length === 0 ? (
        <p className="empty-state">Buyer inquiries from public campaign pages will appear here.</p>
      ) : filteredLeads.length === 0 ? (
        <p className="empty-state">No leads match these filters.</p>
      ) : (
        <div className="lead-list-stack">
          {filteredLeads.map((lead) => (
            <article className={getLeadRowClassName(lead)} key={lead.id}>
              <div className="lead-list-main">
                <div className="lead-list-header">
                  <div className="lead-list-title">
                    <strong>
                      <UserRound size={16} /> {lead.full_name || lead.phone || "Unnamed buyer"}
                    </strong>
                    <span className={getLeadStatusClassName(lead.status, lead.urgency)}>
                      {formatLeadStatusLabel(lead.status, lead.urgency)}
                    </span>
                  </div>
                </div>
                <p>{getLeadInterest(lead)}</p>
                <div className="lead-list-meta">
                  <span>
                    <Phone size={14} /> {lead.phone || "No phone"}
                  </span>
                  <span>{getLeadSource(lead)}</span>
                  <span>{formatBudget(lead)}</span>
                  <span>
                    <Clock size={14} /> {formatLeadAge(lead.created_at)}
                  </span>
                  <span>Last contact {formatLeadDate(lead.last_contacted_at)}</span>
                  <span>Next follow-up {formatLeadDate(lead.next_follow_up_at)}</span>
                </div>
              </div>
              <div className="lead-list-actions">
                <Link className="outline-button small" href={`/leads/${lead.id}`}>
                  <ExternalLink size={14} /> Details
                </Link>
                <Link className="outline-button small" href={`/?lead=${lead.id}`}>
                  <MessageCircle size={14} /> Ask Agent
                </Link>
                <button
                  className="outline-button small danger-button"
                  disabled={deletingId === lead.id}
                  type="button"
                  onClick={() => void deleteLead(lead)}
                >
                  <Trash2 size={14} /> {deletingId === lead.id ? "Deleting" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {status ? <p className="form-status inline-status">{status}</p> : null}
    </section>
  );
}
