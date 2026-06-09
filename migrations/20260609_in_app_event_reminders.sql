-- Track station-internal reminder delivery for existing broker_events tables.
-- Target: Supabase Postgres

alter table broker_events
  add column if not exists in_app_reminded_at timestamptz,
  add column if not exists in_app_reminder_dismissed_at timestamptz;

create index if not exists broker_events_in_app_reminder_due_idx
  on broker_events(broker_id, reminder_at, status)
  where reminder_at is not null and in_app_reminded_at is null;
