import { env, requireServerEnv } from "@/lib/env";
import { listingPromotionSchema, type ListingPromotion, type PromotionChannel } from "@/lib/promotions/types";

export type SocialCopyListingInput = {
  title?: string | null;
  description?: string | null;
  city?: string | null;
  location_area?: string | null;
  property_type?: string | null;
  listing_type?: "sale" | "rent" | string | null;
  price_amount?: number | null;
  price_currency?: string | null;
  price_label?: string | null;
  area_value?: number | null;
  area_unit?: "kanal" | "marla" | "sqft" | "sqm" | string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  features?: string[] | null;
  source_notes?: string[];
};

const socialCopyRequestTimeoutMs = 12000;
const styleNames = ["Direct buyer", "Premium", "Short broadcast"] as const;
const forbiddenUngroundedClaims = [
  "prime",
  "rare",
  "exclusive",
  "prestigious",
  "family ideal",
  "ideal for family",
  "family home",
  "limited availability",
  "direct deal",
  "secure community",
  "ready possession",
  "investment opportunity",
  "don't miss out",
  "sought-after",
  "great opportunity",
  "elegance",
  "aerial"
];

const socialCopySystemPrompt = `
You are Pislaka Agent's real estate social copywriter for brokers in Pakistan.
Return only JSON. Do not return markdown.

Create broker-ready property promotion copy. This is content generation, not campaign link generation.

Output shape:
{
  "summary": "One plain sentence asking whether the broker wants dedicated tracking links after choosing copy.",
  "cards": [
    {
      "channel": "whatsapp",
      "title": "Direct buyer WhatsApp draft",
      "body": "Channel-ready text",
      "cta": "Reply for details.",
      "image_brief": "Which image/video style should accompany this post"
    }
  ]
}

Hard rules:
- Return exactly 3 cards for each selected channel: Direct buyer, Premium, and Short broadcast.
- Use the selected channel in each title.
- Use every important listing fact that is provided: size, property type, listing type, location_area, city, price/demand, bedrooms, bathrooms, and distinctive features.
- If price or demand is provided, include it clearly. Never write "price to be confirmed" when price is known.
- For sale listings in Pakistan, prefer the label "Demand" for the price unless the broker asks for another label.
- Do not invent facts, amenities, floor counts, payment plans, ownership status, or availability claims.
- Forbidden unless explicitly provided by the input: prime, rare, exclusive, prestigious, family ideal, ideal for family, family home, limited availability, direct deal, secure community, ready possession, investment opportunity, don't miss out, sought-after, great opportunity, elegance, aerial.
- When facts are sparse, do not fill the gap with generic hype. Stay grounded in size, property type, listing type, area, city, demand, and the next step.
- Do not use emojis unless the broker explicitly asks for an emoji-heavy post.
- Do not include tracking links, landing page links, URLs, or campaign codes.
- Keep English copy by default and use Pakistan real estate terms naturally.
- Keep WhatsApp easy to forward, Facebook more descriptive and trust-building, Instagram visual and concise with tasteful hashtags, and portal factual/searchable.
- Write polished broker copy with natural grammar. Avoid awkward phrases like "Replying for more details".
- Avoid dry placeholder language like "Property details from the broker's message".
- The summary must be plain follow-up text, not part of the card.

Sparse fact example:
Input: 1 kanal house, DHA Phase 6, Lahore, sale, PKR 8.5 Crore.
Good: "1 kanal house for sale in DHA Phase 6, Lahore. Demand: PKR 8.5 Crore. Reply for details or viewing time."
Bad: "Prime family home, limited availability, secure community, don't miss out."
`;

function formatPrice(input: SocialCopyListingInput) {
  if (input.price_label) {
    return input.price_label;
  }

  if (!input.price_amount) {
    return null;
  }

  const currency = input.price_currency ?? "PKR";
  const crore = input.price_amount / 10000000;
  if (crore >= 1) {
    return `${currency} ${Number(crore.toFixed(2)).toString()} Crore`;
  }

  const lakh = input.price_amount / 100000;
  if (lakh >= 1) {
    return `${currency} ${Number(lakh.toFixed(2)).toString()} Lakh`;
  }

  return `${currency} ${input.price_amount.toLocaleString("en-PK")}`;
}

function formatListingType(input: SocialCopyListingInput) {
  if (input.listing_type === "rent") {
    return "for rent";
  }

  if (input.listing_type === "sale") {
    return "for sale";
  }

  return "available";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPropertyLabel(input: SocialCopyListingInput) {
  return [
    input.area_value && input.area_unit ? `${input.area_value} ${input.area_unit}` : null,
    input.property_type ? titleCase(input.property_type) : "Property"
  ]
    .filter(Boolean)
    .join(" ");
}

function formatLocation(input: SocialCopyListingInput) {
  return [input.location_area, input.city].filter(Boolean).join(", ");
}

function formatListingForPrompt(input: SocialCopyListingInput, instruction: string | undefined) {
  return {
    broker_instruction: instruction,
    title: input.title,
    description: input.description,
    city: input.city,
    location_area: input.location_area,
    property_type: input.property_type,
    listing_type: input.listing_type,
    price_amount: input.price_amount,
    price_currency: input.price_currency ?? "PKR",
    price_label: formatPrice(input),
    area_value: input.area_value,
    area_unit: input.area_unit,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    features: input.features ?? [],
    source_notes: input.source_notes ?? []
  };
}

function filterCardsByChannel(promotion: ListingPromotion, channels: PromotionChannel[]) {
  const selected = new Set(channels);

  return {
    ...promotion,
    cards: promotion.cards.filter((card) => selected.has(card.channel))
  };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Social copy response was not a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function hasUngroundedClaim(promotion: ListingPromotion, input: SocialCopyListingInput, instruction?: string) {
  const allowedText = JSON.stringify({ input, instruction }).toLowerCase();
  const outputText = promotion.cards
    .map((card) => [card.title, card.body, card.cta, card.image_brief].join(" "))
    .join(" ")
    .toLowerCase();

  return forbiddenUngroundedClaims.some(
    (claim) => outputText.includes(claim) && !allowedText.includes(claim)
  );
}

function channelLabel(channel: PromotionChannel) {
  if (channel === "whatsapp") {
    return "WhatsApp";
  }
  if (channel === "facebook") {
    return "Facebook";
  }
  if (channel === "instagram") {
    return "Instagram";
  }
  return "Portal";
}

function channelCta(channel: PromotionChannel) {
  if (channel === "instagram") {
    return "DM for details.";
  }
  if (channel === "portal") {
    return "Contact for viewing.";
  }
  return "Reply for details.";
}

export function buildFallbackSocialCopyPromotion(
  input: SocialCopyListingInput,
  channels: PromotionChannel[] = ["whatsapp"],
  instruction = ""
): ListingPromotion {
  const selectedChannels = channels.length ? channels : (["whatsapp"] as PromotionChannel[]);
  const propertyLabel = formatPropertyLabel(input);
  const location = formatLocation(input);
  const listingType = formatListingType(input);
  const price = formatPrice(input);
  const roomLine = [
    input.bedrooms !== null && input.bedrooms !== undefined ? `${input.bedrooms} beds` : null,
    input.bathrooms !== null && input.bathrooms !== undefined ? `${input.bathrooms} baths` : null
  ]
    .filter(Boolean)
    .join(" | ");
  const featureLine = input.features?.length ? `Features: ${input.features.join(", ")}` : null;
  const opening = [propertyLabel, listingType, location ? `in ${location}` : ""].filter(Boolean).join(" ");
  const demand = price ? `Demand: ${price}` : null;

  return {
    summary:
      "Want dedicated tracking links and attribution? Save this as a promotion asset/listing first, then I can generate link tracking.",
    cards: selectedChannels.flatMap((channel) => {
      const label = channelLabel(channel);
      const cta = channelCta(channel);
      const hashtagLine =
        channel === "instagram" ? "\n#LahoreProperty #PakistanRealEstate #Pislaka" : "";

      return styleNames.map((style) => {
        const title = `${style} ${label} draft`;
        const directBody = [
          `${opening}.`,
          demand,
          roomLine || null,
          featureLine,
          "Interested buyers can reply for details, pictures, or a viewing time."
        ]
          .filter(Boolean)
          .join("\n\n");
        const premiumBody = [
          `${propertyLabel} ${listingType}${location ? ` in ${location}` : ""}.`,
          demand,
          roomLine || featureLine ? [roomLine, featureLine].filter(Boolean).join(" | ") : null,
          "A clear option for serious buyers who want location clarity before arranging a viewing."
        ]
          .filter(Boolean)
          .join("\n\n");
        const shortBody = [
          `${propertyLabel} ${listingType}${location ? ` - ${location}` : ""}`,
          demand,
          channel === "instagram" ? `DM for pictures and viewing.${hashtagLine}` : "Reply for details and viewing."
        ]
          .filter(Boolean)
          .join("\n");

        return {
          channel,
          title,
          body: style === "Premium" ? premiumBody : style === "Short broadcast" ? shortBody : directBody,
          cta,
          image_brief: instruction.toLowerCase().includes("video")
            ? "Use the strongest short walkthrough or cleanest property clip."
            : "Use the clearest property image or listing preview."
        };
      });
    })
  };
}

export async function generateSocialCopyPromotion(
  input: SocialCopyListingInput,
  instruction?: string,
  channels: PromotionChannel[] = ["whatsapp"]
): Promise<ListingPromotion> {
  const selectedChannels = channels.length ? channels : (["whatsapp"] as PromotionChannel[]);

  if (!env.deepseekApiKey) {
    return buildFallbackSocialCopyPromotion(input, selectedChannels, instruction);
  }

  const apiKey = requireServerEnv("deepseekApiKey");
  const requestSocialCopy = async (revisionInstruction?: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), socialCopyRequestTimeoutMs);

    try {
      const response = await fetch(`${env.deepseekBaseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.deepseekModel,
          response_format: { type: "json_object" },
          temperature: 0.55,
          messages: [
            { role: "system", content: socialCopySystemPrompt },
            {
              role: "user",
              content: JSON.stringify({
                selected_channels: selectedChannels,
                required_styles: styleNames,
                revision_instruction: revisionInstruction,
                listing: formatListingForPrompt(input, instruction)
              })
            }
          ]
        })
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;

      if (typeof content !== "string") {
        return null;
      }

      const parsed = listingPromotionSchema.safeParse(JSON.parse(extractJsonObject(content)));
      if (!parsed.success) {
        return null;
      }

      const filtered = filterCardsByChannel(parsed.data, selectedChannels);
      const expectedCardCount = selectedChannels.length * styleNames.length;

      return filtered.cards.length === expectedCardCount && !hasUngroundedClaim(filtered, input, instruction)
        ? filtered
        : null;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const firstDraft = await requestSocialCopy();
    if (firstDraft) {
      return firstDraft;
    }

    const repairedDraft = await requestSocialCopy(
      "Rewrite the copy using only explicit listing facts. Remove all ungrounded hype, forbidden claims, awkward grammar, emojis, invented photo details, and generic filler. Keep the copy polished but factual."
    );

    return repairedDraft ?? buildFallbackSocialCopyPromotion(input, selectedChannels, instruction);
  } catch {
    return buildFallbackSocialCopyPromotion(input, selectedChannels, instruction);
  }
}
