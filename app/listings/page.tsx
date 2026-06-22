import { redirect } from "next/navigation";
import { ListingDraftsPanel } from "@/components/listings/ListingDraftsPanel";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getSupabaseUserSafely } from "@/lib/auth/safe-user";
import { getNewLeadsCountForBroker } from "@/lib/leads/queries";
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
  const { user, error: userError } = await getSupabaseUserSafely(supabase);

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

async function getListingsForBroker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  brokerId: string
) {
  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at, listing_media(id, listing_id, media_type, storage_url, sort_order, created_at)"
    )
    .eq("broker_id", brokerId)
    .order("updated_at", { ascending: false })
    .limit(20);

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

export default async function ListingsPage() {
  const { supabase, broker } = await getCurrentBrokerContext();
  const [listings, newLeadsCount] = await Promise.all([
    getListingsForBroker(supabase, broker.id),
    getNewLeadsCountForBroker(supabase, broker.id)
  ]);

  return (
    <WorkspaceShell
      active="listings"
      broker={broker}
      initials={getInitials(broker)}
      leadsCount={newLeadsCount}
      subtitle="Review confirmed drafts, edit property facts, and attach photos or video."
      title="Listings"
    >
      <ListingDraftsPanel className="library-page-panel" listings={listings} />
    </WorkspaceShell>
  );
}
