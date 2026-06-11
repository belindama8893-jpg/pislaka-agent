import { env, requireServerEnv } from "@/lib/env";
import type { ListingMediaRecord, ListingRecord } from "@/lib/listings/types";
import {
  listingPromotionSchema,
  type ListingPromotion,
  type PromotionChannel
} from "@/lib/promotions/types";

type ListingPromotionInput = ListingRecord & {
  media?: ListingMediaRecord[];
};

const promotionSystemPrompt = `
You are Pislaka Agent, a real estate marketing copilot for brokers in Pakistan.
Return only JSON. Do not return markdown.

Create channel-specific promotion copy for one property listing.

Channels:
- whatsapp: short, direct, conversational, easy to forward.
- facebook: clear headline, helpful details, trust-building body.
- instagram: concise, visual, aspirational, uses tasteful hashtags.
- portal: searchable listing style, direct facts, no hype.

Output shape:
{
  "summary": "Short explanation of the promotion angle",
  "cards": [
    {
      "channel": "whatsapp",
      "title": "Short channel title",
      "body": "Channel-ready text",
      "cta": "Call to action",
      "image_brief": "Which image/video style should accompany this post",
      "selected_media_id": "uuid if media candidate is suitable"
    }
  ]
}

Rules:
- Return exactly one card per selected channel.
- If media candidates exist, choose a suitable selected_media_id for each card.
- If media candidates are not visually described, choose based on type and order only.
- Do not invent exact photo contents that are not provided.
- Keep English copy by default. Use Pakistan real estate terms naturally.
- Do not claim the listing is published, shared, boosted, or sent.
`;

function formatListingForPrompt(listing: ListingPromotionInput, instruction?: string) {
  return {
    broker_instruction: instruction,
    id: listing.id,
    title: listing.title,
    description: listing.description,
    city: listing.city,
    location_area: listing.location_area,
    property_type: listing.property_type,
    listing_type: listing.listing_type,
    price_amount: listing.price_amount,
    price_currency: listing.price_currency ?? "PKR",
    area_value: listing.area_value,
    area_unit: listing.area_unit,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    features: listing.features ?? [],
    media_candidates: (listing.media ?? []).map((media) => ({
      id: media.id,
      media_type: media.media_type,
      sort_order: media.sort_order
    }))
  };
}

function formatPrice(listing: ListingPromotionInput) {
  if (!listing.price_amount) {
    return "Price on request";
  }

  const crore = listing.price_amount / 10000000;
  if (crore >= 1) {
    return `${listing.price_currency ?? "PKR"} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${listing.price_currency ?? "PKR"} ${listing.price_amount.toLocaleString("en-PK")}`;
}

function pickMediaId(listing: ListingPromotionInput, preferVideo = false) {
  const media = listing.media ?? [];
  const selected = preferVideo
    ? media.find((item) => item.media_type === "video") ?? media.find((item) => item.media_type === "image")
    : media.find((item) => item.media_type === "image") ?? media.find((item) => item.media_type === "video");

  return selected?.id;
}

function compactFacts(listing: ListingPromotionInput) {
  return [
    listing.area_value && listing.area_unit ? `${listing.area_value} ${listing.area_unit}` : null,
    listing.bedrooms !== null && listing.bedrooms !== undefined ? `${listing.bedrooms} beds` : null,
    listing.bathrooms !== null && listing.bathrooms !== undefined ? `${listing.bathrooms} baths` : null,
    [listing.location_area, listing.city].filter(Boolean).join(", ") || null,
    formatPrice(listing)
  ].filter(Boolean);
}

const allChannels: PromotionChannel[] = ["whatsapp", "facebook", "instagram", "portal"];

function filterCardsByChannel(promotion: ListingPromotion, channels: PromotionChannel[]) {
  return {
    ...promotion,
    cards: promotion.cards.filter((card) => channels.includes(card.channel))
  };
}

function fallbackPromotion(
  listing: ListingPromotionInput,
  channels: PromotionChannel[] = allChannels
): ListingPromotion {
  const title = listing.title || "Property listing";
  const facts = compactFacts(listing).join(" | ");
  const imageBrief = listing.media?.length
    ? "Use the strongest uploaded exterior or hero image first; use video for short-form social if available."
    : "Add a bright exterior image or short walk-through video before sharing.";

  return filterCardsByChannel(
    {
      summary: "A practical promotion pack focused on location, price, and quick buyer inquiry.",
      cards: [
        {
          channel: "whatsapp",
          title,
          body: `${title}\n${facts}\nMessage me for details or a viewing slot.`,
          cta: "Reply to schedule a viewing.",
          image_brief: imageBrief,
          selected_media_id: pickMediaId(listing)
        },
        {
          channel: "facebook",
          title: `${title} - ${listing.location_area ?? listing.city ?? "Pakistan"}`,
          body: `${listing.description ?? title}\n\nKey details: ${facts}. Suitable for serious buyers looking for a clear, well-located option.`,
          cta: "Message for price & viewing.",
          image_brief: "Use a clean hero image with the property facade or the most spacious interior angle.",
          selected_media_id: pickMediaId(listing)
        },
        {
          channel: "instagram",
          title: `${title}`,
          body: `${facts}\nDM for viewing.\n#PakistanRealEstate #LahoreProperty #Pislaka`,
          cta: "DM for viewing.",
          image_brief: "Use the most visually open image; if a video exists, use it as a reel cover or short walk-through.",
          selected_media_id: pickMediaId(listing, true)
        },
        {
          channel: "portal",
          title,
          body: `${listing.description ?? title}\n\n${facts}`,
          cta: "Contact for viewing.",
          image_brief: "Use straightforward listing images: exterior first, then living area, bedrooms, kitchen, and floor plan.",
          selected_media_id: pickMediaId(listing)
        }
      ]
    },
    channels
  );
}

function extractJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Promotion response was not a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

export async function generateListingPromotion(
  listing: ListingPromotionInput,
  instruction?: string,
  channels: PromotionChannel[] = allChannels
): Promise<ListingPromotion> {
  if (!env.deepseekApiKey) {
    return fallbackPromotion(listing, channels);
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
        temperature: 0.35,
        messages: [
          { role: "system", content: promotionSystemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              selected_channels: channels,
              ...formatListingForPrompt(listing, instruction)
            })
          }
        ]
      })
    });

    if (!response.ok) {
      return fallbackPromotion(listing, channels);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return fallbackPromotion(listing, channels);
    }

    const parsed = listingPromotionSchema.safeParse(JSON.parse(extractJsonObject(content)));

    return parsed.success ? filterCardsByChannel(parsed.data, channels) : fallbackPromotion(listing, channels);
  } catch {
    return fallbackPromotion(listing, channels);
  }
}
