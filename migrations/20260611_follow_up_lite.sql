-- Follow-up Lite: lead follow-up state and activity ledger.

alter table leads
  add column if not exists last_contacted_at timestamptz,
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists last_note text,
  add column if not exists budget_min numeric(14, 2),
  add column if not exists budget_max numeric(14, 2),
  add column if not exists interested_area text,
  add column if not exists interested_listing_id uuid references listings(id) on delete set null;

create table if not exists follow_up_activities (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  related_listing_id uuid references listings(id) on delete set null,
  activity_type text not null check (
    activity_type in (
      'reply_drafted',
      'whatsapp_opened',
      'message_sent',
      'status_changed',
      'reminder_created',
      'note_added',
      'viewing_scheduled',
      'chat_imported',
      'followup_summary_saved'
    )
  ),
  channel text not null default 'whatsapp' check (
    channel in ('whatsapp', 'phone', 'in_person', 'facebook', 'instagram', 'other')
  ),
  summary text,
  message_draft text,
  old_status text,
  new_status text,
  next_follow_up_at timestamptz,
  source_type text not null default 'manual' check (
    source_type in (
      'manual',
      'whatsapp_paste',
      'whatsapp_txt_upload',
      'whatsapp_zip_upload',
      'agent_chat'
    )
  ),
  original_chat_saved boolean not null default false,
  original_chat_text text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists leads_broker_next_follow_up_idx
  on leads(broker_id, next_follow_up_at)
  where next_follow_up_at is not null;

create index if not exists leads_broker_last_contacted_idx
  on leads(broker_id, last_contacted_at)
  where last_contacted_at is not null;

create index if not exists follow_up_activities_broker_occurred_idx
  on follow_up_activities(broker_id, occurred_at desc);

create index if not exists follow_up_activities_broker_lead_idx
  on follow_up_activities(broker_id, lead_id, occurred_at desc);

create index if not exists follow_up_activities_broker_next_follow_up_idx
  on follow_up_activities(broker_id, next_follow_up_at)
  where next_follow_up_at is not null;

create index if not exists follow_up_activities_broker_type_idx
  on follow_up_activities(broker_id, activity_type, occurred_at desc);

alter table follow_up_activities enable row level security;

create policy "brokers can manage own follow up activities"
  on follow_up_activities for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));
