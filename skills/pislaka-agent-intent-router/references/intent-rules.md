# Intent Rules Reference

## Non-Negotiables

- PostgreSQL is the only source of truth.
- LLM output is only an action proposal.
- No silent fallback: if a lead/listing/event is not found, say so and ask before showing latest or nearby records.
- Ambiguous matches must pause for user selection.
- Channels are parameters, not intents.
- External or persistent actions require confirmation.
- Open WhatsApp is not the same as sent.
- `reply_drafted` and `whatsapp_opened` must not update `last_contacted_at`.
- Only `message_sent` updates `last_contacted_at`.

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
- `list_today_followups`: read-only ranked list of leads due for follow-up today.
- `record_lead_followup`: broker-confirmed follow-up activity such as sent message or interested/not interested status.
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
- "I sent message to Ahmed" -> `record_lead_followup`; activity_type = `message_sent`; resolve Ahmed before writing.
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
- Save follow-up activity from imported chat.
- Save original WhatsApp chat text.
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
- "Reply to Ahmed on WhatsApp" must not mark Ahmed as contacted.
- "I sent message to Ahmed" must resolve Ahmed before writing `message_sent`.
- "Who should I follow up today?" must return today's follow-up recommendations, not a generic lead list.
- "Mark Ahmed as hot lead" must not show another person's lead if Ahmed is missing.
- "Show Ahmed lead" must report no match before offering latest leads.
- "Promote my DHA 5 10 marla villa" must confirm the listing and channels before generating links.
- "这套房源改为10marla" with a selected listing context must prepare an update preview for that listing, not create a new listing draft.
- "Set a schedule for 4:30 today" with selected lead and listing context must bind both selected records and must not extract lead name "4" from the time.
- "Schedule a viewing with belinda tomorrow at 5pm for my DHA Phase 5 villa" must prepare a schedule preview. Interpret the time in the user's current browser timezone, match lowercase lead names such as "belinda" to existing leads when possible, and do not block if "DHA Phase 5 villa" matches multiple listings; keep the listing text unbound unless there is a confident selected match.
- The Schedule workspace must default to the next 7 days, not only today, and its top metric cards must stay compact on mobile.
- "Share this listing to Facebook" must prepare a promotion pack confirmation for the matched listing and channel; a later "yes" must execute the pending promotion action, not route as a new general message.
- "Publish it to WhatsApp" for a selected listing must prepare a WhatsApp promotion pack confirmation and must not claim that Pislaka has published or sent the listing externally.
