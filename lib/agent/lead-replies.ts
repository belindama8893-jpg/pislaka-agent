import { env, requireServerEnv } from "@/lib/env";
import type { LeadListItem } from "@/lib/leads/types";
import { leadReplyDraftSchema, type LeadReplyDraft } from "@/lib/leads/reply-types";
import type { ListingRecord } from "@/lib/listings/types";

const leadReplySystemPrompt = `
You are Pislaka Agent, a WhatsApp follow-up assistant for real estate brokers in Pakistan.
Return only JSON. Do not return markdown.

Draft a concise WhatsApp reply for a buyer lead. The broker will review before sending.

Output shape:
{
  "reply_text": "WhatsApp-ready reply text",
  "tone": "friendly and professional",
  "next_step": "Suggested next step"
}

Rules:
- Do not claim the message was sent.
- Keep it short enough for WhatsApp.
- Mention the listing only using facts provided.
- If the buyer asks for more details, offer viewing or more information.
- Use English by default, with natural Pakistan real estate wording.
- Do not include invented availability, discounts, or guarantees.
`;

type LeadReplyContext = {
  lead: LeadListItem;
  listing: ListingRecord | null;
};

function formatPrice(listing: ListingRecord | null) {
  if (!listing?.price_amount) {
    return "price on request";
  }

  const crore = listing.price_amount / 10000000;
  if (crore >= 1) {
    return `${listing.price_currency ?? "PKR"} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${listing.price_currency ?? "PKR"} ${listing.price_amount.toLocaleString("en-PK")}`;
}

function fallbackLeadReply({ lead, listing }: LeadReplyContext): LeadReplyDraft {
  const buyerName = lead.full_name?.trim() || "there";
  const listingTitle = listing?.title || lead.listing_title || "the property";
  const location = [listing?.location_area ?? lead.listing_area, listing?.city ?? lead.listing_city]
    .filter(Boolean)
    .join(", ");
  const facts = [
    location,
    listing?.area_value && listing.area_unit ? `${listing.area_value} ${listing.area_unit}` : null,
    listing?.bedrooms !== null && listing?.bedrooms !== undefined ? `${listing.bedrooms} beds` : null,
    formatPrice(listing)
  ].filter(Boolean);

  return {
    reply_text: `Hi ${buyerName}, thanks for your interest in ${listingTitle}. ${facts.length ? `Key details: ${facts.join(", ")}. ` : ""}Would you like me to share more details or arrange a viewing?`,
    tone: "friendly and professional",
    next_step: "Confirm buyer interest and offer viewing availability."
  };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Lead reply response was not a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function formatContextForPrompt({ lead, listing }: LeadReplyContext) {
  return {
    lead: {
      full_name: lead.full_name,
      phone: lead.phone,
      message: lead.message,
      source_channel: lead.source_channel,
      campaign_channel: lead.campaign_channel,
      created_at: lead.created_at
    },
    listing: listing
      ? {
          title: listing.title,
          description: listing.description,
          city: listing.city,
          location_area: listing.location_area,
          property_type: listing.property_type,
          listing_type: listing.listing_type,
          price_amount: listing.price_amount,
          price_currency: listing.price_currency,
          area_value: listing.area_value,
          area_unit: listing.area_unit,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          features: listing.features ?? []
        }
      : null
  };
}

export async function generateLeadReplyDraft(context: LeadReplyContext): Promise<LeadReplyDraft> {
  if (!env.deepseekApiKey) {
    return fallbackLeadReply(context);
  }

  const apiKey = requireServerEnv("deepseekApiKey");

  try {
    const response = await fetch(`${env.deepseekBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.deepseekModel,
        response_format: { type: "json_object" },
        temperature: 0.25,
        messages: [
          { role: "system", content: leadReplySystemPrompt },
          { role: "user", content: JSON.stringify(formatContextForPrompt(context)) }
        ]
      })
    });

    if (!response.ok) {
      return fallbackLeadReply(context);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return fallbackLeadReply(context);
    }

    const parsed = leadReplyDraftSchema.safeParse(JSON.parse(extractJsonObject(content)));

    return parsed.success ? parsed.data : fallbackLeadReply(context);
  } catch {
    return fallbackLeadReply(context);
  }
}
