# Pislaka Agent Intent Rulebook

## Purpose

Pislaka Agent is an intent router for Pakistani real estate brokers. The chat box is not a generic chatbot. It must classify a broker message into a business workflow, collect the required entities, show the right preview, and only execute confirmed actions.

## Core Principles

1. PostgreSQL is the source of truth. Agent memory, chat text, and LLM output are never the final business state.
2. LLM output is a proposal. Database writes and external actions must go through typed backend APIs.
3. No silent fallback. If the requested entity is not found, the agent must say it was not found and ask before showing any nearby/latest record.
4. Channels are parameters, not intents. WhatsApp, Facebook, Instagram, and portals only modify an already detected workflow.
5. High-risk actions require explicit confirmation.
6. Search and update must be scoped to the current broker.
7. Ambiguity must stop execution. The agent can ask a follow-up question or show candidates, but cannot choose silently.

## Intent Domains

### Information Management

This domain creates, queries, or updates broker-owned records.

| Intent | User examples | Required entity | Output | Confirmation |
| --- | --- | --- | --- | --- |
| `create_listing_draft` | "Create a 10 marla villa in DHA Phase 5" | Listing facts | Editable listing preview | Required before save |
| `update_listing_draft` | "Change this listing price to 1.2 crore" | Listing target + changed fields | Editable update preview | Required |
| `list_leads` | "Show my hot leads" | Lead filters | Lead list or no-match message | Not required for read |
| `update_lead_status` | "Mark Ahmed as hot lead" | Exact lead target + new status | Status update preview | Required |
| `create_schedule_event` | "Schedule viewing with Ahmed tomorrow 3pm" | Event type + time + participant | Calendar preview | Required |
| `list_schedule_events` | "What do I have today?" | Date/filter | Event list | Not required for read |

### Content Generation

This domain generates editable content. It must not send messages or publish externally without confirmation.

| Intent | User examples | Required entity | Output | Confirmation |
| --- | --- | --- | --- | --- |
| `draft_lead_reply` | "Reply to Ahmed on WhatsApp" | Exact lead target | WhatsApp reply draft | Required before opening/send |
| `create_campaign_links` | "Promote my DHA 5 villa on WhatsApp and Facebook" | Exact listing target + channels | Channel-specific promotion pack | Required |
| `generate_contract_draft` | "Make an agreement for this buyer" | Listing + buyer + agreement type | Document draft | Required before export/share |
| `generate_social_copy` | "Write Instagram copy for this listing" | Listing target + channel | Channel copy | Required before publish/share |

### Analysis And Decision Support

This domain reads and summarizes data. It can generate recommendations, but cannot update records by itself.

| Intent | User examples | Required entity | Output | Confirmation |
| --- | --- | --- | --- | --- |
| `analyze_market` | "How is DHA Phase 5 demand?" | Market scope | Market summary | Not required |
| `analyze_leads` | "Which leads are most likely to close?" | Lead filters | Ranked analysis | Not required |
| `analyze_listings` | "Which listings are underperforming?" | Listing filters | Listing analysis | Not required |
| `show_basic_attribution` | "Which channel brought these leads?" | Date/listing/channel filters | Attribution summary | Not required |

## Routing Priority

The router must evaluate intents in this order:

1. Safety and external action detection.
2. Lead reply and communication intent.
3. Lead status update intent.
4. Schedule and reminder intent.
5. Explicit promotion or content-generation intent.
6. Lead/listing/schedule query intent.
7. Listing creation/update intent.
8. General reply or clarification.

Reason: "Reply to Ahmed on WhatsApp" contains a channel word, but the primary verb is reply. It must be `draft_lead_reply`, not `create_campaign_links`.

Safety triggers include fraud or misrepresentation requests, price manipulation, unauthorized access to another broker's data, bulk deletion, and high-risk destructive changes. External action triggers include sending WhatsApp messages, publishing to portals such as Zameen or OLX, exporting/sharing documents, or posting content outside Pislaka. The agent may draft these actions, but execution must require confirmation.

## Channel Rules

Channel words never decide intent by themselves.

- `WhatsApp`, `Facebook`, `Instagram`, `portal`, `Zameen`, and similar words are channels.
- They become relevant only after a workflow is identified.
- "Promote this listing on WhatsApp" means campaign generation.
- "Reply to Ahmed on WhatsApp" means lead reply.
- "Share this with Ahmed on WhatsApp" is a communication action and must require confirmation.

Promotion versus social-copy routing:

- `promote`, `advertise`, `market`, `campaign`, `推广`, or `宣传` plus a channel means `create_campaign_links`.
- `write`, `copy`, `caption`, `post text`, `文案`, or `标题` plus a channel means `generate_social_copy`.
- If the user only says they want to post on a channel and the desired output is unclear, ask whether they want campaign links or publishable copy.

## Media Upload Routing

Photo and video uploads are parameters of listing creation or listing update workflows. They are not a separate navigation tab or standalone intent.

- If the broker uploads image/video files while a listing preview card is active, treat them as candidate `listing_media` for that preview and show them inside the preview card.
- If the broker selects image/video files from the chat composer, keep them in the composer as removable thumbnails until the broker sends the message. After send, show the thumbnails in the user message and route the text plus media together.
- If the broker uploads image/video files with no active listing preview or resolved listing target, keep them as pending media and ask for the property description or target listing. Do not attach them to the latest listing silently.
- If the broker asks to add media to an existing listing, resolve the listing first using the entity resolution rules, then require the broker's explicit confirmation before persistent upload.
- If the uploaded file is not an image or video, reject it for listing media and ask for photos or video.
- MVP classification can use file type and conversation context. Future visual classification may inspect the file to confirm it appears to be property interior, exterior, plot, amenity, or walkthrough media before attaching.

## Entity Resolution Rules

### Exact Match First

The agent must try exact or high-confidence matching before any action:

- Person or lead name.
- Phone number.
- Listing title.
- Area + size combination.
- Campaign/public code.
- Current active preview card, only when the user says "this", "this listing", "刚才", "这套", or similar.

### No-Match Behavior

If no target is found:

1. Say the exact entity was not found.
2. Do not show a random/latest record.
3. Ask whether the user wants to see latest records or search by another keyword.

Example:

> I could not find a lead named Ahmed. Do you want me to show the latest leads instead?

### Ambiguous-Match Behavior

If multiple targets match:

1. Show a short candidate list.
2. Ask the user to choose one.
3. Do not execute the action until the user confirms the exact target.

## Confirmation Rules

### Must Confirm

- Save or edit a listing.
- Publish a listing.
- Generate or regenerate campaign links.
- Change lead status or urgency.
- Create, edit, or cancel schedule events.
- Open WhatsApp with a prepared message.
- Export/share documents.
- Any bulk action.

### May Execute Without Confirmation

- Read-only list/search.
- Drafting content in the chat window.
- Showing analytics summaries.
- Showing a preview card.

## Intent Examples

| Message | Correct intent | Notes |
| --- | --- | --- |
| "Reply to Ahmed on WhatsApp" | `draft_lead_reply` | WhatsApp is a channel parameter |
| "Mark Ahmed as hot lead" | `update_lead_status` | Must exact-match Ahmed first |
| "Show hot leads" | `list_leads` | Read-only |
| "Promote my DHA 5 10 marla villa on WhatsApp and Facebook" | `create_campaign_links` | Requires listing confirmation and channel selection |
| "Create a listing for 1 kanal DHA Phase 6 8.5 crore" | `create_listing_draft` | Editable preview before save |
| "Change this listing price to 1.2 crore" | `update_listing_draft` | Resolve the current listing and confirm before update |
| "Schedule viewing with Ahmed tomorrow at 3pm" | `create_schedule_event` | Calendar preview before save |
| "Which leads should I follow up today?" | `analyze_leads` or `list_leads` | Read-only, can rank urgent leads |
| "How is this listing performing?" | `analyze_listings` | Requires current listing or explicit target |

## Unknown Or Weak Intent

If the message lacks enough information, the agent should ask one concise follow-up question.

Examples:

- "Promote it" but no current listing: ask which listing.
- "Reply to him" but no active lead context: ask which lead.
- "Schedule tomorrow" but no time or target: ask who and when.
- "Change my DHA 5 villa price" with multiple matching listings: ask which listing before updating.
- Weak or unsupported messages must return `general_reply`, not a forced listing draft.
- Local fallback may create a listing draft only when the message contains both a listing action/property type and concrete property facts such as location, area, price, beds, or sale/rent terms.

## Implementation Contract

The backend router should return one normalized object:

```json
{
  "intent": "draft_lead_reply",
  "requires_confirmation": true,
  "confidence": 0.86,
  "entities": {
    "lead_name": "Ahmed",
    "channel": "whatsapp"
  },
  "resolution": {
    "status": "matched",
    "target_id": "uuid"
  },
  "response": "I found Ahmed. Please review this WhatsApp reply before sending.",
  "payload": {}
}
```

Resolution status should be one of:

- `matched`
- `no_match`
- `ambiguous`
- `needs_clarification`

Status meanings:

- `matched`: one exact or high-confidence target was found.
- `no_match`: the user named or described a target, but no broker-owned record matched.
- `ambiguous`: the user named or described a target and 2-5 plausible candidates matched; execution must pause for selection.
- `needs_clarification`: the user did not provide enough target information and there is no valid current context, for example "reply to him" or "schedule tomorrow".

Only `matched` plus required user confirmation can reach an execution API.

## Current Implementation Status

Implemented now:

- `routeAgentMessage()` returns a typed `AgentAction` with optional `resolution`.
- Local fallback defaults weak/unknown messages to `general_reply`.
- Local fallback creates `create_listing_draft` only when the message looks like a property listing request.
- Backend lead resolution runs for `draft_lead_reply` and `update_lead_status` after the action proposal.
- Backend lead resolution can return `matched`, `ambiguous`, `no_match`, or `needs_clarification`.
- Backend listing resolution runs for `create_campaign_links` and can use an explicit/current listing id, the latest listing when explicitly requested, or strong listing details.
- Backend listing resolution runs for `update_listing_draft` before showing a listing update confirmation.
- Backend schedule event resolution runs for `create_schedule_event` and can resolve the participant lead, the associated listing, or both before showing the calendar preview.
- Frontend shows listing candidate cards when `update_listing_draft` returns ambiguous listing matches.
- Frontend sends `current_listing_id` when the broker has an active listing context.
- Frontend still has local lead scoring as a compatibility fallback when `resolution` is missing.
- Frontend still has local listing scoring as a compatibility fallback when `resolution` is missing.

Not implemented yet:

- Confidence scoring in the response contract.
- Candidate selection UI for ambiguous lead, schedule, and promotion flows beyond asking the user to clarify.
