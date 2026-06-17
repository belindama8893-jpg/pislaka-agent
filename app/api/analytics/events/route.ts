import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

const analyticsEventNames = [
  "page_view",
  "lead_form_view",
  "lead_form_start",
  "lead_submit_attempt",
  "lead_submit_success",
  "whatsapp_opened",
  "home_page_view",
  "auth_modal_opened",
  "auth_started",
  "auth_succeeded",
  "workspace_view",
  "profile_completed",
  "listing_created",
  "lead_created"
] as const;

const analyticsEventSchema = z.object({
  event_name: z.enum(analyticsEventNames),
  campaign_code: z.string().min(1).optional(),
  visitor_id: z.string().trim().min(8).max(120).optional(),
  session_id: z.string().trim().min(8).max(120).optional(),
  experiment_key: z.string().trim().max(120).optional(),
  variant: z.string().trim().max(80).optional(),
  path: z.string().trim().max(500).optional(),
  referrer: z.string().trim().max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
});

type CampaignLinkRecord = {
  id: string;
  broker_id: string;
  listing_id: string;
  channel: string;
};

type BrokerLookupRecord = {
  id: string;
};

function getClientIp(request: Request) {
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyticsEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics event", issues: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceClient();
  let campaign: CampaignLinkRecord | null = null;
  let authUserId: string | null = null;
  let brokerId: string | null = null;

  if (parsed.data.campaign_code) {
    const { data: campaignLink, error: campaignError } = await service
      .from("campaign_links")
      .select("id, broker_id, listing_id, channel")
      .eq("code", parsed.data.campaign_code)
      .single();

    if (campaignError || !campaignLink) {
      return NextResponse.json({ error: "Campaign link not found" }, { status: 404 });
    }

    campaign = campaignLink as CampaignLinkRecord;
    brokerId = campaign.broker_id;
  } else {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    authUserId = user?.id ?? null;

    if (authUserId) {
      const { data: broker } = await service
        .from("broker_profiles")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      brokerId = (broker as BrokerLookupRecord | null)?.id ?? null;
    }
  }

  const { error } = await service.from("analytics_events").insert({
    auth_user_id: authUserId,
    broker_id: brokerId,
    listing_id: campaign?.listing_id ?? null,
    campaign_link_id: campaign?.id ?? null,
    event_name: parsed.data.event_name,
    channel: campaign?.channel ?? null,
    visitor_id: parsed.data.visitor_id ?? null,
    session_id: parsed.data.session_id ?? null,
    experiment_key: parsed.data.experiment_key || null,
    variant: parsed.data.variant || null,
    path: parsed.data.path || null,
    referrer: parsed.data.referrer || request.headers.get("referer"),
    user_agent: request.headers.get("user-agent"),
    ip_hash: hashIp(getClientIp(request)),
    metadata: parsed.data.metadata ?? {}
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
