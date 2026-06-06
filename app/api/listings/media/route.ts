import { NextResponse } from "next/server";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { createServiceClient } from "@/lib/supabase/server";

const bucketName = "listing-media";
const maxImageBytes = 12 * 1024 * 1024;
const maxVideoBytes = 120 * 1024 * 1024;

function getSafeExtension(fileName: string, fallback: string) {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || fallback;
}

function getMediaType(file: File) {
  if (file.type.startsWith("image/")) {
    return "image" as const;
  }

  if (file.type.startsWith("video/")) {
    return "video" as const;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const formData = await request.formData();
    const listingId = formData.get("listing_id");
    const file = formData.get("file");

    if (typeof listingId !== "string" || !listingId) {
      return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing media file" }, { status: 400 });
    }

    const mediaType = getMediaType(file);
    if (!mediaType) {
      return NextResponse.json({ error: "Only image and video uploads are supported" }, { status: 400 });
    }

    const maxBytes = mediaType === "image" ? maxImageBytes : maxVideoBytes;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `${mediaType === "image" ? "Image" : "Video"} file is too large` },
        { status: 400 }
      );
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("broker_id", broker.id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const service = createServiceClient();
    const extension = getSafeExtension(file.name, mediaType === "image" ? "jpg" : "mp4");
    const storagePath = `${broker.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await service.storage.from(bucketName).upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: media, error: mediaError } = await supabase
      .from("listing_media")
      .insert({
        listing_id: listingId,
        broker_id: broker.id,
        media_type: mediaType,
        storage_url: storagePath
      })
      .select("id, listing_id, media_type, storage_url, sort_order, created_at")
      .single();

    if (mediaError || !media) {
      await service.storage.from(bucketName).remove([storagePath]);
      return NextResponse.json({ error: mediaError?.message ?? "Unable to save media" }, { status: 500 });
    }

    const { data: signedUrlData } = await service.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 60 * 60);

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "upload_listing_media",
      entity_type: "listing_media",
      entity_id: media.id,
      after_payload: media,
      metadata: {
        listing_id: listingId,
        media_type: mediaType,
        file_size: file.size,
        content_type: file.type
      }
    });

    return NextResponse.json({
      media: {
        ...media,
        signed_url: signedUrlData?.signedUrl ?? null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
