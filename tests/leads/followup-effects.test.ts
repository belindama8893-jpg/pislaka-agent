import { describe, expect, it } from "vitest";
import { getLeadPatchForFollowUpActivity } from "../../lib/leads/followup-effects";
import type { LeadRecord } from "../../lib/leads/types";

function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  const now = "2026-06-13T12:00:00.000Z";

  return {
    id: "11111111-1111-4111-8111-111111111111",
    broker_id: "22222222-2222-4222-8222-222222222222",
    listing_id: null,
    campaign_link_id: null,
    source_channel: "manual",
    full_name: "Ahmed Raza",
    phone: "03001112223",
    email: null,
    message: null,
    status: "new",
    urgency: "normal",
    ai_summary: null,
    last_contacted_at: null,
    next_follow_up_at: null,
    last_note: null,
    budget_min: null,
    budget_max: null,
    interested_area: null,
    interested_listing_id: null,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

describe("getLeadPatchForFollowUpActivity", () => {
  const occurredAt = "2026-06-13T13:00:00.000Z";

  it("updates last_contacted_at only when a message was actually sent", () => {
    const patch = getLeadPatchForFollowUpActivity(
      makeLead({ status: "new" }),
      {
        activity_type: "message_sent",
        summary: "Sent WhatsApp reply about Sunday viewing."
      },
      occurredAt
    );

    expect(patch).toEqual({
      updated_at: occurredAt,
      last_contacted_at: occurredAt,
      last_note: "Sent WhatsApp reply about Sunday viewing.",
      status: "contacted"
    });
  });

  it("does not downgrade an already qualified lead when message_sent is recorded", () => {
    const patch = getLeadPatchForFollowUpActivity(
      makeLead({ status: "qualified", urgency: "high" }),
      {
        activity_type: "message_sent",
        summary: "Sent viewing confirmation."
      },
      occurredAt
    );

    expect(patch).toEqual({
      updated_at: occurredAt,
      last_contacted_at: occurredAt,
      last_note: "Sent viewing confirmation."
    });
  });

  it("does not update last_contacted_at for reply drafts", () => {
    const patch = getLeadPatchForFollowUpActivity(
      makeLead({ last_contacted_at: null }),
      {
        activity_type: "reply_drafted",
        summary: "Drafted WhatsApp reply."
      },
      occurredAt
    );

    expect(patch).toEqual({
      updated_at: occurredAt
    });
  });

  it("does not update last_contacted_at for WhatsApp opened", () => {
    const patch = getLeadPatchForFollowUpActivity(
      makeLead({ last_contacted_at: null }),
      {
        activity_type: "whatsapp_opened",
        summary: "Opened WhatsApp link."
      },
      occurredAt
    );

    expect(patch).toEqual({
      updated_at: occurredAt
    });
  });

  it("updates status and urgency for explicit status changes without marking contact", () => {
    const patch = getLeadPatchForFollowUpActivity(
      makeLead({ status: "contacted" }),
      {
        activity_type: "status_changed",
        new_status: "qualified",
        urgency: "high",
        summary: "Ahmed confirmed budget and wants family visit."
      },
      occurredAt
    );

    expect(patch).toEqual({
      updated_at: occurredAt,
      status: "qualified",
      last_note: "Ahmed confirmed budget and wants family visit.",
      urgency: "high"
    });
  });

  it("updates next follow-up time for reminders without marking contact", () => {
    const nextFollowUpAt = "2026-06-14T06:00:00.000Z";
    const patch = getLeadPatchForFollowUpActivity(
      makeLead(),
      {
        activity_type: "reminder_created",
        next_follow_up_at: nextFollowUpAt,
        summary: "Call Sara tomorrow morning."
      },
      occurredAt
    );

    expect(patch).toEqual({
      updated_at: occurredAt,
      next_follow_up_at: nextFollowUpAt,
      last_note: "Call Sara tomorrow morning."
    });
  });
});
