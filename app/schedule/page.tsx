import { redirect } from "next/navigation";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getBrokerEventsForBroker } from "@/lib/events/queries";
import { getNewLeadsCountForBroker, getRecentLeadsForBroker } from "@/lib/leads/queries";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";
import type { ListingMediaRecord, ListingRecord } from "@/lib/listings/types";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BrokerProfile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  city: string | null;
  agency_name: string | null;
};

type RawListingRecord = Omit<ListingRecord, "media"> & {
  listing_media?: ListingMediaRecord[] | null;
};

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

function getInitials(profile: BrokerProfile) {
  const source = profile.full_name || profile.email || "Pislaka Broker";
  return source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function getCurrentBrokerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/sign-in");
  }

  const { data: broker, error } = await supabase
    .from("broker_profiles")
    .select("id, auth_user_id, full_name, email, city, agency_name")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !broker) {
    throw new Error(error?.message ?? "Broker profile not found");
  }

  return { supabase, broker: broker as BrokerProfile };
}

async function getScheduleLeadsForBroker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  brokerId: string,
  leadIds: string[]
): Promise<LeadListItem[]> {
  if (!leadIds.length) {
    return [];
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, broker_id, listing_id, campaign_link_id, source_channel, full_name, phone, email, message, status, urgency, ai_summary, created_at, updated_at"
    )
    .eq("broker_id", brokerId)
    .in("id", leadIds);

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

  const listingById = new Map(((listings ?? []) as ListingLookup[]).map((listing) => [listing.id, listing]));
  const campaignById = new Map(((campaigns ?? []) as CampaignLookup[]).map((campaign) => [campaign.id, campaign]));

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

async function getScheduleListingsForBroker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  brokerId: string,
  listingIds: string[],
  includeReferenceLookup = false
): Promise<ListingRecord[]> {
  let query = supabase
    .from("listings")
    .select(
      "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at, listing_media(id, listing_id, media_type, storage_url, sort_order, created_at)"
    )
    .eq("broker_id", brokerId);

  if (listingIds.length && !includeReferenceLookup) {
    query = query.in("id", listingIds);
  } else {
    query = query.order("updated_at", { ascending: false }).limit(80);
  }

  const { data: listings, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const service = createServiceClient();
  const rawListings = (listings ?? []) as RawListingRecord[];

  return Promise.all(
    rawListings.map(async ({ listing_media: mediaRows, ...listing }) => {
      const sortedMediaRows = [...(mediaRows ?? [])].sort((left, right) => left.sort_order - right.sort_order);
      const signedPreviewMedia = await Promise.all(
        sortedMediaRows.slice(0, 6).map(async (mediaRow) => {
          const { data: signedUrlData } = await service.storage
            .from("listing-media")
            .createSignedUrl(mediaRow.storage_url, 60 * 60);

          return {
            ...mediaRow,
            signed_url: signedUrlData?.signedUrl ?? null
          };
        })
      );
      const signedPreviewById = new Map(signedPreviewMedia.map((mediaRow) => [mediaRow.id, mediaRow]));
      const media = sortedMediaRows.map((mediaRow) => signedPreviewById.get(mediaRow.id) ?? mediaRow);

      return {
        ...listing,
        media
      } as ListingRecord;
    })
  );
}

type SchedulePageProps = {
  searchParams?: Promise<{
    event?: string;
  }>;
};

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const resolvedSearchParams = await searchParams;
  const { supabase, broker } = await getCurrentBrokerContext();
  const [leads, newLeadsCount, eventsResult] = await Promise.all([
    getRecentLeadsForBroker(supabase, broker.id, 30),
    getNewLeadsCountForBroker(supabase, broker.id),
    getBrokerEventsForBroker(supabase, broker.id, { status: "all", limit: 40 }).then(
      (events) => ({ events, migrationRequired: false }),
      (error) => ({
        events: [],
        migrationRequired:
          error instanceof Error &&
          /broker_events|does not exist|schema cache|in_app_reminded_at|in_app_reminder_dismissed_at/i.test(error.message)
      })
    )
  ]);
  const events = eventsResult.events;
  const linkedLeadIds = Array.from(new Set(events.map((event) => event.lead_id).filter((id): id is string => Boolean(id))));
  const linkedListingIds = Array.from(
    new Set(events.map((event) => event.listing_id).filter((id): id is string => Boolean(id)))
  );
  const hasReferenceOnlyListings = events.some((event) => !event.listing_id && Boolean(event.listing_reference));
  const [scheduleLeads, scheduleListings] = await Promise.all([
    getScheduleLeadsForBroker(supabase, broker.id, linkedLeadIds),
    getScheduleListingsForBroker(supabase, broker.id, linkedListingIds, hasReferenceOnlyListings)
  ]);
  return (
    <WorkspaceShell
      active="schedule"
      broker={broker}
      initials={getInitials(broker)}
      leadsCount={newLeadsCount}
      subtitle="Manage viewings, follow-ups, signing dates, handovers, and reminders."
      title="Schedule"
    >
      <SchedulePanel
        className="library-page-panel"
        events={events}
        initialEventId={resolvedSearchParams?.event ?? null}
        leads={scheduleLeads}
        listings={scheduleListings}
        migrationRequired={eventsResult.migrationRequired}
      />
    </WorkspaceShell>
  );
}
