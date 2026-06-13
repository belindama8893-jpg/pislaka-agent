import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leads/followup-activities/route";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import type { LeadRecord } from "@/lib/leads/types";

vi.mock("@/lib/auth/current-user", () => ({
  requireCurrentBroker: vi.fn()
}));

const leadId = "11111111-1111-4111-8111-111111111111";
const brokerId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const listingId = "44444444-4444-4444-8444-444444444444";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/leads/followup-activities", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  const now = "2026-06-13T12:00:00.000Z";

  return {
    id: leadId,
    broker_id: brokerId,
    listing_id: listingId,
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

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    broker_id: brokerId,
    lead_id: leadId,
    related_listing_id: listingId,
    activity_type: "message_sent",
    channel: "whatsapp",
    summary: "Sent WhatsApp reply.",
    message_draft: null,
    old_status: "new",
    new_status: "contacted",
    next_follow_up_at: null,
    source_type: "manual",
    original_chat_saved: false,
    original_chat_text: null,
    occurred_at: "2026-06-13T13:00:00.000Z",
    created_at: "2026-06-13T13:00:00.000Z",
    created_by: userId,
    ...overrides
  };
}

function makeSupabase(
  options: {
    lead?: LeadRecord | null;
    leadError?: Error;
    activityError?: Error;
    updateError?: Error;
  } = {}
) {
  const lead = Object.prototype.hasOwnProperty.call(options, "lead") ? options.lead : makeLead();
  const activityInserts: unknown[] = [];
  const leadUpdates: unknown[] = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "leads") {
        let updatePayload: unknown;
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          update: vi.fn((payload: unknown) => {
            updatePayload = payload;
            leadUpdates.push(payload);
            return chain;
          }),
          single: vi.fn(async () => {
            if (updatePayload) {
              return {
                data: options.updateError ? null : { ...(lead as LeadRecord), ...(updatePayload as object) },
                error: options.updateError ?? null
              };
            }

            return {
              data: lead ?? null,
              error: options.leadError ?? null
            };
          })
        };
        return chain;
      }

      if (table === "follow_up_activities") {
        const chain = {
          insert: vi.fn((payload: unknown) => {
            activityInserts.push(payload);
            return chain;
          }),
          select: vi.fn(() => chain),
          single: vi.fn(async () => ({
            data: options.activityError ? null : makeActivity(activityInserts[0] as Record<string, unknown>),
            error: options.activityError ?? null
          }))
        };
        return chain;
      }

      throw new Error(`Unexpected table: ${table}`);
    })
  };

  return { supabase, activityInserts, leadUpdates };
}

const mockedRequireCurrentBroker = vi.mocked(requireCurrentBroker);

describe("follow-up activities route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid payloads before broker lookup", async () => {
    const response = await POST(
      makeRequest({
        lead_id: "lead-1",
        activity_type: "message_sent"
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid follow-up activity payload" });
    expect(mockedRequireCurrentBroker).not.toHaveBeenCalled();
  });

  it("returns 401 when the broker is not authenticated", async () => {
    mockedRequireCurrentBroker.mockRejectedValue(new Error("Unauthorized"));

    const response = await POST(makeRequest({ lead_id: leadId, activity_type: "message_sent" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when the lead is not found for the broker", async () => {
    const { supabase } = makeSupabase({ lead: null });
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: userId } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(makeRequest({ lead_id: leadId, activity_type: "message_sent" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Lead not found" });
  });

  it("saves reply drafts without marking the lead as contacted", async () => {
    const { supabase, activityInserts, leadUpdates } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: userId } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(
      makeRequest({
        lead_id: leadId,
        activity_type: "reply_drafted",
        summary: "Drafted a viewing reply.",
        message_draft: "Can we schedule Sunday?"
      })
    );

    expect(response.status).toBe(200);
    expect(activityInserts[0]).toMatchObject({
      broker_id: brokerId,
      lead_id: leadId,
      related_listing_id: listingId,
      activity_type: "reply_drafted",
      channel: "whatsapp",
      summary: "Drafted a viewing reply.",
      message_draft: "Can we schedule Sunday?",
      old_status: "new",
      new_status: null,
      source_type: "manual",
      original_chat_saved: false,
      original_chat_text: null,
      created_by: userId
    });
    expect(leadUpdates).toEqual([]);
  });

  it("marks a new lead as contacted only when message_sent is recorded", async () => {
    const { supabase, activityInserts, leadUpdates } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: userId } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(
      makeRequest({
        lead_id: leadId,
        activity_type: "message_sent",
        summary: "Sent WhatsApp reply.",
        original_chat_saved: true,
        original_chat_text: "Buyer: Is it available?"
      })
    );

    expect(response.status).toBe(200);
    expect(activityInserts[0]).toMatchObject({
      activity_type: "message_sent",
      old_status: "new",
      new_status: "contacted",
      original_chat_saved: true,
      original_chat_text: "Buyer: Is it available?"
    });
    expect(leadUpdates).toHaveLength(1);
    expect(leadUpdates[0]).toMatchObject({
      status: "contacted",
      last_contacted_at: expect.any(String),
      last_note: "Sent WhatsApp reply.",
      updated_at: expect.any(String)
    });

    const body = await response.json();
    expect(body.lead).toMatchObject({
      id: leadId,
      status: "contacted",
      last_note: "Sent WhatsApp reply."
    });
  });

  it("does not save original chat text when the save flag is false", async () => {
    const { supabase, activityInserts } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: userId } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(
      makeRequest({
        lead_id: leadId,
        activity_type: "chat_imported",
        original_chat_saved: false,
        original_chat_text: "Sensitive copied chat"
      })
    );

    expect(response.status).toBe(200);
    expect(activityInserts[0]).toMatchObject({
      original_chat_saved: false,
      original_chat_text: null
    });
  });

  it("returns 500 when activity insert fails", async () => {
    const { supabase } = makeSupabase({ activityError: new Error("Insert failed") });
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: userId } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(makeRequest({ lead_id: leadId, activity_type: "message_sent" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Insert failed" });
  });
});
