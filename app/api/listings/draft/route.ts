import { NextResponse } from "next/server";
import { recordProductAnalyticsEvent } from "@/lib/analytics/server-events";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import type { ListingMediaRecord, ListingRecord } from "@/lib/listings/types";
import { listingDeleteSchema, listingDraftInputSchema, listingDraftUpdateSchema } from "@/lib/listings/types";
import { createServiceClient } from "@/lib/supabase/server";

const listingSelect =
  "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at";

const listingWithMediaSelect = `${listingSelect}, listing_media(id, listing_id, media_type, storage_url, sort_order, created_at)`;

type RawListingRecord = Omit<ListingRecord, "media"> & {
  listing_media?: ListingMediaRecord[] | null;
};

async function attachSignedMediaUrls(listings: RawListingRecord[]) {
  const service = createServiceClient();

  return Promise.all(
    listings.map(async ({ listing_media: mediaRows, ...listing }) => {
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

export async function GET() {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { data: listings, error } = await supabase
      .from("listings")
      .select(listingWithMediaSelect)
      .eq("broker_id", broker.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const listingsWithMedia = await attachSignedMediaUrls((listings ?? []) as RawListingRecord[]);

    return NextResponse.json({ listings: listingsWithMedia });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = listingDraftInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing draft payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();

    const { data: listing, error } = await supabase
      .from("listings")
      .insert({
        ...parsed.data,
        broker_id: broker.id,
        status: "draft"
      })
      .select(listingSelect)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "create_listing_draft",
      entity_type: "listing",
      entity_id: listing.id,
      after_payload: listing,
      metadata: {
        source: "api"
      }
    });

    await recordProductAnalyticsEvent(supabase, {
      authUserId: broker.auth_user_id,
      brokerId: broker.id,
      eventName: "listing_created",
      metadata: {
        listing_id: listing.id,
        status: listing.status
      },
      request
    });

    return NextResponse.json({ listing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = listingDraftUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing update payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { id, ...changes } = parsed.data;

    const { data: existingListing, error: readError } = await supabase
      .from("listings")
      .select(listingSelect)
      .eq("id", id)
      .eq("broker_id", broker.id)
      .single();

    if (readError || !existingListing) {
      return NextResponse.json({ error: readError?.message ?? "Listing not found" }, { status: 404 });
    }

    const { data: listing, error } = await supabase
      .from("listings")
      .update({
        ...changes,
        updated_at: new Date().toISOString(),
        published_at: changes.status === "published" ? new Date().toISOString() : undefined
      })
      .eq("id", id)
      .eq("broker_id", broker.id)
      .select(listingSelect)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: error?.message ?? "Listing not found" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "update_listing_draft",
      entity_type: "listing",
      entity_id: listing.id,
      before_payload: existingListing,
      after_payload: listing,
      metadata: {
        source: "api"
      }
    });

    return NextResponse.json({ listing });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = listingDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing delete payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { data: existingListing, error: readError } = await supabase
      .from("listings")
      .select(listingWithMediaSelect)
      .eq("id", parsed.data.id)
      .eq("broker_id", broker.id)
      .single();

    if (readError || !existingListing) {
      return NextResponse.json({ error: readError?.message ?? "Listing not found" }, { status: 404 });
    }

    const rawListing = existingListing as RawListingRecord;
    const storagePaths = (rawListing.listing_media ?? [])
      .map((media) => media.storage_url)
      .filter(Boolean);

    if (storagePaths.length) {
      const service = createServiceClient();
      const { error: storageError } = await service.storage.from("listing-media").remove(storagePaths);
      if (storageError) {
        return NextResponse.json({ error: storageError.message }, { status: 500 });
      }
    }

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", parsed.data.id)
      .eq("broker_id", broker.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "delete_listing",
      entity_type: "listing",
      entity_id: rawListing.id,
      before_payload: rawListing,
      metadata: {
        media_count: storagePaths.length,
        source: "api"
      }
    });

    return NextResponse.json({ deleted: true, id: rawListing.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
