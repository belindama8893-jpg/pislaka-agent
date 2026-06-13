import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { getLeadPatchForFollowUpActivity } from "@/lib/leads/followup-effects";
import { leadBaseSelect } from "@/lib/leads/queries";
import type { FollowUpActivityRecord, LeadRecord } from "@/lib/leads/types";

const followUpActivitySchema = z.object({
  lead_id: z.string().uuid(),
  related_listing_id: z.string().uuid().nullable().optional(),
  activity_type: z.enum([
    "reply_drafted",
    "whatsapp_opened",
    "message_sent",
    "status_changed",
    "reminder_created",
    "note_added",
    "viewing_scheduled",
    "chat_imported",
    "followup_summary_saved"
  ]),
  channel: z.enum(["whatsapp", "phone", "in_person", "facebook", "instagram", "other"]).default("whatsapp"),
  summary: z.string().max(4000).nullable().optional(),
  message_draft: z.string().max(4000).nullable().optional(),
  new_status: z.enum(["new", "contacted", "qualified", "closed", "lost"]).nullable().optional(),
  urgency: z.enum(["low", "normal", "high"]).nullable().optional(),
  next_follow_up_at: z.string().datetime().nullable().optional(),
  source_type: z
    .enum(["manual", "whatsapp_paste", "whatsapp_txt_upload", "whatsapp_zip_upload", "agent_chat"])
    .default("manual"),
  original_chat_saved: z.boolean().default(false),
  original_chat_text: z.string().max(24000).nullable().optional()
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = followUpActivitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid follow-up activity payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker, user } = await requireCurrentBroker();
    const payload = parsed.data;
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(leadBaseSelect)
      .eq("id", payload.lead_id)
      .eq("broker_id", broker.id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: leadError?.message ?? "Lead not found" }, { status: 404 });
    }

    const leadRow = lead as LeadRecord;
    const occurredAt = new Date().toISOString();
    const oldStatus = leadRow.status;
    const newStatus =
      payload.activity_type === "message_sent" && leadRow.status === "new"
        ? "contacted"
        : payload.new_status ?? null;
    const originalChatSaved = payload.original_chat_saved && Boolean(payload.original_chat_text);
    const { data: activity, error: activityError } = await supabase
      .from("follow_up_activities")
      .insert({
        broker_id: broker.id,
        lead_id: leadRow.id,
        related_listing_id: payload.related_listing_id ?? leadRow.listing_id,
        activity_type: payload.activity_type,
        channel: payload.channel,
        summary: payload.summary ?? null,
        message_draft: payload.message_draft ?? null,
        old_status: oldStatus,
        new_status: newStatus,
        next_follow_up_at: payload.next_follow_up_at ?? null,
        source_type: payload.source_type,
        original_chat_saved: originalChatSaved,
        original_chat_text: originalChatSaved ? payload.original_chat_text : null,
        occurred_at: occurredAt,
        created_by: user.id
      })
      .select(
        "id, broker_id, lead_id, related_listing_id, activity_type, channel, summary, message_draft, old_status, new_status, next_follow_up_at, source_type, original_chat_saved, original_chat_text, occurred_at, created_at, created_by"
      )
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: activityError?.message ?? "Unable to save follow-up activity" },
        { status: 500 }
      );
    }

    const leadPatch = getLeadPatchForFollowUpActivity(leadRow, payload, occurredAt);
    let updatedLead: LeadRecord = leadRow;

    if (Object.keys(leadPatch).length > 1) {
      const { data: patchedLead, error: updateError } = await supabase
        .from("leads")
        .update(leadPatch)
        .eq("id", leadRow.id)
        .eq("broker_id", broker.id)
        .select(leadBaseSelect)
        .single();

      if (updateError || !patchedLead) {
        return NextResponse.json(
          { error: updateError?.message ?? "Activity saved, but lead update failed" },
          { status: 500 }
        );
      }

      updatedLead = patchedLead as LeadRecord;
    }

    return NextResponse.json({
      activity: activity as FollowUpActivityRecord,
      lead: updatedLead
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
