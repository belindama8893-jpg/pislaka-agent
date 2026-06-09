"use client";

import { BellRing, CalendarClock, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BrokerEventRecord } from "@/lib/events/types";
import { formatBrokerDateTime, getResolvedTimeZone } from "@/lib/events/time";

type ReminderResponse = {
  reminders?: BrokerEventRecord[];
  migration_required?: boolean;
  error?: string;
};

function getReminderTime(event: BrokerEventRecord) {
  return event.reminder_at ?? event.start_at ?? event.created_at;
}

function getEventContext(event: BrokerEventRecord) {
  return [event.lead_name, event.listing_reference, event.location_text].filter(Boolean).join(" · ");
}

export function ScheduleReminderToasts() {
  const [reminders, setReminders] = useState<BrokerEventRecord[]>([]);
  const [timeZone, setTimeZone] = useState(() => getResolvedTimeZone());

  useEffect(() => {
    setTimeZone(getResolvedTimeZone());
  }, []);

  const visibleReminders = useMemo(() => reminders.slice(0, 3), [reminders]);

  const pollReminders = useCallback(async () => {
    if (document.visibilityState !== "visible") {
      return;
    }

    const response = await fetch("/api/events/reminders", {
      cache: "no-store"
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => null)) as ReminderResponse | null;
    if (!payload?.reminders?.length || payload.migration_required) {
      return;
    }

    setReminders((current) => {
      const existingIds = new Set(current.map((event) => event.id));
      const nextReminders = payload.reminders!.filter((event) => !existingIds.has(event.id));
      return [...current, ...nextReminders].slice(-5);
    });
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void pollReminders();
    }, 2500);
    const interval = window.setInterval(() => {
      void pollReminders();
    }, 60000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [pollReminders]);

  async function dismissReminder(eventId: string) {
    setReminders((current) => current.filter((event) => event.id !== eventId));
    await fetch("/api/events/reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ids: [eventId] })
    }).catch(() => null);
  }

  if (!visibleReminders.length) {
    return null;
  }

  return (
    <div aria-live="polite" className="schedule-reminder-stack">
      {visibleReminders.map((event) => {
        const context = getEventContext(event);
        return (
          <section className="schedule-reminder-toast" key={event.id}>
            <div className="schedule-reminder-icon">
              <BellRing size={18} />
            </div>
            <div className="schedule-reminder-body">
              <span>Reminder now</span>
              <strong>{event.title}</strong>
              <time dateTime={getReminderTime(event)}>{formatBrokerDateTime(getReminderTime(event), timeZone)}</time>
              {context ? <p>{context}</p> : null}
              <div className="schedule-reminder-actions">
                <Link href="/schedule">
                  <CalendarClock size={14} /> Open schedule
                </Link>
                <button type="button" onClick={() => void dismissReminder(event.id)}>
                  Dismiss
                </button>
              </div>
            </div>
            <button
              aria-label="Dismiss reminder"
              className="schedule-reminder-close"
              type="button"
              onClick={() => void dismissReminder(event.id)}
            >
              <X size={15} />
            </button>
          </section>
        );
      })}
    </div>
  );
}
