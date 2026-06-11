import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLeadReplyDraft } from "@/lib/agent/lead-replies";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { leadBaseSelect } from "@/lib/leads/queries";
import type { LeadListItem, LeadRecord } from "@/lib/leads/types";
import type { ListingRecord } from "@/lib/listings/types";

const replyDraftRequestSchema = z.object({
  lead_id: z.string().uuid()
});

function normalizeWhatsAppPhone(phone: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith("0")) {
    return `92${digits.slice(1)}`;
  }

  return digits;
}

function makeWhatsAppReplyUrl(phone: string | null, text: string) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);

  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = replyDraftRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead reply payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(leadBaseSelect)
      .eq("id", parsed.data.lead_id)
      .eq("broker_id", broker.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: leadError?.message ?? "Lead not found" }, { status: 404 });
    }

    const leadRow = lead as LeadRecord;
    const [{ data: listing }, { data: campaign }] = await Promise.all([
      leadRow.listing_id
        ? supabase
            .from("listings")
            .select(
              "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at"
            )
            .eq("id", leadRow.listing_id)
            .eq("broker_id", broker.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      leadRow.campaign_link_id
        ? supabase
            .from("campaign_links")
            .select("id, code, channel")
            .eq("id", leadRow.campaign_link_id)
            .eq("broker_id", broker.id)
            .maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const leadContext: LeadListItem = {
      ...leadRow,
      listing_title: (listing as ListingRecord | null)?.title ?? null,
      listing_area: (listing as ListingRecord | null)?.location_area ?? null,
      listing_city: (listing as ListingRecord | null)?.city ?? null,
      campaign_code: (campaign as { code?: string | null } | null)?.code ?? null,
      campaign_channel: (campaign as { channel?: string | null } | null)?.channel ?? null
    };

    const draft = await generateLeadReplyDraft({
      lead: leadContext,
      listing: (listing as ListingRecord | null) ?? null
    });

    const whatsapp_url = makeWhatsAppReplyUrl(leadRow.phone, draft.reply_text);

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "agent",
      action: "draft_lead_reply",
      entity_type: "lead",
      entity_id: leadRow.id,
      after_payload: {
        ...draft,
        whatsapp_url
      },
      metadata: {
        source: "lead_reply_draft"
      }
    });

    await supabase.from("follow_up_activities").insert({
      broker_id: broker.id,
      lead_id: leadRow.id,
      related_listing_id: leadRow.listing_id,
      activity_type: "reply_drafted",
      channel: "whatsapp",
      summary: draft.next_step,
      message_draft: draft.reply_text,
      old_status: leadRow.status,
      new_status: null,
      source_type: "agent_chat",
      original_chat_saved: false,
      original_chat_text: null
    });

    return NextResponse.json({
      draft: {
        ...draft,
        whatsapp_url,
        lead_id: leadRow.id
      },
      lead: leadContext,
      listing: (listing as ListingRecord | null) ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
