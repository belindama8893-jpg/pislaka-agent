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

alter table analytics_events
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table analytics_events
  add constraint analytics_events_event_name_check
  check (
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
  );

alter table leads
  add column if not exists visitor_id text,
  add column if not exists session_id text,
  add column if not exists experiment_key text,
  add column if not exists variant text;

create index if not exists analytics_events_broker_created_idx
  on analytics_events(broker_id, created_at desc);

create index if not exists analytics_events_auth_user_created_idx
  on analytics_events(auth_user_id, created_at desc)
  where auth_user_id is not null;

create index if not exists analytics_events_campaign_event_idx
  on analytics_events(campaign_link_id, event_name, created_at desc);

create index if not exists analytics_events_listing_event_idx
  on analytics_events(listing_id, event_name, created_at desc);

create index if not exists analytics_events_experiment_variant_idx
  on analytics_events(experiment_key, variant, created_at desc)
  where experiment_key is not null;

create index if not exists analytics_events_visitor_idx
  on analytics_events(visitor_id, created_at desc)
  where visitor_id is not null;
