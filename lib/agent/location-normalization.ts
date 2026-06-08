import { env } from "@/lib/env";

type LocationHierarchyInput = {
  society: string;
  phase: string;
  sector: string;
  block: string;
  city: string;
};

type LocationHierarchyResponse = {
  canMatch?: boolean;
  isComplete?: boolean;
  nextLevel?: string;
  childrenCount?: number;
  city_id?: number | null;
  society_id?: number | null;
  phase_id?: number | null;
  sector_id?: number | null;
  block_id?: number | null;
  lastSpatialLevel?: string | null;
  lastLevelCenter?: {
    lat?: number;
    lon?: number;
  } | null;
};

export type VerifiedPakistanLocation = LocationHierarchyInput & {
  canMatch: boolean;
  isComplete: boolean;
  nextLevel: string | null;
  lastSpatialLevel: string | null;
  ids: {
    city_id: number | null;
    society_id: number | null;
    phase_id: number | null;
    sector_id: number | null;
    block_id: number | null;
  };
};

export type PakistanLocationNormalizationResult = {
  enabled: boolean;
  verifiedLocations: VerifiedPakistanLocation[];
  error?: string;
};

const hierarchyCacheTtlMs = 24 * 60 * 60 * 1000;
const hierarchyCache = new Map<string, { expiresAt: number; value: VerifiedPakistanLocation }>();

function getHierarchyRequestTimeoutMs() {
  const configured = Number(env.pakistanHierarchyCheckTimeoutMs);

  if (!Number.isFinite(configured) || configured <= 0) {
    return 900;
  }

  return Math.min(Math.max(Math.round(configured), 300), 2500);
}

const numberWords: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12"
};

const cityPatterns: Array<[RegExp, string]> = [
  [/\blahore\b/i, "Lahore"],
  [/\bkarachi\b/i, "Karachi"],
  [/\bislamabad\b/i, "Islamabad"],
  [/\brawalpindi\b/i, "Rawalpindi"],
  [/\bmultan\b/i, "Multan"],
  [/\bfaisalabad\b/i, "Faisalabad"],
  [/\bpeshawar\b/i, "Peshawar"],
  [/\bgujranwala\b/i, "Gujranwala"]
];

function normalizeNumberToken(value: string) {
  return numberWords[value.toLowerCase()] ?? value;
}

function extractCity(message: string) {
  return cityPatterns.find(([pattern]) => pattern.test(message))?.[1] ?? "Lahore";
}

function extractPhase(message: string, society: string) {
  const phaseMatch = message.match(
    /\b(?:phase|fase|face|fees|phis|phaze)\s*(?:no\.?\s*)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i
  );

  if (phaseMatch?.[1]) {
    return `Phase ${normalizeNumberToken(phaseMatch[1])}`;
  }

  const dhaNumberMatch = society === "DHA" ? message.match(/\bDHA\s*(\d{1,2})\b/i) : null;
  return dhaNumberMatch?.[1] ? `Phase ${dhaNumberMatch[1]}` : "";
}

function extractSociety(message: string) {
  if (/\b(?:DHA|Defen[cs]e Housing Authority)\b/i.test(message)) {
    return "DHA";
  }

  if (/\bBahria\s*Town\b/i.test(message)) {
    return "Bahria Town";
  }

  if (/\bLake\s*City\b|\bLakecity\b/i.test(message)) {
    return "Lake City";
  }

  if (/\bGulberg\b/i.test(message)) {
    return "Gulberg";
  }

  return "";
}

function extractSector(message: string) {
  const sectorMatch = message.match(/\bsector\s+([A-Z]|\d{1,3}(?:\/\d{1,3})?)\b/i);
  return sectorMatch?.[1] ? `Sector ${sectorMatch[1].toUpperCase()}` : "";
}

function extractBlock(message: string) {
  const blockMatch = message.match(/\bblock\s+([A-Z]|\d{1,3})\b/i);
  return blockMatch?.[1] ? `Block ${blockMatch[1].toUpperCase()}` : "";
}

export function extractPakistanLocationInput(message: string): LocationHierarchyInput | null {
  const society = extractSociety(message);

  if (!society) {
    return null;
  }

  return {
    society,
    phase: extractPhase(message, society),
    sector: extractSector(message),
    block: extractBlock(message),
    city: extractCity(message)
  };
}

function normalizeHierarchyResponse(input: LocationHierarchyInput, response: LocationHierarchyResponse) {
  return {
    ...input,
    canMatch: Boolean(response.canMatch),
    isComplete: Boolean(response.isComplete),
    nextLevel: response.nextLevel ?? null,
    lastSpatialLevel: response.lastSpatialLevel ?? null,
    ids: {
      city_id: response.city_id ?? null,
      society_id: response.society_id ?? null,
      phase_id: response.phase_id ?? null,
      sector_id: response.sector_id ?? null,
      block_id: response.block_id ?? null
    }
  } satisfies VerifiedPakistanLocation;
}

function getHierarchyCacheKey(input: LocationHierarchyInput) {
  return [input.city, input.society, input.phase, input.sector, input.block]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

function readCachedHierarchyLocation(input: LocationHierarchyInput) {
  const cached = hierarchyCache.get(getHierarchyCacheKey(input));

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    hierarchyCache.delete(getHierarchyCacheKey(input));
    return null;
  }

  return cached.value;
}

function writeCachedHierarchyLocation(input: LocationHierarchyInput, value: VerifiedPakistanLocation) {
  hierarchyCache.set(getHierarchyCacheKey(input), {
    expiresAt: Date.now() + hierarchyCacheTtlMs,
    value
  });
}

export async function normalizePakistanLocationTerms(
  message: string
): Promise<PakistanLocationNormalizationResult> {
  const input = extractPakistanLocationInput(message);

  if (!env.pakistanHierarchyCheckUrl || !input) {
    return { enabled: Boolean(env.pakistanHierarchyCheckUrl), verifiedLocations: [] };
  }

  const cachedLocation = readCachedHierarchyLocation(input);

  if (cachedLocation) {
    return { enabled: true, verifiedLocations: [cachedLocation] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getHierarchyRequestTimeoutMs());

  try {
    const response = await fetch(env.pakistanHierarchyCheckUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      return {
        enabled: true,
        verifiedLocations: [],
        error: `Hierarchy check failed with HTTP ${response.status}.`
      };
    }

    const payload = (await response.json().catch(() => null)) as LocationHierarchyResponse | null;

    if (!payload?.canMatch) {
      return { enabled: true, verifiedLocations: [] };
    }

    const verifiedLocation = normalizeHierarchyResponse(input, payload);
    writeCachedHierarchyLocation(input, verifiedLocation);

    return {
      enabled: true,
      verifiedLocations: [verifiedLocation]
    };
  } catch (error) {
    return {
      enabled: true,
      verifiedLocations: [],
      error: error instanceof Error ? error.message : "Hierarchy check failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildLocationEnhancedRoutingMessage(
  message: string,
  locationContext?: PakistanLocationNormalizationResult
) {
  const verified = locationContext?.verifiedLocations.filter((location) => location.canMatch) ?? [];

  if (!verified.length) {
    return message;
  }

  const locationLines = verified.map((location) => {
    const parts = [
      location.city ? `city=${location.city}` : null,
      location.society ? `society=${location.society}` : null,
      location.phase ? `phase=${location.phase}` : null,
      location.sector ? `sector=${location.sector}` : null,
      location.block ? `block=${location.block}` : null,
      location.lastSpatialLevel ? `matched_level=${location.lastSpatialLevel}` : null
    ].filter(Boolean);

    return parts.join(", ");
  });

  return `${message}\n\nVerified Pakistan real estate location terms:\n${locationLines.join("\n")}`;
}

export function stripLocationEnhancedRoutingContext(value: string) {
  return value.replace(/\n\nVerified Pakistan real estate location terms:[\s\S]*$/u, "").trim();
}

export function formatLocationContextForPrompt(locationContext?: PakistanLocationNormalizationResult) {
  const verified = locationContext?.verifiedLocations.filter((location) => location.canMatch) ?? [];

  if (!verified.length) {
    return "No verified Pakistan location terms.";
  }

  return verified
    .map((location) => {
      const parts = [
        location.city,
        location.society,
        location.phase,
        location.sector,
        location.block
      ].filter(Boolean);

      return `${parts.join(" / ")}; matched level: ${location.lastSpatialLevel ?? "unknown"}; next level: ${
        location.nextLevel ?? "none"
      }.`;
    })
    .join("\n");
}
