import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/promote-listing/route";
import { generateListingPromotion } from "@/lib/agent/promotions";
import { requireCurrentBroker } from "@/lib/auth/current-user";

vi.mock("@/lib/agent/promotions", () => ({
  generateListingPromotion: vi.fn()
}));

vi.mock("@/lib/auth/current-user", () => ({
  requireCurrentBroker: vi.fn()
}));

const listingId = "11111111-1111-4111-8111-111111111111";
const brokerId = "22222222-2222-4222-8222-222222222222";
const imageId = "33333333-3333-4333-8333-333333333333";
const videoId = "44444444-4444-4444-8444-444444444444";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/agent/promote-listing", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function makeListing() {
  return {
    id: listingId,
    broker_id: brokerId,
    status: "draft",
    title: "10 Marla House in DHA",
    description: "Ready to move family house.",
    city: "Lahore",
    location_area: "DHA Phase 6",
    property_type: "house",
    listing_type: "sale",
    price_amount: 55000000,
    price_currency: "PKR",
    area_value: 10,
    area_unit: "marla",
    bedrooms: 4,
    bathrooms: 5,
    features: ["corner", "near park"],
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    listing_media: [
      {
        id: videoId,
        listing_id: listingId,
        media_type: "video",
        storage_url: "https://example.com/video.mp4",
        sort_order: 2,
        created_at: "2026-06-01T00:00:00.000Z"
      },
      {
        id: imageId,
        listing_id: listingId,
        media_type: "image",
        storage_url: "https://example.com/image.jpg",
        sort_order: 1,
        created_at: "2026-06-01T00:00:00.000Z"
      }
    ]
  };
}

function makeSupabase(options: { listing?: unknown; listingError?: Error; campaignError?: Error } = {}) {
  const campaignInserts: unknown[] = [];
  const auditInserts: unknown[] = [];
  const listing = Object.prototype.hasOwnProperty.call(options, "listing") ? options.listing : makeListing();

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "listings") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          single: vi.fn(async () => ({
            data: listing,
            error: options.listingError ?? null
          }))
        };
        return chain;
      }

      if (table === "campaign_links") {
        const chain = {
          insert: vi.fn((payload: unknown) => {
            campaignInserts.push(payload);
            return chain;
          }),
          select: vi.fn(() => chain),
          single: vi.fn(async () => ({
            data: options.campaignError
              ? null
              : {
                  code: `campaign-${campaignInserts.length}`,
                  destination_url: `https://pislaka.test/p/campaign-${campaignInserts.length}`
                },
            error: options.campaignError ?? null
          }))
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

  return { supabase, campaignInserts, auditInserts };
}

const mockedRequireCurrentBroker = vi.mocked(requireCurrentBroker);
const mockedGenerateListingPromotion = vi.mocked(generateListingPromotion);

describe("promote listing route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGenerateListingPromotion.mockResolvedValue({
      summary: "Promotion pack",
      cards: [
        {
          channel: "whatsapp",
          title: "WhatsApp title",
          body: "WhatsApp body",
          cta: "Reply now",
          image_brief: "Use hero image"
        },
        {
          channel: "facebook",
          title: "Facebook title",
          body: "Facebook body",
          cta: "Message now",
          image_brief: "Use exterior image"
        }
      ]
    });
  });

  it("returns 400 for invalid payloads before broker lookup", async () => {
    const response = await POST(
      makeRequest({
        listing_id: "listing-1",
        channels: ["direct"]
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid promotion payload" });
    expect(mockedRequireCurrentBroker).not.toHaveBeenCalled();
  });

  it("returns 401 when the broker is not authenticated", async () => {
    mockedRequireCurrentBroker.mockRejectedValue(new Error("Unauthorized"));

    const response = await POST(makeRequest({ listing_id: listingId }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when the listing is not found for the broker", async () => {
    const { supabase } = makeSupabase({ listing: null });
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(makeRequest({ listing_id: listingId }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Listing not found" });
  });

  it("generates promotion cards, campaign links, and an audit log", async () => {
    const { supabase, campaignInserts, auditInserts } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(
      makeRequest({
        listing_id: listingId,
        instruction: "Focus on families",
        channels: ["whatsapp", "facebook"]
      })
    );

    expect(response.status).toBe(200);
    expect(mockedGenerateListingPromotion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: listingId,
        media: [
          expect.objectContaining({ id: imageId, sort_order: 1 }),
          expect.objectContaining({ id: videoId, sort_order: 2 })
        ]
      }),
      "Focus on families",
      ["whatsapp", "facebook"]
    );
    expect(campaignInserts).toHaveLength(2);
    expect(campaignInserts[0]).toMatchObject({
      listing_id: listingId,
      broker_id: brokerId,
      channel: "whatsapp",
      generated_copy: "WhatsApp title\n\nWhatsApp body\n\nReply now"
    });
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0]).toMatchObject({
      broker_id: brokerId,
      actor_type: "agent",
      action: "generate_listing_promotion",
      entity_type: "listing",
      entity_id: listingId,
      metadata: {
        source: "agent_promote_listing",
        channel_count: 2
      }
    });

    const body = await response.json();
    expect(body.promotion.cards[0]).toMatchObject({
      channel: "whatsapp",
      campaign_code: "campaign-1",
      landing_url: "https://pislaka.test/p/campaign-1"
    });
    expect(body.promotion.cards[0].whatsapp_share_url).toContain("https://wa.me/?text=");
    expect(body.promotion.cards[1].whatsapp_share_url).toBeUndefined();
  });

  it("uses all default promotion channels when channels are omitted", async () => {
    const { supabase } = makeSupabase();
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    await POST(makeRequest({ listing_id: listingId }));

    expect(mockedGenerateListingPromotion).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      ["whatsapp", "facebook", "instagram", "portal"]
    );
  });

  it("returns 500 when a campaign link cannot be created", async () => {
    const { supabase } = makeSupabase({ campaignError: new Error("Insert failed") });
    mockedRequireCurrentBroker.mockResolvedValue({
      supabase: supabase as never,
      user: { id: "user-1" } as never,
      broker: { id: brokerId } as never
    });

    const response = await POST(makeRequest({ listing_id: listingId, channels: ["whatsapp"] }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Insert failed" });
  });
});
