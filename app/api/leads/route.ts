import { NextResponse } from "next/server";
import { insertAgentChatMessage } from "@/lib/agent/conversations";
import { generateLeadSummary } from "@/lib/agent/lead-summaries";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { leadRequestSchema, leadUpdateSchema, manualLeadCreateSchema } from "@/lib/leads/lead-api-schemas";
import { getLeadsByIdsForBroker, getRecentLeadsForBroker, leadBaseSelect } from "@/lib/leads/queries";
import type { TodayFollowUpLead } from "@/lib/leads/types";
import type { ListingRecord } from "@/lib/listings/types";
import { createServiceClient } from "@/lib/supabase/server";

async function insertCampaignLeadAlert({
  brokerId,
  leadId,
  listing,
  service
}: {
  brokerId: string;
  leadId: string;
  listing: ListingRecord | null;
  service: ReturnType<typeof createServiceClient>;
}) {
  const [lead] = await getLeadsByIdsForBroker(service, brokerId, [leadId]);

  if (!lead) {
    return;
  }

  const listingLabel =
    [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ") ||
    listing?.title ||
    "the promoted listing";
  const channelLabel = lead.campaign_channel ?? lead.source_channel ?? "promotion";
  const alertLead: TodayFollowUpLead = {
    ...lead,
    priority_label: "First reply",
    recommended_reason: `New lead submitted from the ${channelLabel} promotion for ${listingLabel}.`,
    recommended_action: "Review the inquiry and draft the first reply.",
    recommendation_context: lead.message ?? lead.ai_summary
  };

  await insertAgentChatMessage(service, {
    brokerId,
    role: "assistant",
    messageType: "lead_alert",
    content: `New lead from ${channelLabel} promotion for ${listingLabel}. Review the inquiry and decide whether to reply now.`,
    structuredPayload: {
      ui: {
        leadResults: [alertLead],
        leadSourceMessage: "promotion_lead_alert"
      }
    }
  });
}

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
  const isCampaignLead = typeof body?.campaign_code === "string" && body.campaign_code.trim().length > 0;

  if (!isCampaignLead) {
    const parsedManualLead = manualLeadCreateSchema.safeParse(body);

    if (!parsedManualLead.success) {
      return NextResponse.json(
        { error: "Invalid lead payload", issues: parsedManualLead.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const { supabase, broker } = await requireCurrentBroker();
      const { data: listing } = parsedManualLead.data.listing_id
        ? await supabase
            .from("listings")
            .select(
              "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at"
            )
            .eq("id", parsedManualLead.data.listing_id)
            .eq("broker_id", broker.id)
            .maybeSingle()
        : { data: null };
      const aiSummary = await generateLeadSummary({
        fullName: parsedManualLead.data.full_name ?? "Unnamed buyer",
        phone: parsedManualLead.data.phone ?? "",
        message: parsedManualLead.data.message || null,
        channel: parsedManualLead.data.source_channel,
        listing: (listing as ListingRecord | null) ?? null
      });

      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          broker_id: broker.id,
          listing_id: listing?.id ?? null,
          campaign_link_id: null,
          source_channel: parsedManualLead.data.source_channel,
          full_name: parsedManualLead.data.full_name ?? null,
          phone: parsedManualLead.data.phone ?? null,
          email: parsedManualLead.data.email || null,
          message: parsedManualLead.data.message ?? null,
          ai_summary: aiSummary,
          urgency: parsedManualLead.data.urgency,
          status: parsedManualLead.data.status
        })
        .select(leadBaseSelect)
        .single();

      if (leadError || !lead) {
        return NextResponse.json({ error: leadError?.message ?? "Unable to save lead" }, { status: 500 });
      }

      await supabase.from("audit_logs").insert({
        broker_id: broker.id,
        actor_type: "user",
        action: "create_lead",
        entity_type: "lead",
        entity_id: lead.id,
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

  try {
    await insertCampaignLeadAlert({
      brokerId: campaignLink.broker_id,
      leadId: lead.id,
      listing: (listing as ListingRecord | null) ?? null,
      service
    });
  } catch {
    // The public lead capture must not fail if the broker-facing chat alert cannot be saved.
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
      .select(leadBaseSelect)
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
      .select(leadBaseSelect)
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
