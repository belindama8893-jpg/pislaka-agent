import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LeadCaptureForm } from "@/components/public/LeadCaptureForm";
import type { ListingMediaRecord, ListingRecord } from "@/lib/listings/types";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CampaignLinkRecord = {
  id: string;
  code: string;
  channel: string;
  listing_id: string;
  broker_id: string;
};

function formatPrice(listing: ListingRecord) {
  if (!listing.price_amount) {
    return "Price on request";
  }

  const crore = listing.price_amount / 10000000;
  if (crore >= 1) {
    return `${listing.price_currency ?? "PKR"} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${listing.price_currency ?? "PKR"} ${listing.price_amount.toLocaleString("en-PK")}`;
}

function formatChannel(channel: string) {
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    instagram: "Instagram",
    portal: "Property Portal",
    direct: "Direct Link"
  };

  return labels[channel] ?? channel;
}

export default async function PublicListingPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const service = createServiceClient();
  const requestHeaders = await headers();

  const { data: campaignLink, error: campaignError } = await service
    .from("campaign_links")
    .select("id, code, channel, listing_id, broker_id")
    .eq("code", code)
    .single();

  if (campaignError || !campaignLink) {
    notFound();
  }

  const campaign = campaignLink as CampaignLinkRecord;
  const { data: listing, error: listingError } = await service
    .from("listings")
    .select(
      "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at"
    )
    .eq("id", campaign.listing_id)
    .single();

  if (listingError || !listing) {
    notFound();
  }

  const { data: mediaRows } = await service
    .from("listing_media")
    .select("id, listing_id, media_type, storage_url, sort_order, created_at")
    .eq("listing_id", campaign.listing_id)
    .order("sort_order", { ascending: true });

  const media = await Promise.all(
    ((mediaRows ?? []) as ListingMediaRecord[]).map(async (mediaRow) => {
      const { data: signedUrlData } = await service.storage
        .from("listing-media")
        .createSignedUrl(mediaRow.storage_url, 60 * 60);

      return {
        ...mediaRow,
        signed_url: signedUrlData?.signedUrl ?? null
      };
    })
  );

  await service.from("click_events").insert({
    campaign_link_id: campaign.id,
    listing_id: campaign.listing_id,
    broker_id: campaign.broker_id,
    channel: campaign.channel,
    user_agent: requestHeaders.get("user-agent"),
    referrer: requestHeaders.get("referer")
  });

  const listingRecord = listing as ListingRecord;
  const heroMedia = media[0];
  const galleryMedia = media.slice(heroMedia ? 1 : 0, 7);
  const channelLabel = formatChannel(campaign.channel);
  const location = [listingRecord.location_area, listingRecord.city].filter(Boolean).join(", ");
  const area = [listingRecord.area_value, listingRecord.area_unit].filter(Boolean).join(" ");

  return (
    <main className="public-listing-page">
      <section className="public-listing-shell">
        <div className="public-listing-main">
          {heroMedia?.signed_url ? (
            <div className="public-listing-media">
              {heroMedia.media_type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={heroMedia.signed_url} />
              ) : (
                <video controls muted playsInline src={heroMedia.signed_url} />
              )}
            </div>
          ) : null}

          <div className="public-listing-details">
            <div className="public-source-row">
              <span className="status-pill">{channelLabel}</span>
              <span>Verified broker inquiry page</span>
            </div>
            <h1>{listingRecord.title || "Property listing"}</h1>
            <p>{listingRecord.description || "Contact the broker for complete property details and viewing availability."}</p>
            <div className="public-listing-facts">
              <span>{formatPrice(listingRecord)}</span>
              <span>{location || "Location not set"}</span>
              <span>{area || "Area not set"}</span>
              <span>
                {listingRecord.bedrooms ?? "-"} beds / {listingRecord.bathrooms ?? "-"} baths
              </span>
            </div>
            {listingRecord.features?.length ? (
              <div className="public-feature-list">
                {listingRecord.features.slice(0, 6).map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>
            ) : null}
          </div>

          {galleryMedia.length ? (
            <div className="public-media-grid">
              {galleryMedia.map((item) => (
                <div className="public-media-thumb" key={item.id}>
                  {item.signed_url && item.media_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={item.signed_url} />
                  ) : item.signed_url && item.media_type === "video" ? (
                    <video muted playsInline src={item.signed_url} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="public-lead-panel">
          <span className="lead-panel-eyebrow">{channelLabel} inquiry</span>
          <h2>Contact the broker</h2>
          <p>Share your WhatsApp number to request details, confirm availability, or arrange a viewing.</p>
          <LeadCaptureForm campaignCode={campaign.code} />
        </aside>
      </section>
    </main>
  );
}
