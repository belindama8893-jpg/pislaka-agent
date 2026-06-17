-- Pislaka Agent MVP database schema
-- Target: Supabase Postgres

create extension if not exists "uuid-ossp";

create table if not exists broker_profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  city text default 'Lahore',
  agency_name text,
  preferred_language text default 'english_roman_urdu',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  title text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text,
  message_type text not null default 'text',
  structured_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists voice_messages (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  chat_message_id uuid references chat_messages(id) on delete set null,
  audio_url text not null,
  duration_seconds integer,
  transcript text,
  language text,
  confidence numeric(5, 4),
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title text,
  description text,
  city text default 'Lahore',
  location_area text,
  property_type text,
  listing_type text check (listing_type in ('sale', 'rent')),
  price_amount numeric(14, 2),
  price_currency text default 'PKR',
  area_value numeric(10, 2),
  area_unit text check (area_unit in ('kanal', 'marla', 'sqft', 'sqm')),
  bedrooms integer,
  bathrooms integer,
  features text[],
  ai_extracted_payload jsonb,
  ai_confidence numeric(5, 4),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listing_media (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  media_type text not null default 'image',
  storage_url text not null,
  sort_order integer not null default 0,
  ai_tags text[],
  ai_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists campaign_links (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'facebook', 'instagram', 'portal', 'direct')),
  code text not null unique,
  destination_url text not null,
  generated_copy text,
  created_at timestamptz not null default now()
);

create table if not exists click_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_link_id uuid references campaign_links(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,
  broker_id uuid references broker_profiles(id) on delete set null,
  channel text,
  visitor_id text,
  user_agent text,
  ip_hash text,
  referrer text,
  created_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete set null,
  broker_id uuid references broker_profiles(id) on delete set null,
  listing_id uuid references listings(id) on delete set null,
  campaign_link_id uuid references campaign_links(id) on delete set null,
  event_name text not null check (
    event_name in (
      'page_view',
      'lead_form_view',
      'lead_form_start',
      'lead_submit_attempt',
      'lead_submit_success',
      'whatsapp_opened',
      'home_page_view',
      'auth_modal_opened',
      'auth_started',
      'auth_succeeded',
      'workspace_view',
      'profile_completed',
      'listing_created',
      'lead_created'
    )
  ),
  channel text,
  visitor_id text,
  session_id text,
  experiment_key text,
  variant text,
  path text,
  referrer text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  campaign_link_id uuid references campaign_links(id) on delete set null,
  source_channel text,
  full_name text,
  phone text,
  email text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'lost')),
  urgency text default 'normal' check (urgency in ('low', 'normal', 'high')),
  ai_summary text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  last_note text,
  budget_min numeric(14, 2),
  budget_max numeric(14, 2),
  interested_area text,
  interested_listing_id uuid references listings(id) on delete set null,
  visitor_id text,
  session_id text,
  experiment_key text,
  variant text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'phone', 'in_person', 'facebook', 'instagram', 'other')),
  summary text,
  message_draft text,
  old_status text,
  new_status text,
  next_follow_up_at timestamptz,
  source_type text not null default 'manual' check (
    source_type in ('manual', 'whatsapp_paste', 'whatsapp_txt_upload', 'whatsapp_zip_upload', 'agent_chat')
  ),
  original_chat_saved boolean not null default false,
  original_chat_text text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

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

create table if not exists tool_calls (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid not null references broker_profiles(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  chat_message_id uuid references chat_messages(id) on delete set null,
  tool_name text not null,
  idempotency_key text,
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists tool_calls_idempotency_key_idx
  on tool_calls(idempotency_key)
  where idempotency_key is not null;

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  broker_id uuid references broker_profiles(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'agent', 'system')),
  action text not null,
  entity_type text,
  entity_id uuid,
  before_payload jsonb,
  after_payload jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_broker_id_idx on conversations(broker_id);
create index if not exists chat_messages_conversation_id_idx on chat_messages(conversation_id);
create index if not exists listings_broker_id_status_idx on listings(broker_id, status);
create index if not exists campaign_links_listing_id_idx on campaign_links(listing_id);
create index if not exists click_events_campaign_link_id_idx on click_events(campaign_link_id);
create index if not exists analytics_events_broker_created_idx on analytics_events(broker_id, created_at desc);
create index if not exists analytics_events_auth_user_created_idx
  on analytics_events(auth_user_id, created_at desc)
  where auth_user_id is not null;
create index if not exists analytics_events_campaign_event_idx on analytics_events(campaign_link_id, event_name, created_at desc);
create index if not exists analytics_events_listing_event_idx on analytics_events(listing_id, event_name, created_at desc);
create index if not exists analytics_events_experiment_variant_idx
  on analytics_events(experiment_key, variant, created_at desc)
  where experiment_key is not null;
create index if not exists analytics_events_visitor_idx
  on analytics_events(visitor_id, created_at desc)
  where visitor_id is not null;
create index if not exists leads_broker_id_status_idx on leads(broker_id, status);
create index if not exists leads_broker_next_follow_up_idx on leads(broker_id, next_follow_up_at) where next_follow_up_at is not null;
create index if not exists leads_broker_last_contacted_idx on leads(broker_id, last_contacted_at) where last_contacted_at is not null;
create index if not exists follow_up_activities_broker_occurred_idx on follow_up_activities(broker_id, occurred_at desc);
create index if not exists follow_up_activities_broker_lead_idx on follow_up_activities(broker_id, lead_id, occurred_at desc);
create index if not exists follow_up_activities_broker_next_follow_up_idx on follow_up_activities(broker_id, next_follow_up_at) where next_follow_up_at is not null;
create index if not exists follow_up_activities_broker_type_idx on follow_up_activities(broker_id, activity_type, occurred_at desc);
create index if not exists broker_events_broker_time_idx on broker_events(broker_id, (coalesce(start_at, reminder_at)), status);
create index if not exists broker_events_in_app_reminder_due_idx
  on broker_events(broker_id, reminder_at, status)
  where reminder_at is not null and in_app_reminded_at is null;
create index if not exists broker_events_broker_category_idx on broker_events(broker_id, event_category, status);
create index if not exists broker_events_lead_id_idx on broker_events(lead_id);
create index if not exists broker_events_listing_id_idx on broker_events(listing_id);
create index if not exists audit_logs_broker_id_created_at_idx on audit_logs(broker_id, created_at desc);

-- Automatically create a broker profile when a Supabase auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.broker_profiles (auth_user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Row Level Security
alter table broker_profiles enable row level security;
alter table conversations enable row level security;
alter table chat_messages enable row level security;
alter table voice_messages enable row level security;
alter table listings enable row level security;
alter table listing_media enable row level security;
alter table campaign_links enable row level security;
alter table click_events enable row level security;
alter table leads enable row level security;
alter table follow_up_activities enable row level security;
alter table broker_events enable row level security;
alter table tool_calls enable row level security;
alter table audit_logs enable row level security;

create policy "brokers can read own profile"
  on broker_profiles for select
  using (auth_user_id = auth.uid());

create policy "brokers can update own profile"
  on broker_profiles for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "brokers can insert own profile"
  on broker_profiles for insert
  with check (auth_user_id = auth.uid());

create policy "brokers can manage own conversations"
  on conversations for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own chat messages"
  on chat_messages for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own voice messages"
  on voice_messages for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own listings"
  on listings for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own listing media"
  on listing_media for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own campaign links"
  on campaign_links for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can read own click events"
  on click_events for select
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own leads"
  on leads for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own follow up activities"
  on follow_up_activities for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can manage own events"
  on broker_events for all
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can read own tool calls"
  on tool_calls for select
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can read own audit logs"
  on audit_logs for select
  using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));

create policy "brokers can insert own audit logs"
  on audit_logs for insert
  with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));
