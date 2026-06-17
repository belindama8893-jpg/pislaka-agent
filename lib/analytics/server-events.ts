import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductAnalyticsEventName =
  | "auth_succeeded"
  | "workspace_view"
  | "profile_completed"
  | "listing_created"
  | "lead_created";

type RecordProductAnalyticsEventInput = {
  authUserId?: string | null;
  brokerId?: string | null;
  eventName: ProductAnalyticsEventName;
  metadata?: Record<string, unknown>;
  request?: Request;
};

function getClientIp(request: Request | undefined) {
  if (!request) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || null;
}

function hashIp(ip: string | null) {
  if (!ip) {
    return null;
  }

  const salt = process.env.ANALYTICS_IP_HASH_SALT || "pislaka-analytics";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export async function recordProductAnalyticsEvent(
  supabase: SupabaseClient,
  {
    authUserId,
    brokerId,
    eventName,
    metadata,
    request
  }: RecordProductAnalyticsEventInput
) {
  try {
    await supabase.from("analytics_events").insert({
      auth_user_id: authUserId ?? null,
      broker_id: brokerId ?? null,
      event_name: eventName,
      user_agent: request?.headers.get("user-agent") ?? null,
      referrer: request?.headers.get("referer") ?? null,
      ip_hash: hashIp(getClientIp(request)),
      metadata: metadata ?? {}
    });
  } catch {
    // Analytics should never block the broker's core workflow.
  }
}
