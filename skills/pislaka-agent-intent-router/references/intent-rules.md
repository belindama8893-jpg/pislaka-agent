# Intent Rules Reference

## Non-Negotiables

- PostgreSQL is the only source of truth.
- LLM output is only an action proposal.
- No silent fallback: if a lead/listing/event is not found, say so and ask before showing latest or nearby records.
- Ambiguous matches must pause for user selection.
- Channels are parameters, not intents.
- External or persistent actions require confirmation.

## Routing Priority

1. Safety and external action detection.
2. Lead reply and communication intent.
3. Lead status update intent.
4. Schedule and reminder intent.
5. Explicit promotion or content-generation intent.
6. Lead/listing/schedule query intent.
7. Listing creation/update intent.
8. General reply or clarification.

## Domain Intents

### Information Management

- `create_listing_draft`: create an editable listing preview from broker text/voice/media.
- `update_listing_draft`: edit an existing listing after resolving the target.
- `list_leads`: read-only lead search or filter.
- `update_lead_status`: status/urgency update after exact lead match and confirmation.
- `create_schedule_event`: viewing, signing, handover, deadline, reminder, weekly/monthly review.
- `list_schedule_events`: read-only calendar query.

### Content Generation

- `draft_lead_reply`: generate WhatsApp or text reply for a matched lead.
- `create_campaign_links`: generate channel-specific promotion content and lead pages for a matched listing.
- `generate_contract_draft`: draft agreements or authorization documents.
- `generate_social_copy`: channel-specific post copy.

### Analysis

- `analyze_market`: market demand, price, area trend.
- `analyze_leads`: lead quality, urgency, conversion likelihood.
- `analyze_listings`: listing performance, missing media, price or engagement gaps.
- `show_basic_attribution`: listing/channel/campaign lead attribution.

## Channel Examples

- "Reply to Ahmed on WhatsApp" -> `draft_lead_reply`; channel = `whatsapp`.
- "Promote this listing on WhatsApp" -> `create_campaign_links`; channel = `whatsapp`.
- "Send Sarah a follow-up" -> communication draft; do not auto-send.
- "Write Facebook copy for this villa" -> content generation; requires listing target.

## Entity Resolution

Preferred matching order:

1. Explicit id/code.
2. Phone/email.
3. Exact person/listing name.
4. Strong compound match such as area + size + type.
5. Current active preview only when the user says "this", "这套", "刚才", or equivalent.

No match response:

> I could not find a lead named Ahmed. Do you want me to show the latest leads instead?

Ambiguous response:

> I found several Ahmed leads. Please choose which one you mean before I continue.

## Confirmation Matrix

Must confirm:

- Save/edit/publish listing.
- Create/regenerate campaign links.
- Change lead status or urgency.
- Create/edit/cancel schedule event.
- Open external WhatsApp message.
- Export/share documents.
- Bulk actions.

Can run without confirmation:

- Read-only search/list.
- Draft content shown inside chat.
- Analysis summary.
- Preview card generation.

## Regression Examples

These examples must stay correct:

- "Reply to Ahmed on WhatsApp" must not trigger listing promotion.
- "Mark Ahmed as hot lead" must not show another person's lead if Ahmed is missing.
- "Show Ahmed lead" must report no match before offering latest leads.
- "Promote my DHA 5 10 marla villa" must confirm the listing and channels before generating links.

