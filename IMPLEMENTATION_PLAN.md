# Pislaka Agent MVP Implementation Plan

## Current Baseline

Completed:

- Next.js MVP app scaffolded.
- Supabase project configured locally.
- Database schema executed.
- Required tables verified.
- Storage buckets created:
  - `listing-media`
  - `voice-messages`
- Google OAuth enabled in Supabase.
- Google login smoke-tested locally.
- Google login creates `auth.users` and `broker_profiles`.
- Local app runs at `http://localhost:3000`.

## MVP Goal

Deliver one usable broker workflow:

Login -> create listing draft by text or voice -> AI drafts listing -> user confirms -> listing saved to inventory -> campaign links generated -> buyer submits lead -> broker sees attribution -> AI drafts WhatsApp reply.

## Guiding Rules

- PostgreSQL is the source of truth.
- LLM output is a proposal, not a database write.
- Every inventory, campaign, and lead action must be traceable.
- MVP uses WhatsApp deep links, not WhatsApp Business API auto-send.
- MVP uses Google OAuth + Email/Password; Phone/WhatsApp OTP is reserved for the next version.

## Phase 1: Auth And User Shell

Status: next

Tasks:

- Read current Supabase session on the server.
- Redirect signed-out users to `/auth/sign-in` when entering the app.
- Show real broker profile data instead of static `Ali Khan`.
- Add sign out.
- Add first-run profile completion fields:
  - full name
  - city
  - agency name
  - phone
  - preferred language

Done when:

- Google login returns to the app.
- `/api/profile/me` returns the current broker.
- Header/sidebar use real profile data.
- User can sign out.

## Phase 2: Listing Draft CRUD

Status: pending

Tasks:

- Build a listing draft form/card in the chat workspace.
- Save draft to `listings`.
- Show listing draft cards from real database data.
- Add edit and publish actions.
- Add audit log for create/update/publish.

Done when:

- A logged-in broker can create a listing draft.
- The draft appears after refresh.
- Publishing changes status from `draft` to `published`.

## Phase 3: DeepSeek Listing Copilot

Status: pending

Tasks:

- Connect chat composer to `/api/agent/message`.
- Route listing-like messages to `create_listing_draft`.
- Validate LLM JSON with Zod.
- Render AI proposal as a listing draft card.
- Require user confirmation before saving to DB.

Done when:

- User can type: `1 Kanal house in DHA Phase 6, 8.5 crore`.
- Agent returns a structured listing draft.
- User can save that draft to inventory.

## Phase 4: Voice Input

Status: pending

Tasks:

- Add browser recording with `MediaRecorder`.
- Upload audio to backend.
- Store audio in `voice-messages`.
- Transcribe with STT provider.
- Send transcript into the same Agent router.

Done when:

- User can record a voice note.
- System shows transcript.
- Transcript can create a listing draft or lead reply.

## Phase 5: Campaign Links

Status: pending

Tasks:

- Generate campaign links for published listings.
- Channels:
  - WhatsApp
  - Facebook
  - Direct
- Add public listing URL.
- Record click events.
- Add WhatsApp share/deep link.

Done when:

- Published listing has shareable links.
- Opening a tracking link records a click.
- WhatsApp share opens with generated text.

## Phase 6: Public Listing And Lead Capture

Status: pending

Tasks:

- Build public listing page at `/p/[code]`.
- Show listing details and images.
- Add buyer lead form.
- Save lead to `leads`.
- Link lead to listing, campaign link, and channel.

Done when:

- Buyer can submit a lead from a public listing page.
- Broker can see the lead in the workspace.
- Lead source attribution is preserved.

## Phase 7: Lead Assistant

Status: pending

Tasks:

- Show urgent leads from database.
- Generate AI reply draft.
- Open WhatsApp deep link with reply text.
- Add lead status update:
  - new
  - contacted
  - qualified
  - closed
  - lost

Done when:

- Broker can ask for urgent leads.
- Agent drafts a reply.
- Broker can open WhatsApp with the reply text.

## Phase 8: Deployment And MVP QA

Status: pending

Tasks:

- Deploy to Vercel.
- Add production env vars.
- Add Vercel URL to:
  - Supabase redirect URLs
  - Google authorized JavaScript origins
- Add production callback URL if needed.
- Run full smoke test.

Done when:

- App works on Vercel.
- Google login works in production.
- Full listing-to-lead flow works end to end.

## Immediate Next 3 Tasks

1. Make `/` session-aware and display real broker profile.
2. Add sign-out and profile completion UI.
3. Connect “Save to Inventory” to `POST /api/listings/draft`.
