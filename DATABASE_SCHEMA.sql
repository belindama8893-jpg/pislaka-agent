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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
create index if not exists leads_broker_id_status_idx on leads(broker_id, status);
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
