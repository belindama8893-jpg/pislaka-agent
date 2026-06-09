-- Pislaka Agent schedule and reminder events
-- Target: Supabase Postgres

create table if not exists broker_events (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  event_category text not null check (event_category in ('appointment', 'reminder', 'recurring')),
  event_type text not null check (
    event_type in (
      'viewing',
      'contract_signing',
      'handover',
      'follow_up',
      'offer_deadline',
      'document_expiry',
      'weekly_review',
      'monthly_client_review',
      'custom'
    )
  ),
  title text not null,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  reminder_at timestamptz,
  in_app_reminded_at timestamptz,
  in_app_reminder_dismissed_at timestamptz,
  recurrence_rule text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'canceled', 'overdue')),
  lead_id uuid references leads(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,
  lead_name text,
  listing_reference text,
  location_text text,
  source_payload jsonb,
  created_from text not null default 'agent' check (created_from in ('agent', 'manual', 'lead', 'listing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_events_broker_time_idx
  on broker_events(broker_id, (coalesce(start_at, reminder_at)), status);

create index if not exists broker_events_in_app_reminder_due_idx
  on broker_events(broker_id, reminder_at, status)
  where reminder_at is not null and in_app_reminded_at is null;

create index if not exists broker_events_broker_category_idx
  on broker_events(broker_id, event_category, status);

create index if not exists broker_events_lead_id_idx on broker_events(lead_id);
create index if not exists broker_events_listing_id_idx on broker_events(listing_id);

alter table broker_events enable row level security;

create policy "brokers can manage own events"
  on broker_events for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));
