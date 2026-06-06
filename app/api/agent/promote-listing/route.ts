import { NextResponse } from "next/server";
import { z } from "zod";
import { generateListingPromotion } from "@/lib/agent/promotions";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { env } from "@/lib/env";
import type { ListingMediaRecord, ListingRecord } from "@/lib/listings/types";
import { promotionChannelSchema, type PromotionCard } from "@/lib/promotions/types";

const promoteListingRequestSchema = z.object({
  listing_id: z.string().uuid(),
  instruction: z.string().max(1000).optional(),
  channels: z.array(promotionChannelSchema).min(1).max(4).optional()
});

type RawListingRecord = Omit<ListingRecord, "media"> & {
  listing_media?: ListingMediaRecord[] | null;
};

function makeCampaignCode(channel: string) {
  const random = crypto.randomUUID().slice(0, 8);
  return `${channel}-${random}`;
}

function makeWhatsAppShareUrl(card: PromotionCard, landingUrl: string) {
  const text = `${card.title}\n\n${card.body}\n\n${card.cta}\n${landingUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = promoteListingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid promotion payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { data: listing, error } = await supabase
      .from("listings")
      .select(
        "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at, listing_media(id, listing_id, media_type, storage_url, sort_order, created_at)"
      )
      .eq("id", parsed.data.listing_id)
      .eq("broker_id", broker.id)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: error?.message ?? "Listing not found" }, { status: 404 });
    }

    const rawListing = listing as RawListingRecord;
    const channels = parsed.data.channels ?? ["whatsapp", "facebook", "instagram", "portal"];
    const promotion = await generateListingPromotion(
      {
        ...rawListing,
        media: (rawListing.listing_media ?? []).sort((left, right) => left.sort_order - right.sort_order)
      },
      parsed.data.instruction,
      channels
    );

    const enrichedCards = await Promise.all(
      promotion.cards.map(async (card) => {
        const code = makeCampaignCode(card.channel);
        const landingUrl = `${env.appUrl}/p/${code}`;
        const generatedCopy = `${card.title}\n\n${card.body}\n\n${card.cta}`;
        const { data: campaignLink, error: campaignError } = await supabase
          .from("campaign_links")
          .insert({
            listing_id: rawListing.id,
            broker_id: broker.id,
            channel: card.channel,
            code,
            destination_url: landingUrl,
            generated_copy: generatedCopy
          })
          .select("code, destination_url")
          .single();

        if (campaignError || !campaignLink) {
          throw new Error(campaignError?.message ?? "Unable to create campaign link");
        }

        return {
          ...card,
          campaign_code: campaignLink.code,
          landing_url: campaignLink.destination_url,
          whatsapp_share_url:
            card.channel === "whatsapp" ? makeWhatsAppShareUrl(card, campaignLink.destination_url) : undefined
        };
      })
    );

    const promotionWithLinks = {
      ...promotion,
      cards: enrichedCards
    };

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "agent",
      action: "generate_listing_promotion",
      entity_type: "listing",
      entity_id: rawListing.id,
      after_payload: promotionWithLinks,
      metadata: {
        source: "agent_promote_listing",
        channel_count: promotionWithLinks.cards.length
      }
    });

    return NextResponse.json({ promotion: promotionWithLinks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
