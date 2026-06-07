import { redirect } from "next/navigation";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { ProfileCompletionForm } from "@/components/profile/ProfileCompletionForm";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getAgentChatMessages } from "@/lib/agent/conversations";
import { getRecentLeadsForBroker } from "@/lib/leads/queries";
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
      const media = await Promise.all(
        (mediaRows ?? []).map(async (mediaRow) => {
          const { data: signedUrlData } = await service.storage
            .from("listing-media")
            .createSignedUrl(mediaRow.storage_url, 60 * 60);

          return {
            ...mediaRow,
            signed_url: signedUrlData?.signedUrl ?? null
          };
        })
      );

      return {
        ...listing,
        media: media.sort((left, right) => left.sort_order - right.sort_order)
      } as ListingRecord;
    })
  );
}

export default async function Home() {
  const { supabase, broker } = await getCurrentBrokerContext();
  const [listings, leads, chatHistory] = await Promise.all([
    getListingsForBroker(supabase, broker.id),
    getRecentLeadsForBroker(supabase, broker.id, 5),
    getAgentChatMessages(supabase, broker.id, { limit: 50 })
  ]);
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
            initialMessages={chatHistory.messages}
            recentLeads={leads}
            recentListings={listings.map((listing) => ({
              id: listing.id,
              title: listing.title,
              location_area: listing.location_area,
              city: listing.city,
              property_type: listing.property_type,
              area_value: listing.area_value,
              area_unit: listing.area_unit,
              bedrooms: listing.bedrooms
            }))}
          />
        </div>
    </WorkspaceShell>
  );
}
