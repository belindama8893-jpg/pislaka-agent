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

function getMediaTypeFromContentType(contentType: string) {
  if (contentType.startsWith("image/")) {
    return "image" as const;
  }

  if (contentType.startsWith("video/")) {
    return "video" as const;
  }

  return null;
}

async function getOwnedListing(
  supabase: Awaited<ReturnType<typeof requireCurrentBroker>>["supabase"],
  brokerId: string,
  listingId: string
) {
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("broker_id", brokerId)
    .single();

  return listingError || !listing ? null : listing;
}

async function createMediaRecord({
  brokerId,
  contentType,
  fileSize,
  listingId,
  mediaType,
  storagePath,
  supabase
}: {
  brokerId: string;
  contentType: string;
  fileSize: number;
  listingId: string;
  mediaType: "image" | "video";
  storagePath: string;
  supabase: Awaited<ReturnType<typeof requireCurrentBroker>>["supabase"];
}) {
  const service = createServiceClient();
  const { data: media, error: mediaError } = await supabase
    .from("listing_media")
    .insert({
      listing_id: listingId,
      broker_id: brokerId,
      media_type: mediaType,
      storage_url: storagePath
    })
    .select("id, listing_id, media_type, storage_url, sort_order, created_at")
    .single();

  if (mediaError || !media) {
    await service.storage.from(bucketName).remove([storagePath]);
    return {
      error: mediaError?.message ?? "Unable to save media",
      media: null,
      signedUrl: null
    };
  }

  const { data: signedUrlData } = await service.storage
    .from(bucketName)
    .createSignedUrl(storagePath, 60 * 60);

  await supabase.from("audit_logs").insert({
    broker_id: brokerId,
    actor_type: "user",
    action: "upload_listing_media",
    entity_type: "listing_media",
    entity_id: media.id,
    after_payload: media,
    metadata: {
      listing_id: listingId,
      media_type: mediaType,
      file_size: fileSize,
      content_type: contentType
    }
  });

  return {
    error: null,
    media,
    signedUrl: signedUrlData?.signedUrl ?? null
  };
}

export async function POST(request: Request) {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as
        | {
            action?: "prepare-upload" | "complete-upload";
            content_type?: string;
            file_name?: string;
            file_size?: number;
            listing_id?: string;
            media_type?: "image" | "video";
            storage_path?: string;
          }
        | null;
      const action = body?.action;
      const listingId = body?.listing_id;

      if (typeof listingId !== "string" || !listingId) {
        return NextResponse.json({ error: "Missing listing_id" }, { status: 400 });
      }

      const listing = await getOwnedListing(supabase, broker.id, listingId);
      if (!listing) {
        return NextResponse.json({ error: "Listing not found" }, { status: 404 });
      }

      if (action === "prepare-upload") {
        const fileName = body?.file_name || "media";
        const fileContentType = body?.content_type ?? "";
        const fileSize = typeof body?.file_size === "number" ? body.file_size : 0;
        const mediaType = getMediaTypeFromContentType(fileContentType);

        if (!mediaType) {
          return NextResponse.json({ error: "Only image and video uploads are supported" }, { status: 400 });
        }

        const maxBytes = mediaType === "image" ? maxImageBytes : maxVideoBytes;
        if (fileSize > maxBytes) {
          return NextResponse.json(
            { error: `${mediaType === "image" ? "Image" : "Video"} file is too large` },
            { status: 400 }
          );
        }

        const service = createServiceClient();
        const extension = getSafeExtension(fileName, mediaType === "image" ? "jpg" : "mp4");
        const storagePath = `${broker.id}/${listingId}/${crypto.randomUUID()}.${extension}`;
        const { data: uploadData, error: uploadError } = await service.storage
          .from(bucketName)
          .createSignedUploadUrl(storagePath);

        if (uploadError || !uploadData) {
          return NextResponse.json({ error: uploadError?.message ?? "Unable to prepare media upload" }, { status: 500 });
        }

        return NextResponse.json({
          bucket: bucketName,
          media_type: mediaType,
          signed_url: uploadData.signedUrl,
          storage_path: storagePath,
          token: uploadData.token
        });
      }

      if (action === "complete-upload") {
        const storagePath = body?.storage_path;
        const fileContentType = body?.content_type ?? "";
        const fileSize = typeof body?.file_size === "number" ? body.file_size : 0;
        const mediaType = body?.media_type ?? getMediaTypeFromContentType(fileContentType);

        if (
          typeof storagePath !== "string" ||
          !storagePath.startsWith(`${broker.id}/${listingId}/`)
        ) {
          return NextResponse.json({ error: "Invalid media storage path" }, { status: 400 });
        }

        if (!mediaType) {
          return NextResponse.json({ error: "Only image and video uploads are supported" }, { status: 400 });
        }

        const result = await createMediaRecord({
          brokerId: broker.id,
          contentType: fileContentType,
          fileSize,
          listingId,
          mediaType,
          storagePath,
          supabase
        });

        if (result.error || !result.media) {
          return NextResponse.json({ error: result.error ?? "Unable to save media" }, { status: 500 });
        }

        return NextResponse.json({
          media: {
            ...result.media,
            signed_url: result.signedUrl
          }
        });
      }

      return NextResponse.json({ error: "Unsupported media upload action" }, { status: 400 });
    }

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

    const listing = await getOwnedListing(supabase, broker.id, listingId);
    if (!listing) {
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

    const result = await createMediaRecord({
      brokerId: broker.id,
      contentType: file.type,
      fileSize: file.size,
      listingId,
      mediaType,
      storagePath,
      supabase
    });

    if (result.error || !result.media) {
      return NextResponse.json({ error: result.error ?? "Unable to save media" }, { status: 500 });
    }

    return NextResponse.json({
      media: {
        ...result.media,
        signed_url: result.signedUrl
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
