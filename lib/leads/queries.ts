import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";

type ListingLookup = {
  id: string;
  title: string | null;
  location_area: string | null;
  city: string | null;
};

type CampaignLookup = {
  id: string;
  code: string | null;
  channel: string | null;
};

export async function getRecentLeadsForBroker(
  supabase: SupabaseClient,
  brokerId: string,
  limit = 6,
  options: { includeClosed?: boolean } = {}
): Promise<LeadListItem[]> {
  let query = supabase
    .from("leads")
    .select(
      "id, broker_id, listing_id, campaign_link_id, source_channel, full_name, phone, email, message, status, urgency, ai_summary, created_at, updated_at"
    )
    .eq("broker_id", brokerId);

  if (!options.includeClosed) {
    query = query.neq("status", "closed").neq("status", "lost");
  }

  const { data: leads, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const leadRows = (leads ?? []) as LeadRecord[];
  const listingIds = Array.from(
    new Set(leadRows.map((lead) => lead.listing_id).filter((id): id is string => Boolean(id)))
  );
  const campaignIds = Array.from(
    new Set(leadRows.map((lead) => lead.campaign_link_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: listings }, { data: campaigns }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, title, location_area, city").in("id", listingIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from("campaign_links").select("id, code, channel").in("id", campaignIds)
      : Promise.resolve({ data: [] })
  ]);

  const listingById = new Map(
    ((listings ?? []) as ListingLookup[]).map((listing) => [listing.id, listing])
  );
  const campaignById = new Map(
    ((campaigns ?? []) as CampaignLookup[]).map((campaign) => [campaign.id, campaign])
  );

  return leadRows.map((lead) => {
    const listing = lead.listing_id ? listingById.get(lead.listing_id) : undefined;
    const campaign = lead.campaign_link_id ? campaignById.get(lead.campaign_link_id) : undefined;

    return {
      ...lead,
      listing_title: listing?.title ?? null,
      listing_area: listing?.location_area ?? null,
      listing_city: listing?.city ?? null,
      campaign_code: campaign?.code ?? null,
      campaign_channel: campaign?.channel ?? null
    };
  });
}
