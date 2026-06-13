import { describe, expect, it } from "vitest";
import { promoteListingRequestSchema } from "@/lib/promotions/promotion-api-schemas";

const listingId = "11111111-1111-4111-8111-111111111111";

describe("promote listing request schema", () => {
  it("accepts supported promotion channels", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: listingId,
      channels: ["whatsapp", "facebook", "instagram", "portal"]
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts omitted channels so the route can apply defaults", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: listingId
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects direct as an agent promotion channel", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: listingId,
      channels: ["direct"]
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects an empty channel list", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: listingId,
      channels: []
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects more than four channels", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: listingId,
      channels: ["whatsapp", "facebook", "instagram", "portal", "whatsapp"]
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid listing IDs", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: "listing-1",
      channels: ["whatsapp"]
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects overly long instructions", () => {
    const parsed = promoteListingRequestSchema.safeParse({
      listing_id: listingId,
      instruction: "a".repeat(1001),
      channels: ["whatsapp"]
    });

    expect(parsed.success).toBe(false);
  });
});
