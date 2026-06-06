import { BarChart3, List, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingDraftsPanel } from "@/components/listings/ListingDraftsPanel";
import { MobileTabBar } from "@/components/workspace/MobileTabBar";
import { SignOutButton } from "@/components/workspace/SignOutButton";
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
    .limit(50);

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

export default async function ListingsPage() {
  const { supabase, broker } = await getCurrentBrokerContext();
  const [listings, leads] = await Promise.all([
    getListingsForBroker(supabase, broker.id),
    getRecentLeadsForBroker(supabase, broker.id, 100)
  ]);
  const newLeadsCount = leads.filter((lead) => lead.status === "new").length;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="logo">Pislaka Agent</div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-menu">
          <Link className="nav-item" href="/">
            <span>
              <Sparkles size={18} /> AI Assistant
            </span>
          </Link>
          <div className="nav-label embedded">Structured Data</div>
          <Link className="nav-item active" href="/listings">
            <span>
              <List size={18} /> Listings
            </span>
            <strong>{listings.length}</strong>
          </Link>
          <Link className="nav-item" href="/leads">
            <span>
              <Users size={18} /> Leads
            </span>
            <strong className="urgent">{newLeadsCount}</strong>
          </Link>
          <a className="nav-item" href="#">
            <span>
              <BarChart3 size={18} /> Analytics
            </span>
          </a>
        </nav>
        <div className="profile">
          <div className="avatar">{getInitials(broker)}</div>
          <div>
            <strong>{broker.full_name || broker.email || "Pislaka Broker"}</strong>
            <small>
              {broker.agency_name ? `${broker.agency_name}, ` : ""}
              {broker.city || "Pakistan"}
            </small>
          </div>
        </div>
      </aside>
      <MobileTabBar active="listings" listingsCount={listings.length} leadsCount={newLeadsCount} />

      <section className="workspace library-page">
        <header className="topbar library-topbar">
          <div className="greeting">
            <div>
              <h1>Listings</h1>
              <p>Review confirmed drafts, edit details, and attach property media.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="outline-button" href="/">
              Back to Agent Workspace
            </Link>
            <SignOutButton />
          </div>
        </header>

        <ListingDraftsPanel className="library-page-panel" listings={listings} />
      </section>
    </main>
  );
}
