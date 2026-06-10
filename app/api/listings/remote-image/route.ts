import { NextResponse } from "next/server";

const allowedRemoteImageHosts = new Set(["image.pislaka.com", "media.zameen.com"]);
const maxImageBytes = 12 * 1024 * 1024;

function validateRemoteImageUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !allowedRemoteImageHosts.has(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const remoteUrl = validateRemoteImageUrl(requestUrl.searchParams.get("url"));

  if (!remoteUrl) {
    return NextResponse.json({ error: "Unsupported remote image URL" }, { status: 400 });
  }

  try {
    const remoteResponse = await fetch(remoteUrl, {
      headers: {
        "User-Agent": "Pislaka-Agent/1.0 (+https://www.pislaka.com)"
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!remoteResponse.ok) {
      return NextResponse.json({ error: "Unable to load remote image" }, { status: 502 });
    }

    const contentType = remoteResponse.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Remote URL is not an image" }, { status: 400 });
    }

    const imageBuffer = Buffer.from(await remoteResponse.arrayBuffer());
    if (imageBuffer.byteLength > maxImageBytes) {
      return NextResponse.json({ error: "Remote image is too large" }, { status: 400 });
    }

    return new Response(imageBuffer, {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Length": String(imageBuffer.byteLength),
        "Content-Type": contentType
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load remote image" }, { status: 502 });
  }
}
