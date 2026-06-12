import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getNewLeadsCountForBroker } from "@/lib/leads/queries";
import type { ListingRecord } from "@/lib/listings/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BrokerProfile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  city: string | null;
  agency_name: string | null;
};

type ListingDetailRouteProps = {
  params: Promise<{
    id: string;
  }>;
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

function formatPrice(listing: ListingRecord) {
  if (!listing.price_amount) {
    return "Price not set";
  }

  const crore = listing.price_amount / 10000000;
  if (crore >= 1) {
    return `${listing.price_currency ?? "PKR"} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${listing.price_currency ?? "PKR"} ${listing.price_amount.toLocaleString("en-PK")}`;
}

function formatArea(listing: ListingRecord) {
  if (!listing.area_value) {
    return "Area not set";
  }

  return `${listing.area_value} ${listing.area_unit ?? ""}`.trim();
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

export default async function ListingDetailPage({ params }: ListingDetailRouteProps) {
  const { id } = await params;
  const { supabase, broker } = await getCurrentBrokerContext();
  const [{ data: listing, error }, newLeadsCount] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at"
      )
      .eq("id", id)
      .eq("broker_id", broker.id)
      .maybeSingle(),
    getNewLeadsCountForBroker(supabase, broker.id)
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (!listing) {
    notFound();
  }

  const listingRecord = listing as ListingRecord;
  const location = [listingRecord.location_area, listingRecord.city].filter(Boolean).join(", ") || "Location not set";

  return (
    <WorkspaceShell
      active="listings"
      broker={broker}
      initials={getInitials(broker)}
      leadsCount={newLeadsCount}
    >
      <article className="listing-detail-page">
        <div className="lead-profile-back">
          <Link className="outline-button small" href="/listings">
            ← Listings
          </Link>
        </div>
        <section className="lead-profile-section">
          <div className="listing-detail-heading">
            <div>
              <span>{listingRecord.status}</span>
              <h2>{listingRecord.title || "Untitled listing"}</h2>
              <p>{location}</p>
            </div>
            <strong>{formatPrice(listingRecord)}</strong>
          </div>
          <div className="listing-detail-facts">
            <div>
              <span>Type</span>
              <strong>{[listingRecord.property_type, listingRecord.listing_type].filter(Boolean).join(" · ") || "Not set"}</strong>
            </div>
            <div>
              <span>Area</span>
              <strong>{formatArea(listingRecord)}</strong>
            </div>
            <div>
              <span>Beds / Baths</span>
              <strong>
                {listingRecord.bedrooms ?? "-"} beds · {listingRecord.bathrooms ?? "-"} baths
              </strong>
            </div>
          </div>
          <div className="listing-detail-copy">
            <h3>Description</h3>
            <p>{listingRecord.description || "No description yet."}</p>
          </div>
          {listingRecord.features?.length ? (
            <div className="listing-detail-copy">
              <h3>Features</h3>
              <p>{listingRecord.features.join(", ")}</p>
            </div>
          ) : null}
        </section>
      </article>
    </WorkspaceShell>
  );
}
