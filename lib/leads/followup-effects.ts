import type { LeadRecord } from "@/lib/leads/types";

export type FollowUpActivityEffectPayload = {
  activity_type:
    | "reply_drafted"
    | "whatsapp_opened"
    | "message_sent"
    | "status_changed"
    | "reminder_created"
    | "note_added"
    | "viewing_scheduled"
    | "chat_imported"
    | "followup_summary_saved";
  summary?: string | null;
  new_status?: LeadRecord["status"] | null;
  urgency?: LeadRecord["urgency"] | null;
  next_follow_up_at?: string | null;
};

export function getLeadPatchForFollowUpActivity(
  lead: LeadRecord,
  payload: FollowUpActivityEffectPayload,
  occurredAt: string
) {
  const patch: Record<string, unknown> = {
    updated_at: occurredAt
  };

  if (payload.activity_type === "message_sent") {
    patch.last_contacted_at = occurredAt;
    patch.last_note = payload.summary ?? "Sent WhatsApp message.";

    if (lead.status === "new") {
      patch.status = "contacted";
    }
  }

  if (payload.activity_type === "status_changed" && payload.new_status) {
    patch.status = payload.new_status;
    patch.last_note = payload.summary ?? `Lead status changed to ${payload.new_status}.`;

    if (payload.urgency) {
      patch.urgency = payload.urgency;
    }
  }

  if (payload.activity_type === "reminder_created" && payload.next_follow_up_at) {
    patch.next_follow_up_at = payload.next_follow_up_at;
    patch.last_note = payload.summary ?? "Follow-up reminder created.";
  }

  if (payload.activity_type === "followup_summary_saved" || payload.activity_type === "note_added") {
    patch.last_note = payload.summary ?? lead.last_note;
  }

  return patch;
}
