# Pislaka Agent MVP Deployment

## Target Stack

- Vercel hosts the Next.js app, API routes, public listing pages, and tracking links.
- Supabase hosts Auth, Postgres, and Storage.
- DeepSeek powers agent routing, listing copy, and lead reply drafting.
- OpenAI or Google Speech-to-Text powers voice transcription.

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor and run `DATABASE_SCHEMA.sql`.
3. Run `node scripts/verify-supabase.mjs` locally to verify tables and create Storage buckets.
4. Enable Email auth in Authentication -> Providers.
5. Enable Google auth in Authentication -> Providers.
6. Add the Google OAuth client id and secret.
7. Add redirect URLs:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://YOUR_VERCEL_DOMAIN/auth/callback`
   - Custom domain later: `https://app.pislaka.com/auth/callback`
8. Confirm Storage buckets exist:
   - `listing-media`
   - `voice-messages`

Current MVP project status:

- Supabase project URL is configured in `.env.local`.
- Database schema has been executed.
- Required tables have been verified.
- `listing-media` and `voice-messages` buckets have been created.
- Google OAuth provider is enabled in Supabase.
- Google login has been smoke-tested locally.
- Google login created a Supabase auth user and a linked `broker_profiles` row.
- Google OAuth testing audience includes the primary test Gmail account.

## Vercel Setup

1. Import this repository into Vercel.
2. Set Framework Preset to Next.js.
3. Add environment variables from `.env.example`.
4. Deploy a preview environment first.
5. Add the preview URL to Supabase Auth redirect URLs.
6. After smoke testing, promote to production.

## Required Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

STT_PROVIDER=openai
OPENAI_API_KEY=
GOOGLE_STT_API_KEY=

NEXT_PUBLIC_APP_URL=https://YOUR_VERCEL_DOMAIN
```

## MVP Smoke Tests

1. Open `/api/health` and confirm `{ "ok": true }`.
2. Open `/auth/sign-in`.
3. Create an account with email/password.
4. Sign in with Google.
5. Confirm Supabase creates auth users.
6. Run a test message through `/api/agent/message` after `DEEPSEEK_API_KEY` is set.
7. Run listing schema queries in Supabase Table Editor.

## Production Notes

- PostgreSQL remains the source of truth.
- LLM output must be treated as proposed actions only.
- Do not enable automatic WhatsApp sending in MVP.
- Add Phone/WhatsApp OTP after the first broker tests prove the core workflow.
