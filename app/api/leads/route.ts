import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLeadSummary } from "@/lib/agent/lead-summaries";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { getRecentLeadsForBroker } from "@/lib/leads/queries";
import type { ListingRecord } from "@/lib/listings/types";
import { createServiceClient } from "@/lib/supabase/server";

const leadRequestSchema = z.object({
  campaign_code: z.string().min(1),
  full_name: z.string().min(1),
  phone: z.string().min(3),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(1000).optional()
});

const leadUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "contacted", "qualified", "closed", "lost"]).optional(),
  urgency: z.enum(["low", "normal", "high"]).optional()
});

export async function GET() {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const leads = await getRecentLeadsForBroker(supabase, broker.id, 20);

    return NextResponse.json({ leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = leadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: campaignLink, error: campaignError } = await service
    .from("campaign_links")
    .select("id, listing_id, broker_id, channel")
    .eq("code", parsed.data.campaign_code)
    .single();

  if (campaignError || !campaignLink) {
    return NextResponse.json({ error: "Campaign link not found" }, { status: 404 });
  }

  const { data: listing } = await service
    .from("listings")
    .select(
      "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at"
    )
    .eq("id", campaignLink.listing_id)
    .maybeSingle();
  const aiSummary = await generateLeadSummary({
    fullName: parsed.data.full_name,
    phone: parsed.data.phone,
    message: parsed.data.message || null,
    channel: campaignLink.channel,
    listing: (listing as ListingRecord | null) ?? null
  });

  const { data: lead, error: leadError } = await service
    .from("leads")
    .insert({
      broker_id: campaignLink.broker_id,
      listing_id: campaignLink.listing_id,
      campaign_link_id: campaignLink.id,
      source_channel: campaignLink.channel,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      message: parsed.data.message || null,
      ai_summary: aiSummary,
      urgency: "normal",
      status: "new"
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: leadError?.message ?? "Unable to save lead" }, { status: 500 });
  }

  return NextResponse.json({ lead });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = leadUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead update payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { id, ...changes } = parsed.data;

    const { data: existingLead, error: readError } = await supabase
      .from("leads")
      .select("id, broker_id, listing_id, campaign_link_id, source_channel, full_name, phone, email, message, status, urgency, ai_summary, created_at, updated_at")
      .eq("id", id)
      .eq("broker_id", broker.id)
      .single();

    if (readError || !existingLead) {
      return NextResponse.json({ error: readError?.message ?? "Lead not found" }, { status: 404 });
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .update({
        ...changes,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("broker_id", broker.id)
      .select("id, broker_id, listing_id, campaign_link_id, source_channel, full_name, phone, email, message, status, urgency, ai_summary, created_at, updated_at")
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: error?.message ?? "Lead not found" }, { status: 404 });
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "update_lead",
      entity_type: "lead",
      entity_id: lead.id,
      before_payload: existingLead,
      after_payload: lead,
      metadata: {
        source: "api"
      }
    });

    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
