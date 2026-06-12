import { ArrowLeft, Clock, MessageCircle } from "lucide-react";
import Link from "next/link";
import { LeadFollowUpRecordButton } from "@/components/leads/LeadFollowUpRecordButton";
import { LeadProfileEditor } from "@/components/leads/LeadProfileEditor";
import { LeadStatusEditor } from "@/components/leads/LeadStatusEditor";
import type { FollowUpActivityRecord, LeadListItem } from "@/lib/leads/types";

type LeadProfilePageProps = {
  activities: FollowUpActivityRecord[];
  lead: LeadListItem;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

  return "Budget not captured";
}

function getLeadName(lead: LeadListItem) {
  return lead.full_name || lead.phone || "Unnamed buyer";
}

function getListingContext(lead: LeadListItem) {
  return [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ") || "No primary listing";
}

function getRecentContactDate(lead: LeadListItem, activities: FollowUpActivityRecord[]) {
  return lead.last_contacted_at ?? activities[0]?.occurred_at ?? null;
}

function getActivityTitle(activity: FollowUpActivityRecord) {
  const labels: Record<FollowUpActivityRecord["activity_type"], string> = {
    chat_imported: "Chat imported",
    followup_summary_saved: "Follow-up summary",
    message_sent: "Message sent",
    note_added: "Note added",
    reminder_created: "Reminder created",
    reply_drafted: "Reply drafted",
    status_changed: "Status changed",
    viewing_scheduled: "Viewing scheduled",
    whatsapp_opened: "WhatsApp opened"
  };

  return labels[activity.activity_type];
}

function getActivityDetail(activity: FollowUpActivityRecord) {
  if (activity.summary) {
    return activity.summary;
  }

  if (activity.new_status) {
    return `Status changed to ${activity.new_status}.`;
  }

  if (activity.next_follow_up_at) {
    return `Follow up at ${formatDateTime(activity.next_follow_up_at)}.`;
  }

  return "No note saved for this activity.";
}

export function LeadProfilePage({ activities, lead }: LeadProfilePageProps) {
  const recentContactDate = getRecentContactDate(lead, activities);

  return (
    <article className="lead-profile-page">
      <div className="lead-profile-back">
        <Link className="outline-button small" href="/leads">
          <ArrowLeft size={14} /> Leads
        </Link>
      </div>

      <header className="lead-profile-titlebar">
        <div className="lead-profile-title-stack">
          <div className="lead-profile-title-main">
            <h2>{getLeadName(lead)}</h2>
            <LeadStatusEditor leadId={lead.id} status={lead.status} urgency={lead.urgency} />
            <Link className="primary-button small" href={`/?lead=${lead.id}`}>
              <MessageCircle size={14} /> Ask Agent
            </Link>
          </div>
        </div>
      </header>

      <aside className="lead-profile-sidebar" aria-label="Customer details">
        <LeadProfileEditor lead={lead} />
      </aside>

      <section className="lead-profile-grid" aria-label="Customer profile summary">
        <div className="lead-profile-main">
          <section className="lead-profile-section lead-customer-profile-card" aria-labelledby="lead-profile-title">
            <h3 className="sr-only" id="lead-profile-title">Customer profile</h3>
            <div className="lead-profile-section-header compact">
              <h3>Agent summary</h3>
              <span>Derived from inquiry and follow-up history</span>
            </div>
            <p className="lead-profile-summary">
              {lead.ai_summary || lead.message || "No profile summary has been captured yet."}
            </p>
            <div className="lead-profile-time-row">
              <span>First inquiry {formatDateTime(lead.created_at)}</span>
              <span>Recent contact {formatDateTime(recentContactDate)}</span>
            </div>
            <div className="lead-snapshot-grid">
              <div>
                <span>Budget signal</span>
                <strong>{formatBudget(lead)}</strong>
              </div>
              <div>
                <span>Area preference</span>
                <strong>{lead.interested_area || lead.listing_area || "Not captured"}</strong>
              </div>
              <div>
                <span>Primary listing</span>
                <strong>{getListingContext(lead)}</strong>
              </div>
            </div>
            <div className="lead-profile-note-grid">
              <div>
                <strong>Original inquiry</strong>
                <p>{lead.message || "No original inquiry saved."}</p>
              </div>
              <div>
                <strong>Latest insight</strong>
                <p>{lead.last_note || activities[0]?.summary || "No recent insight saved yet."}</p>
              </div>
            </div>
          </section>

          <section className="lead-profile-section" aria-labelledby="lead-timeline-title">
            <div className="lead-profile-section-header">
              <h3 id="lead-timeline-title">
                <Clock size={17} /> Follow-up timeline
              </h3>
              <div className="lead-profile-section-actions">
                <span>{activities.length}</span>
                <LeadFollowUpRecordButton leadId={lead.id} />
              </div>
            </div>
            {activities.length ? (
              <ol className="lead-timeline">
                {activities.map((activity) => (
                  <li key={activity.id}>
                    <div className="lead-timeline-marker" aria-hidden="true" />
                    <div>
                      <time dateTime={activity.occurred_at}>{formatDateTime(activity.occurred_at)}</time>
                      <h4>{getActivityTitle(activity)}</h4>
                      <p>{getActivityDetail(activity)}</p>
                      <small>
                        {activity.channel} · {activity.source_type}
                        {activity.new_status ? ` · ${activity.old_status ?? "unknown"} to ${activity.new_status}` : ""}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state compact">No follow-up history yet.</p>
            )}
          </section>
        </div>
      </section>
    </article>
  );
}
