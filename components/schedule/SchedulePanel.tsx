"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  MapPin,
  Search,
  UserRound,
  XCircle
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrokerEventRecord } from "@/lib/events/types";
import {
  formatBrokerDateTime,
  fromBrokerDatetimeLocal,
  getBrokerDateKey,
  getResolvedTimeZone,
  toBrokerDatetimeLocal
} from "@/lib/events/time";

type SchedulePanelProps = {
  events: BrokerEventRecord[];
  className?: string;
  migrationRequired?: boolean;
};

type EventEditState = {
  event_category: BrokerEventRecord["event_category"];
  event_type: BrokerEventRecord["event_type"];
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  reminder_at: string;
  recurrence_rule: string;
  lead_name: string;
  listing_reference: string;
  location_text: string;
  status: BrokerEventRecord["status"];
};

const eventTypeOptions: Array<{ value: BrokerEventRecord["event_type"] | "all"; label: string }> = [
  { value: "all", label: "All types" },
  { value: "viewing", label: "Viewing" },
  { value: "follow_up", label: "Follow-up" },
  { value: "contract_signing", label: "Contract signing" },
  { value: "handover", label: "Handover" },
  { value: "offer_deadline", label: "Offer deadline" },
  { value: "document_expiry", label: "Document expiry" },
  { value: "weekly_review", label: "Weekly review" },
  { value: "monthly_client_review", label: "Monthly client review" },
  { value: "custom", label: "Custom" }
];

function getEventTime(event: Pick<BrokerEventRecord, "start_at" | "reminder_at" | "created_at">) {
  return event.start_at ?? event.reminder_at ?? event.created_at;
}

function formatEventTime(value: string | null, timeZone?: string | null) {
  if (!value) {
    return "Time not set";
  }

  return formatBrokerDateTime(value, timeZone);
}

function formatShortTime(value: string | null, timeZone?: string | null) {
  if (!value) {
    return "No time";
  }

  return formatBrokerDateTime(value, timeZone, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getEditState(event: BrokerEventRecord, timeZone?: string | null): EventEditState {
  return {
    event_category: event.event_category,
    event_type: event.event_type,
    title: event.title,
    description: event.description ?? "",
    start_at: toBrokerDatetimeLocal(event.start_at, timeZone),
    end_at: toBrokerDatetimeLocal(event.end_at, timeZone),
    reminder_at: toBrokerDatetimeLocal(event.reminder_at, timeZone),
    recurrence_rule: event.recurrence_rule ?? "",
    lead_name: event.lead_name ?? "",
    listing_reference: event.listing_reference ?? "",
    location_text: event.location_text ?? "",
    status: event.status
  };
}

function isInRange(event: BrokerEventRecord, rangeFilter: string, timeZone?: string | null) {
  if (rangeFilter === "all") {
    return true;
  }

  const eventTime = getEventTime(event);
  const eventDate = new Date(eventTime);
  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  const now = new Date();
  if (rangeFilter === "today") {
    return getBrokerDateKey(eventTime, timeZone) === getBrokerDateKey(now, timeZone);
  }

  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  return eventDate >= now && eventDate <= weekEnd;
}

function eventSearchText(event: BrokerEventRecord) {
  return [
    event.title,
    event.description,
    event.lead_name,
    event.listing_reference,
    event.location_text,
    event.event_category,
    event.event_type,
    event.status
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function SchedulePanel({ className = "", events, migrationRequired = false }: SchedulePanelProps) {
  const router = useRouter();
  const [userTimeZone, setUserTimeZone] = useState(() => getResolvedTimeZone());
  const [localEvents, setLocalEvents] = useState(events);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EventEditState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState("week");
  const [statusFilter, setStatusFilter] = useState<BrokerEventRecord["status"] | "all">("scheduled");
  const [typeFilter, setTypeFilter] = useState<BrokerEventRecord["event_type"] | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setUserTimeZone(getResolvedTimeZone());
  }, []);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return localEvents
      .filter((event) => statusFilter === "all" || event.status === statusFilter)
      .filter((event) => typeFilter === "all" || event.event_type === typeFilter)
      .filter((event) => isInRange(event, rangeFilter, userTimeZone))
      .filter((event) => !normalizedQuery || eventSearchText(event).includes(normalizedQuery))
      .sort((left, right) => new Date(getEventTime(left)).getTime() - new Date(getEventTime(right)).getTime());
  }, [localEvents, rangeFilter, searchQuery, statusFilter, typeFilter, userTimeZone]);

  const todayCount = useMemo(
    () => localEvents.filter((event) => event.status === "scheduled" && isInRange(event, "today", userTimeZone)).length,
    [localEvents, userTimeZone]
  );
  const upcomingCount = useMemo(
    () => localEvents.filter((event) => event.status === "scheduled" && isInRange(event, "week", userTimeZone)).length,
    [localEvents, userTimeZone]
  );
  const overdueCount = useMemo(() => {
    const now = Date.now();
    return localEvents.filter((event) => {
      const time = new Date(getEventTime(event)).getTime();
      return event.status === "scheduled" && Number.isFinite(time) && time < now;
    }).length;
  }, [localEvents]);

  function startEditing(event: BrokerEventRecord) {
    setEditingId(event.id);
    setEditState(getEditState(event, userTimeZone));
    setStatus(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditState(null);
    setStatus(null);
  }

  async function patchEvent(
    eventId: string,
    changes: Partial<EventEditState> & { status?: BrokerEventRecord["status"] },
    pendingMessage: string
  ) {
    setUpdatingId(eventId);
    setStatus(pendingMessage);

    const response = await fetch("/api/events", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: eventId, ...changes })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to update schedule item");
      setUpdatingId(null);
      return;
    }

    const payload = (await response.json()) as { event: BrokerEventRecord };
    setLocalEvents((current) => current.map((event) => (event.id === eventId ? payload.event : event)));
    setStatus("Schedule updated.");
    setUpdatingId(null);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, eventId: string) {
    event.preventDefault();
    if (!editState) {
      return;
    }

    await patchEvent(
      eventId,
      {
        event_category: editState.event_category,
        event_type: editState.event_type,
        title: editState.title.trim() || "Broker event",
        description: editState.description.trim() || undefined,
        start_at: fromBrokerDatetimeLocal(editState.start_at, userTimeZone),
        end_at: fromBrokerDatetimeLocal(editState.end_at, userTimeZone),
        reminder_at: fromBrokerDatetimeLocal(editState.reminder_at, userTimeZone),
        recurrence_rule: editState.recurrence_rule.trim() || undefined,
        lead_name: editState.lead_name.trim() || undefined,
        listing_reference: editState.listing_reference.trim() || undefined,
        location_text: editState.location_text.trim() || undefined,
        status: editState.status
      },
      "Saving schedule item..."
    );
    cancelEditing();
  }

  return (
    <section className={`listing-library glass-panel schedule-workspace ${className}`}>
      <div className="widget-header">
        <h3>
          <CalendarClock size={18} /> Schedule
        </h3>
        <span className="count-pill">{filteredEvents.length}</span>
      </div>

      <div className="schedule-metrics" aria-label="Schedule summary">
        <div>
          <strong>{todayCount}</strong>
          <span>Today</span>
        </div>
        <div>
          <strong>{upcomingCount}</strong>
          <span>Next 7 days</span>
        </div>
        <div>
          <strong>{overdueCount}</strong>
          <span>Needs attention</span>
        </div>
      </div>

      <div className="lead-filter-bar schedule-filter-bar">
        <label>
          <Search size={14} />
          <input
            placeholder="Search client, listing, location..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <label>
          <Filter size={14} />
          <select value={rangeFilter} onChange={(event) => setRangeFilter(event.target.value)}>
            <option value="today">Today</option>
            <option value="week">Next 7 days</option>
            <option value="all">All dates</option>
          </select>
        </label>
        <label>
          <Filter size={14} />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as BrokerEventRecord["status"] | "all")}
          >
            <option value="scheduled">Scheduled</option>
            <option value="all">All status</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <label>
          <Filter size={14} />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as BrokerEventRecord["event_type"] | "all")}
          >
            {eventTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {migrationRequired ? (
        <p className="empty-state">Schedule storage is not ready yet. Run the broker events migration first.</p>
      ) : localEvents.length === 0 ? (
        <p className="empty-state">Confirmed viewing, follow-up, signing, and handover items will appear here.</p>
      ) : filteredEvents.length === 0 ? (
        <p className="empty-state">No schedule items match these filters.</p>
      ) : (
        <div className="schedule-list-stack">
          {filteredEvents.map((scheduleEvent) =>
            editingId === scheduleEvent.id && editState ? (
              <form className="schedule-edit-card" key={scheduleEvent.id} onSubmit={(event) => handleSubmit(event, scheduleEvent.id)}>
                <label>
                  <span>Title</span>
                  <input
                    required
                    value={editState.title}
                    onChange={(event) => setEditState({ ...editState, title: event.target.value })}
                  />
                </label>
                <div className="schedule-edit-grid">
                  <label>
                    <span>Category</span>
                    <select
                      value={editState.event_category}
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          event_category: event.target.value as EventEditState["event_category"]
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
                      value={editState.event_type}
                      onChange={(event) =>
                        setEditState({ ...editState, event_type: event.target.value as EventEditState["event_type"] })
                      }
                    >
                      {eventTypeOptions
                        .filter((option) => option.value !== "all")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={editState.status}
                      onChange={(event) =>
                        setEditState({ ...editState, status: event.target.value as EventEditState["status"] })
                      }
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="canceled">Canceled</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </label>
                  <label>
                    <span>Start</span>
                    <input
                      type="datetime-local"
                      value={editState.start_at}
                      onChange={(event) => setEditState({ ...editState, start_at: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>End</span>
                    <input
                      type="datetime-local"
                      value={editState.end_at}
                      onChange={(event) => setEditState({ ...editState, end_at: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Reminder</span>
                    <input
                      type="datetime-local"
                      value={editState.reminder_at}
                      onChange={(event) => setEditState({ ...editState, reminder_at: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Lead</span>
                    <input
                      value={editState.lead_name}
                      onChange={(event) => setEditState({ ...editState, lead_name: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>Listing</span>
                    <input
                      value={editState.listing_reference}
                      onChange={(event) => setEditState({ ...editState, listing_reference: event.target.value })}
                    />
                  </label>
                </div>
                <label>
                  <span>Location</span>
                  <input
                    value={editState.location_text}
                    onChange={(event) => setEditState({ ...editState, location_text: event.target.value })}
                  />
                </label>
                <label>
                  <span>Notes</span>
                  <textarea
                    value={editState.description}
                    onChange={(event) => setEditState({ ...editState, description: event.target.value })}
                  />
                </label>
                <div className="card-actions">
                  <button className="primary-button small" type="submit" disabled={updatingId === scheduleEvent.id}>
                    <CheckCircle2 size={14} /> Save
                  </button>
                  <button className="outline-button small" type="button" onClick={cancelEditing}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <article className={`schedule-row ${scheduleEvent.status}`} key={scheduleEvent.id}>
                <time dateTime={getEventTime(scheduleEvent)}>
                  <Clock size={14} /> {formatShortTime(scheduleEvent.start_at ?? scheduleEvent.reminder_at, userTimeZone)}
                </time>
                <div className="schedule-row-main">
                  <div className="schedule-row-header">
                    <strong>{scheduleEvent.title}</strong>
                    <span className={`schedule-status ${scheduleEvent.status}`}>{scheduleEvent.status}</span>
                  </div>
                  <p>{scheduleEvent.description || "No notes yet."}</p>
                  <div className="schedule-row-meta">
                    <span>{scheduleEvent.event_type.replace(/_/g, " ")}</span>
                    {scheduleEvent.lead_name ? (
                      <span>
                        <UserRound size={13} /> {scheduleEvent.lead_name}
                      </span>
                    ) : null}
                    {scheduleEvent.listing_reference ? <span>{scheduleEvent.listing_reference}</span> : null}
                    {scheduleEvent.location_text ? (
                      <span>
                        <MapPin size={13} /> {scheduleEvent.location_text}
                      </span>
                    ) : null}
                    {scheduleEvent.reminder_at ? <span>Reminder {formatEventTime(scheduleEvent.reminder_at, userTimeZone)}</span> : null}
                  </div>
                </div>
                <div className="schedule-row-actions">
                  <button className="outline-button small" type="button" onClick={() => startEditing(scheduleEvent)}>
                    <Edit3 size={14} /> Edit
                  </button>
                  {scheduleEvent.status === "scheduled" ? (
                    <>
                      <button
                        className="outline-button small"
                        type="button"
                        disabled={updatingId === scheduleEvent.id}
                        onClick={() => void patchEvent(scheduleEvent.id, { status: "completed" }, "Marking complete...")}
                      >
                        <CheckCircle2 size={14} /> Done
                      </button>
                      <button
                        className="outline-button small"
                        type="button"
                        disabled={updatingId === scheduleEvent.id}
                        onClick={() => void patchEvent(scheduleEvent.id, { status: "canceled" }, "Canceling event...")}
                      >
                        <XCircle size={14} /> Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            )
          )}
        </div>
      )}

      {status ? <p className="agent-draft-status schedule-panel-status">{status}</p> : null}
    </section>
  );
}
