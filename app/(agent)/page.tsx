import { redirect } from "next/navigation";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { ProfileCompletionForm } from "@/components/profile/ProfileCompletionForm";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getAgentChatMessages } from "@/lib/agent/conversations";
import { getLeadsByIdsForBroker, getRecentLeadsForBroker } from "@/lib/leads/queries";
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
  phone: string | null;
  preferred_language: string | null;
};

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RawListingRecord = Omit<ListingRecord, "media"> & {
  listing_media?: ListingMediaRecord[] | null;
};

function getFirstName(profile: BrokerProfile) {
  return profile.full_name?.trim().split(/\s+/)[0] || "Broker";
}

function getInitials(profile: BrokerProfile) {
  const source = profile.full_name || profile.email || "Pislaka Broker";
  return source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isProfileComplete(profile: BrokerProfile) {
  return Boolean(profile.full_name?.trim() && profile.city?.trim() && profile.agency_name?.trim());
}

function getSearchParamValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatListingPrice(listing: ListingRecord) {
  if (!listing.price_amount) {
    return "Price not set";
  }

  const crore = listing.price_amount / 10000000;
  if (crore >= 1) {
    return `${listing.price_currency ?? "PKR"} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${listing.price_currency ?? "PKR"} ${listing.price_amount.toLocaleString("en-PK")}`;
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

  const { data: existingProfile, error: profileError } = await supabase
    .from("broker_profiles")
    .select("id, auth_user_id, full_name, email, city, agency_name, phone, preferred_language")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (existingProfile) {
    return { supabase, broker: existingProfile as BrokerProfile };
  }

  const { data: createdProfile, error: insertError } = await supabase
    .from("broker_profiles")
    .insert({
      auth_user_id: user.id,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      email: user.email ?? null
    })
    .select("id, auth_user_id, full_name, email, city, agency_name, phone, preferred_language")
    .single();

  if (insertError || !createdProfile) {
    throw new Error(insertError?.message ?? "Unable to create broker profile");
  }

  return { supabase, broker: createdProfile as BrokerProfile };
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

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { supabase, broker } = await getCurrentBrokerContext();
  const [listings, leads, chatHistory] = await Promise.all([
    getListingsForBroker(supabase, broker.id),
    getRecentLeadsForBroker(supabase, broker.id, 100),
    getAgentChatMessages(supabase, broker.id, { limit: 50 })
  ]);
  const selectedListingId = getSearchParamValue(resolvedSearchParams, "listing");
  const selectedLeadId = getSearchParamValue(resolvedSearchParams, "lead");
  const importMode = getSearchParamValue(resolvedSearchParams, "import");
  const selectedLeadIds = [
    selectedLeadId,
    ...(getSearchParamValue(resolvedSearchParams, "leads") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  ].filter((item): item is string => Boolean(item));
  const exactSelectedLeads = await getLeadsByIdsForBroker(supabase, broker.id, selectedLeadIds);
  const leadsById = new Map([...leads, ...exactSelectedLeads].map((lead) => [lead.id, lead]));
  const allLeads = Array.from(leadsById.values());
  const selectedListing = selectedListingId
    ? listings.find((listing) => listing.id === selectedListingId)
    : null;
  const selectedLeads = selectedLeadIds.length
    ? selectedLeadIds.map((id) => leadsById.get(id)).filter((lead): lead is NonNullable<typeof lead> => Boolean(lead))
    : [];
  const selectedLeadAttachments = selectedLeads.map((selectedLead) => ({
    id: `lead:${selectedLead.id}`,
    type: "lead" as const,
    entity_id: selectedLead.id,
    label: selectedLead.full_name || selectedLead.phone || selectedLead.email || "Unnamed buyer",
    summary: [
      selectedLead.status,
      [selectedLead.listing_title, selectedLead.listing_area, selectedLead.listing_city]
        .filter(Boolean)
        .join(", ") || null,
      selectedLead.phone || null
    ]
      .filter(Boolean)
      .join(" · "),
    snapshot: {
      status: selectedLead.status,
      urgency: selectedLead.urgency,
      full_name: selectedLead.full_name,
      phone: selectedLead.phone,
      email: selectedLead.email,
      listing_title: selectedLead.listing_title,
      listing_area: selectedLead.listing_area,
      listing_city: selectedLead.listing_city
    }
  }));
  const initialContextAttachments = [
    selectedListing
      ? {
          id: `listing:${selectedListing.id}`,
          type: "listing" as const,
          entity_id: selectedListing.id,
          label: selectedListing.title || "Untitled listing",
          summary: [
            [selectedListing.area_value, selectedListing.area_unit].filter(Boolean).join(" ") || null,
            [selectedListing.location_area, selectedListing.city].filter(Boolean).join(", ") || null,
            formatListingPrice(selectedListing),
            selectedListing.media?.length
              ? `${selectedListing.media.length} media file${selectedListing.media.length === 1 ? "" : "s"}`
              : null
          ]
            .filter(Boolean)
            .join(" · "),
          snapshot: {
            status: selectedListing.status,
            title: selectedListing.title,
            location_area: selectedListing.location_area,
            city: selectedListing.city,
            property_type: selectedListing.property_type,
            listing_type: selectedListing.listing_type,
            price_amount: selectedListing.price_amount,
            price_currency: selectedListing.price_currency,
            media_count: selectedListing.media?.length ?? 0
          },
          media: selectedListing.media
            ?.filter((media) => media.signed_url)
            .slice(0, 3)
            .map((media, index) => ({
              id: media.id,
              name: `Listing media ${index + 1}`,
              previewUrl: media.signed_url ?? "",
              mediaType: media.media_type
            }))
        }
      : null,
    ...selectedLeadAttachments
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const firstName = getFirstName(broker);
  const profileComplete = isProfileComplete(broker);
  const newLeadsCount = leads.filter((lead) => lead.status === "new").length;

  return (
    <WorkspaceShell
      active="agent"
      broker={broker}
      initials={getInitials(broker)}
      leadsCount={newLeadsCount}
      listingsCount={listings.length}
    >
        {!profileComplete ? <ProfileCompletionForm profile={broker} /> : null}

        <div className="workspace-agent-grid workspace-agent-only">
          <AgentWorkspace
            conversationId={chatHistory.conversationId}
            firstName={firstName}
            hasOlderMessages={chatHistory.hasMore}
            initialWhatsAppImportOpen={importMode === "whatsapp"}
            initialContextAttachments={initialContextAttachments}
            initialMessages={chatHistory.messages}
            recentLeads={allLeads}
            recentListings={listings.map((listing) => ({
              id: listing.id,
              status: listing.status,
              title: listing.title,
              description: listing.description,
              location_area: listing.location_area,
              city: listing.city,
              property_type: listing.property_type,
              listing_type: listing.listing_type,
              price_amount: listing.price_amount,
              price_currency: listing.price_currency,
              area_value: listing.area_value,
              area_unit: listing.area_unit,
              bedrooms: listing.bedrooms,
              bathrooms: listing.bathrooms,
              features: listing.features,
              media: listing.media
            }))}
          />
        </div>
    </WorkspaceShell>
  );
}
