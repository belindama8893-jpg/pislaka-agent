import type { ListingDraftInput } from "@/lib/listings/types";

export type ImportedListingRemoteImage = {
  url: string;
  alt?: string;
};

export type ImportedListingDraft = ListingDraftInput & {
  ai_extracted_payload: {
    source: "listing_url_import";
    source_url: string;
    remote_images: ImportedListingRemoteImage[];
    extracted_at: string;
  };
};

const listingUrlPattern = /https?:\/\/[^\s<>"']+/i;
const pislakaHomeDetailsPattern = /^https?:\/\/(?:www\.)?pislaka\.com\/homedetails\/\d+\.html(?:[?#].*)?$/i;
const zameenPropertyPattern = /^https?:\/\/(?:www\.)?zameen\.com\/Property\/.+\.html(?:[?#].*)?$/i;

function cleanText(value?: string | null) {
  return value
    ?.replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFirstUrl(message: string) {
  const match = message.match(listingUrlPattern);
  return match?.[0]?.replace(/[),.，。]+$/u, "");
}

function getMetaContent(html: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const metaMatch =
    html.match(
      new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${escapedName}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i")
    ) ??
    html.match(
      new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapedName}["'][^>]*>`, "i")
    );

  return cleanText(metaMatch?.[1]);
}

function getPageConfigValue(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`pageConfig\\.${escapedKey}\\s*=\\s*(['"])(.*?)\\1\\s*;`, "s"));
  return cleanText(match?.[2]);
}

function parsePriceAmount(value?: string | null) {
  const text = cleanText(value)?.toLowerCase();
  if (!text) {
    return undefined;
  }

  const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (!numberMatch) {
    return undefined;
  }

  const amount = Number(numberMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  if (/crore|cr|karor/.test(text)) {
    return Math.round(amount * 10000000);
  }

  if (/lakh|lac/.test(text)) {
    return Math.round(amount * 100000);
  }

  return Math.round(amount);
}

function parseAreaSize(value?: string | null) {
  const text = cleanText(value)?.toLowerCase();
  const match = text?.match(/(\d+(?:\.\d+)?)\s*(kanal|marla|sqft|sqm)/);
  if (!match) {
    return {};
  }

  return {
    area_value: Number(match[1]),
    area_unit: match[2] as ListingDraftInput["area_unit"]
  };
}

function parseZameenArea(areaSqft?: unknown) {
  const area = typeof areaSqft === "number" ? areaSqft : Number(areaSqft);
  if (!Number.isFinite(area) || area <= 0) {
    return {};
  }

  if (area % 4500 === 0) {
    return {
      area_value: area / 4500,
      area_unit: "kanal" as const
    };
  }

  if (area % 225 === 0) {
    return {
      area_value: area / 225,
      area_unit: "marla" as const
    };
  }

  return {
    area_value: area,
    area_unit: "sqft" as const
  };
}

function normalizeListingType(value?: string | null): ListingDraftInput["listing_type"] {
  if (/rent|lease/i.test(value ?? "")) {
    return "rent";
  }

  return "sale";
}

function normalizePropertyType(value?: string | null) {
  const text = cleanText(value)?.toLowerCase() ?? "";
  if (/flat|apartment/.test(text)) {
    return "apartment";
  }
  if (/plot/.test(text)) {
    return "plot";
  }
  if (/shop|commercial|office/.test(text)) {
    return "commercial";
  }
  if (/villa/.test(text)) {
    return "villa";
  }
  if (/house|home|homes/.test(text)) {
    return "house";
  }
  return cleanText(value) || "house";
}

function uniqueImages(images: ImportedListingRemoteImage[]) {
  const seen = new Set<string>();
  return images.filter((image) => {
    if (!image.url || seen.has(image.url)) {
      return false;
    }
    seen.add(image.url);
    return true;
  });
}

function extractImages(html: string) {
  const images: ImportedListingRemoteImage[] = [];
  const ogImage = getMetaContent(html, "og:image:secure_url") ?? getMetaContent(html, "og:image");
  const ogAlt = getMetaContent(html, "og:image:alt");

  if (ogImage?.startsWith("http")) {
    images.push({ url: ogImage, alt: ogAlt });
  }

  for (const match of html.matchAll(
    /<img\s+[^>]*src=["'](https?:\/\/image\.pislaka\.com\/[^"']+)["'][^>]*class=["'][^"']*(?:gallery-main-img|gallery-thumb-img)[^"']*["'][^>]*>/gi
  )) {
    const tag = match[0];
    const alt = cleanText(tag.match(/\salt=["']([^"']*)["']/i)?.[1]);
    images.push({ url: match[1], alt });
  }

  for (const match of html.matchAll(
    /<img\s+[^>]*class=["'][^"']*(?:gallery-main-img|gallery-thumb-img)[^"']*["'][^>]*src=["'](https?:\/\/image\.pislaka\.com\/[^"']+)["'][^>]*>/gi
  )) {
    const tag = match[0];
    const alt = cleanText(tag.match(/\salt=["']([^"']*)["']/i)?.[1]);
    images.push({ url: match[1], alt });
  }

  return uniqueImages(images).slice(0, 12);
}

function extractZameenDataLayer(html: string) {
  const match = html.match(/window\['dataLayer'\][\s\S]*?\.push\((\{[\s\S]*?\})\);<\/script>/i);
  if (!match) {
    return {};
  }

  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? cleanText(value) : undefined;
}

function getFirstNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return getFirstNumber(value[0]);
  }

  return undefined;
}

function extractZameenLocationArea(html: string, listingTitle?: string) {
  const ogTitle = getMetaContent(html, "og:title") ?? cleanText(html.match(/<title>(.*?)<\/title>/is)?.[1]);
  if (!ogTitle) {
    return undefined;
  }

  const withoutListingTitle = listingTitle ? ogTitle.replace(listingTitle, "").trim() : ogTitle;
  const locationBeforeId = withoutListingTitle.replace(/\s+ID\d+.*$/i, "").trim();
  const firstLocation = locationBeforeId.split(",")[0]?.trim();

  return cleanText(firstLocation?.replace(/^[-,\s]+/, ""));
}

function extractZameenImages(html: string) {
  const imageIds = new Set<string>();
  const ogImage = getMetaContent(html, "og:image");
  const ogImageId = ogImage?.match(/\/thumbnails\/(\d+)-/)?.[1];
  const ogAlt = getMetaContent(html, "og:title");
  const images: ImportedListingRemoteImage[] = [];

  if (ogImageId) {
    imageIds.add(ogImageId);
  }

  for (const match of html.matchAll(/https:\/\/media\.zameen\.com\/thumbnails\/(\d+)-(?:800x600|400x300|120x90)\.(?:jpeg|webp)/g)) {
    imageIds.add(match[1]);
  }

  for (const [index, imageId] of Array.from(imageIds).entries()) {
    images.push({
      url: `https://media.zameen.com/thumbnails/${imageId}-800x600.jpeg`,
      alt: index === 0 ? ogAlt : `Zameen property image ${imageId}`
    });
  }

  return uniqueImages(images).slice(0, 12);
}

function buildZameenDescription({
  city,
  locationArea,
  metaDescription,
  title
}: {
  city?: string;
  locationArea?: string;
  metaDescription?: string;
  title: string;
}) {
  const locationLine = [locationArea, city].filter(Boolean).join(", ");
  let details = cleanText(metaDescription);

  if (details) {
    details = details.replace(new RegExp(escapeRegExp(title), "gi"), " ");
    details = details.replace(/^[^.]{0,180}\bProperty\.\s*/i, "");
    details = details.replace(/\s*-\s*/g, " ");
    details = details.replace(/\s+/g, " ").trim();
  }

  if (details && locationLine) {
    return `${locationLine}. ${details}`;
  }

  if (details) {
    return details;
  }

  return `${title}${locationLine ? ` in ${locationLine}` : ""}. Imported from Zameen for broker review.`;
}

function importZameenListingDraftFromHtml(url: string, html: string): ImportedListingDraft {
  const dataLayer = extractZameenDataLayer(html);
  const listingTitle =
    getString(dataLayer.listing_title) ??
    cleanText(
      getMetaContent(html, "og:title")?.replace(/\s+ID\d+\s*-\s*Zameen\.com$/i, "")
    ) ??
    "Imported Zameen Listing";
  const city = getString(dataLayer.city_name) ?? getString(dataLayer.loc_city_name) ?? "Lahore";
  const locationArea =
    extractZameenLocationArea(html, listingTitle) ??
    getString(dataLayer.loc_4_name) ??
    getString(dataLayer.loc_neighbourhood_name) ??
    getString(dataLayer.loc_name);
  const metaDescription = getMetaContent(html, "description");
  const bedrooms = getNumber(dataLayer.property_beds) ?? getFirstNumber(dataLayer.property_beds_list);
  const bathrooms = getFirstNumber(dataLayer.property_baths_list);
  const area = parseZameenArea(dataLayer.property_land_area);
  const remoteImages = extractZameenImages(html);

  return {
    title: listingTitle,
    description: buildZameenDescription({
      city,
      locationArea,
      metaDescription,
      title: listingTitle
    }),
    city,
    location_area: locationArea,
    property_type: normalizePropertyType(getString(dataLayer.category_2_name) ?? getString(dataLayer.property_type)),
    listing_type: normalizeListingType(getString(dataLayer.purpose)),
    price_amount: getNumber(dataLayer.property_price) ?? getNumber(dataLayer.price),
    price_currency: "PKR",
    ...area,
    bedrooms,
    bathrooms,
    features: [],
    ai_extracted_payload: {
      source: "listing_url_import",
      source_url: url,
      remote_images: remoteImages,
      extracted_at: new Date().toISOString()
    },
    ai_confidence: 0.88
  };
}

export function getListingImportUrl(message: string) {
  const url = extractFirstUrl(message);
  if (!url || (!pislakaHomeDetailsPattern.test(url) && !zameenPropertyPattern.test(url))) {
    return null;
  }

  return url;
}

export async function importListingDraftFromUrl(url: string): Promise<ImportedListingDraft> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Pislaka-Agent/1.0 (+https://www.pislaka.com)"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch listing URL (${response.status})`);
  }

  const html = await response.text();
  if (zameenPropertyPattern.test(url)) {
    return importZameenListingDraftFromHtml(url, html);
  }

  const title =
    getMetaContent(html, "og:image:alt") ??
    cleanText(html.match(/<title>(.*?)<\/title>/is)?.[1]?.replace(/\s*-\s*Property Details\s*-\s*Pislaka\s*$/i, ""));
  const metaDescription = getMetaContent(html, "Description");
  const city = getPageConfigValue(html, "city") ?? "Lahore";
  const block = getPageConfigValue(html, "block");
  const society = getPageConfigValue(html, "society");
  const propertySubtype = getPageConfigValue(html, "propertySubtype") ?? getPageConfigValue(html, "type");
  const areaSize = getPageConfigValue(html, "areaSize");
  const beds = Number(getPageConfigValue(html, "beds"));
  const baths = Number(getPageConfigValue(html, "baths"));
  const displayPrice = getPageConfigValue(html, "displayPrice");
  const locationArea = block || society;
  const area = parseAreaSize(areaSize);
  const titleText = title || "Imported Property Listing";
  const remoteImages = extractImages(html);

  return {
    title: titleText,
    description:
      metaDescription ??
      `${titleText}${locationArea ? ` in ${locationArea}` : ""}${city ? `, ${city}` : ""}. Imported from Pislaka details page for broker review.`,
    city,
    location_area: locationArea,
    property_type: normalizePropertyType(propertySubtype),
    listing_type: normalizeListingType(getPageConfigValue(html, "purpose")),
    price_amount: parsePriceAmount(displayPrice),
    price_currency: "PKR",
    ...area,
    bedrooms: Number.isFinite(beds) ? beds : undefined,
    bathrooms: Number.isFinite(baths) ? baths : undefined,
    features: [],
    ai_extracted_payload: {
      source: "listing_url_import",
      source_url: url,
      remote_images: remoteImages,
      extracted_at: new Date().toISOString()
    },
    ai_confidence: 0.9
  };
}
