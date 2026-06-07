create extension if not exists "uuid-ossp";

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

create index if not exists conversations_broker_id_idx on conversations(broker_id);
create index if not exists chat_messages_conversation_id_idx on chat_messages(conversation_id);
create index if not exists chat_messages_broker_created_at_idx on chat_messages(broker_id, created_at desc);

alter table conversations enable row level security;
alter table chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'conversations'
      and policyname = 'brokers can manage own conversations'
  ) then
    create policy "brokers can manage own conversations"
      on conversations for all
      using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
      with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'brokers can manage own chat messages'
  ) then
    create policy "brokers can manage own chat messages"
      on chat_messages for all
      using (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()))
      with check (broker_id in (select id from broker_profiles where auth_user_id = auth.uid()));
  end if;
end $$;
