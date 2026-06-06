-- Private bucket for broker voice notes used by /api/voice/transcribe.
insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', false)
on conflict (id) do nothing;
