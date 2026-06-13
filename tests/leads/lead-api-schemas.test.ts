import { describe, expect, it } from "vitest";
import { leadUpdateSchema, manualLeadCreateSchema } from "../../lib/leads/lead-api-schemas";

const leadId = "11111111-1111-4111-8111-111111111111";

describe("manualLeadCreateSchema", () => {
  it("requires at least a name, phone, or email for manual lead creation", () => {
    const result = manualLeadCreateSchema.safeParse({
      message: "Budget 5 crore, looking for DHA Phase 5."
    });

    expect(result.success).toBe(false);
  });

  it("accepts a lead with only a phone number and applies defaults", () => {
    const result = manualLeadCreateSchema.safeParse({
      phone: "03001112223",
      message: "Looking for 10 marla DHA Phase 5."
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        phone: "03001112223",
        status: "new",
        urgency: "normal",
        source_channel: "manual"
      });
    }
  });
});

describe("leadUpdateSchema", () => {
  it("requires at least one update field besides id", () => {
    const result = leadUpdateSchema.safeParse({
      id: leadId
    });

    expect(result.success).toBe(false);
  });

  it("rejects last_contacted_at so contact state can only change through follow-up activity effects", () => {
    const result = leadUpdateSchema.safeParse({
      id: leadId,
      last_contacted_at: "2026-06-13T13:00:00.000Z"
    });

    expect(result.success).toBe(false);
  });

  it("accepts ordinary detail and status updates", () => {
    const result = leadUpdateSchema.safeParse({
      id: leadId,
      phone: "03009998887",
      status: "qualified",
      urgency: "high",
      last_note: "Budget confirmed."
    });

    expect(result.success).toBe(true);
  });
});
