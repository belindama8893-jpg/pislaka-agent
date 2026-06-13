import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH, POST } from "@/app/api/leads/route";
import { generateLeadSummary } from "@/lib/agent/lead-summaries";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import type { LeadRecord } from "@/lib/leads/types";

vi.mock("@/lib/agent/lead-summaries", () => ({
  generateLeadSummary: vi.fn()
}));

vi.mock("@/lib/auth/current-user", () => ({
  requireCurrentBroker: vi.fn()
}));

const leadId = "11111111-1111-4111-8111-111111111111";
const brokerId = "22222222-2222-4222-8222-222222222222";
const listingId = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function makeLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  const now = "2026-06-13T12:00:00.000Z";

  return {
    id: leadId,
    broker_id: brokerId,
    listing_id: null,
    campaign_link_id: null,
    source_channel: "manual",
    full_name: "Ahmed Raza",
    phone: "03001112223",
    email: null,
    message: null,
    status: "new",
    urgency: "normal",
    ai_summary: "Buyer asked about DHA Phase 6.",
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

function makeSupabase(
  options: {
    existingLead?: LeadRecord | null;
    leadError?: Error;
    updateError?: Error;
  } = {}
) {
  const existingLead = Object.prototype.hasOwnProperty.call(options, "existingLead")
    ? options.existingLead
    : makeLead();
  const leadInserts: unknown[] = [];
  const leadUpdates: unknown[] = [];
  const auditInserts: unknown[] = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "listings") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({
            data: {
              id: listingId,
              title: "DHA House",
              city: "Lahore",
              location_area: "DHA Phase 6",
              property_type: "house",
              listing_type: "sale"
            },
            error: null
          }))
        };
        return chain;
      }

      if (table === "leads") {
        let insertPayload: Record<string, unknown> | undefined;
        let updatePayload: Record<string, unknown> | undefined;
        const chain = {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertPayload = payload;
            leadInserts.push(payload);
            return chain;
          }),
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayload = payload;
            leadUpdates.push(payload);
            return chain;
          }),
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          single: vi.fn(async () => {
            if (insertPayload) {
              return {
                data: options.leadError ? null : makeLead(insertPayload as Partial<LeadRecord>),
                error: options.leadError ?? null
              };
            }

            if (updatePayload) {
              return {
                data:
                  options.updateError || !existingLead
                    ? null
                    : {
                        ...existingLead,
                        ...updatePayload
                      },
                error: options.updateError ?? null
              };
            }

            return {
              data: existingLead,
              error: existingLead ? null : new Error("Lead not found")
            };
          })
        };
        return chain;
      }

      if (table === "audit_logs") {
        return {
          insert: vi.fn((payload: unknown) => {
            auditInserts.push(payload);
            return { data: null, error: null };
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    })
  };

  return { supabase, leadInserts, leadUpdates, auditInserts };
}

const mockedRequireCurrentBroker = vi.mocked(requireCurrentBroker);
const mockedGenerateLeadSummary = vi.mocked(generateLeadSummary);

describe("leads route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerateLeadSummary.mockResolvedValue("Buyer asked about DHA Phase 6.");
  });

  it("returns 400 for invalid manual lead payloads before broker lookup", async () => {
    const response = await POST(makeRequest({ message: "No contact information." }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid lead payload" });
    expect(mockedRequireCurrentBroker).not.toHaveBeenCalled();
  });

  it("returns 401 when creating a manual lead without authentication", async () => {
    mockedRequireCurrentBroker.mockRejectedValue(new Error("Unauthorized"));

    const response = await POST(makeRequest({ full_name: "Ahmed Raza" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("creates a manual lead and writes an audit log", async () => {
    const { supabase, leadInserts, auditInserts } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(
      makeRequest({
        listing_id: listingId,
        full_name: "Ahmed Raza",
        phone: "03001112223",
        message: "Need viewing this weekend.",
        urgency: "high"
      })
    );

    expect(response.status).toBe(200);
    expect(mockedGenerateLeadSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Ahmed Raza",
        phone: "03001112223",
        message: "Need viewing this weekend.",
        channel: "manual",
        listing: expect.objectContaining({ id: listingId })
      })
    );
    expect(leadInserts[0]).toMatchObject({
      broker_id: brokerId,
      listing_id: listingId,
      campaign_link_id: null,
      source_channel: "manual",
      full_name: "Ahmed Raza",
      phone: "03001112223",
      message: "Need viewing this weekend.",
      ai_summary: "Buyer asked about DHA Phase 6.",
      urgency: "high",
      status: "new"
    });
    expect(auditInserts[0]).toMatchObject({
      broker_id: brokerId,
      actor_type: "user",
      action: "create_lead",
      entity_type: "lead",
      entity_id: leadId,
      metadata: { source: "api" }
    });
  });

  it("rejects lead updates that try to set last_contacted_at", async () => {
    const response = await PATCH(
      makeRequest({
        id: leadId,
        last_contacted_at: "2026-06-13T13:00:00.000Z"
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid lead update payload" });
    expect(mockedRequireCurrentBroker).not.toHaveBeenCalled();
  });

  it("returns 404 when updating a lead that is not owned by the broker", async () => {
    const { supabase } = makeSupabase({ existingLead: null });
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    const response = await PATCH(makeRequest({ id: leadId, status: "qualified" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Lead not found" });
  });

  it("updates allowed lead fields and writes an audit log", async () => {
    const { supabase, leadUpdates, auditInserts } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    const response = await PATCH(
      makeRequest({
        id: leadId,
        status: "qualified",
        urgency: "high",
        last_note: "Confirmed budget and viewing window."
      })
    );

    expect(response.status).toBe(200);
    expect(leadUpdates[0]).toMatchObject({
      status: "qualified",
      urgency: "high",
      last_note: "Confirmed budget and viewing window.",
      updated_at: expect.any(String)
    });
    expect(leadUpdates[0]).not.toHaveProperty("last_contacted_at");
    expect(auditInserts[0]).toMatchObject({
      broker_id: brokerId,
      actor_type: "user",
      action: "update_lead",
      entity_type: "lead",
      entity_id: leadId,
      metadata: { source: "api" }
    });
  });
});
