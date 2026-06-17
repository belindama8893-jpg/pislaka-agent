import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAgentActionEntities } from "../../lib/agent/entity-resolution";
import type { AgentAction } from "../../lib/agent/types";
import type { LeadListItem } from "../../lib/leads/types";
import type { ListingRecord } from "../../lib/listings/types";
import { getRecentLeadsForBroker } from "@/lib/leads/queries";

vi.mock("@/lib/leads/queries", () => ({
  getRecentLeadsForBroker: vi.fn()
}));

const brokerId = "11111111-1111-4111-8111-111111111111";
const ahmedOneId = "22222222-2222-4222-8222-222222222222";
const ahmedTwoId = "33333333-3333-4333-8333-333333333333";
const saraId = "44444444-4444-4444-8444-444444444444";
const dhaSixHouseId = "55555555-5555-4555-8555-555555555555";
const dhaSixVillaId = "66666666-6666-4666-8666-666666666666";
const bahriaHouseId = "77777777-7777-4777-8777-777777777777";

function makeSupabaseWithListings(listings: ListingRecord[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: listings,
      error: null
    })
  };

  return {
    from: vi.fn(() => query)
  } as never;
}

function makeLead(overrides: Partial<LeadListItem>): LeadListItem {
  const id = overrides.id ?? crypto.randomUUID();
  const now = "2026-06-13T12:00:00.000Z";

  return {
    id,
    broker_id: brokerId,
    listing_id: null,
    campaign_link_id: null,
    source_channel: "manual",
    full_name: null,
    phone: null,
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
    listing_title: null,
    listing_area: null,
    listing_city: null,
    campaign_code: null,
    campaign_channel: null,
    ...overrides
  };
}

function updateLeadStatusAction(payload: Record<string, unknown>): AgentAction {
  return {
    intent: "update_lead_status",
    requires_confirmation: true,
    response: "Please confirm the lead update.",
    payload
  };
}

function updateLeadDetailsAction(payload: Record<string, unknown>): AgentAction {
  return {
    intent: "update_lead_details",
    requires_confirmation: true,
    response: "Please confirm the lead details update.",
    payload
  };
}

function updateListingAction(payload: Record<string, unknown>): AgentAction {
  return {
    intent: "update_listing_draft",
    requires_confirmation: true,
    response: "Please confirm the listing update.",
    payload
  };
}

function promotionAction(payload: Record<string, unknown>): AgentAction {
  return {
    intent: "create_campaign_links",
    requires_confirmation: true,
    response: "Please confirm the listing promotion.",
    payload
  };
}

function makeListing(overrides: Partial<ListingRecord>): ListingRecord {
  const id = overrides.id ?? crypto.randomUUID();
  const now = "2026-06-13T12:00:00.000Z";

  return {
    id,
    status: "draft",
    title: null,
    description: null,
    city: "Lahore",
    location_area: null,
    property_type: "house",
    listing_type: "sale",
    price_amount: null,
    price_currency: "PKR",
    area_value: null,
    area_unit: null,
    bedrooms: null,
    bathrooms: null,
    features: [],
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

describe("resolveAgentActionEntities lead resolution", () => {
  const getRecentLeadsForBrokerMock = vi.mocked(getRecentLeadsForBroker);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("matches a lead by exact phone before executing a write action", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: saraId,
        full_name: "Sara Malik",
        phone: "0300 9998887"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadStatusAction({
        query: "Mark phone 0300 9998887 as contacted",
        status: "contacted"
      }),
      makeSupabaseWithListings([]),
      brokerId
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "lead",
      target_id: saraId
    });
    expect(resolved.payload).toMatchObject({
      lead_id: saraId,
      status: "contacted"
    });
  });

  it("returns ambiguous candidates instead of choosing between similarly named leads", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: ahmedOneId,
        full_name: "Ahmed Raza",
        phone: "03001112223"
      }),
      makeLead({
        id: ahmedTwoId,
        full_name: "Ahmed Khan",
        phone: "03004445556"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadStatusAction({
        lead_name: "Ahmed",
        status: "qualified",
        urgency: "high"
      }),
      makeSupabaseWithListings([]),
      brokerId
    );

    expect(resolved.resolution?.status).toBe("ambiguous");
    expect(resolved.resolution?.target_type).toBe("lead");
    expect(resolved.resolution?.candidates?.map((candidate) => candidate.id)).toEqual([
      ahmedOneId,
      ahmedTwoId
    ]);
    expect(resolved.payload).not.toHaveProperty("lead_id");
  });

  it("returns no_match and does not attach the latest lead for an unmatched requested name", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: saraId,
        full_name: "Sara Malik",
        phone: "0300 9998887"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadStatusAction({
        lead_name: "Bilal",
        status: "contacted"
      }),
      makeSupabaseWithListings([]),
      brokerId
    );

    expect(resolved.resolution).toMatchObject({
      status: "no_match",
      target_type: "lead"
    });
    expect(resolved.payload).not.toHaveProperty("lead_id");
  });

  it("uses the extracted lead name instead of noisy detail-update text for target matching", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: ahmedTwoId,
        full_name: "Ahmed Khan"
      }),
      makeLead({
        id: saraId,
        full_name: "Sara Malik",
        phone: "03009998887"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadDetailsAction({
        lead_name: "Ahmed",
        query: "Update lead Ahmed phone to 0300 9998887",
        phone: "03009998887"
      }),
      makeSupabaseWithListings([]),
      brokerId
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "lead",
      target_id: ahmedTwoId
    });
    expect(resolved.payload).toMatchObject({
      lead_id: ahmedTwoId,
      phone: "03009998887"
    });
  });

  it("uses an explicit selected lead context without searching by latest record", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: saraId,
        full_name: "Sara Malik"
      }),
      makeLead({
        id: ahmedOneId,
        full_name: "Ahmed Raza"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadStatusAction({
        query: "Mark this lead as hot",
        status: "qualified",
        urgency: "high"
      }),
      makeSupabaseWithListings([]),
      brokerId,
      { currentLeadId: saraId }
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "lead",
      target_id: saraId
    });
    expect(resolved.payload).toMatchObject({
      lead_id: saraId,
      status: "qualified",
      urgency: "high"
    });
  });

  it("does not use the current lead id when the broker names a different unresolved lead", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: saraId,
        full_name: "Sara Malik"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadStatusAction({
        query: "Mark Bilal as hot",
        lead_name: "Bilal",
        status: "qualified",
        urgency: "high"
      }),
      makeSupabaseWithListings([]),
      brokerId,
      { currentLeadId: saraId }
    );

    expect(resolved.resolution).toMatchObject({
      status: "no_match",
      target_type: "lead"
    });
    expect(resolved.payload).not.toHaveProperty("lead_id");
  });

  it("uses an attached lead context as an explicit target", async () => {
    getRecentLeadsForBrokerMock.mockResolvedValue([
      makeLead({
        id: saraId,
        full_name: "Sara Malik"
      })
    ]);

    const resolved = await resolveAgentActionEntities(
      updateLeadStatusAction({
        query: "Mark as hot",
        status: "qualified",
        urgency: "high"
      }),
      makeSupabaseWithListings([]),
      brokerId,
      {
        contextAttachments: [
          {
            id: `lead:${saraId}`,
            type: "lead",
            entity_id: saraId
          }
        ]
      }
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "lead",
      target_id: saraId
    });
    expect(resolved.payload).toMatchObject({
      lead_id: saraId
    });
  });
});

describe("resolveAgentActionEntities listing resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("matches a listing by area, size, and property type", async () => {
    const resolved = await resolveAgentActionEntities(
      promotionAction({
        query: "Promote my DHA Phase 6 1 kanal house on WhatsApp"
      }),
      makeSupabaseWithListings([
        makeListing({
          id: dhaSixHouseId,
          title: "1 Kanal House in DHA Phase 6",
          location_area: "DHA Phase 6",
          property_type: "house",
          area_value: 1,
          area_unit: "kanal"
        }),
        makeListing({
          id: bahriaHouseId,
          title: "1 Kanal House in Bahria Town",
          location_area: "Bahria Town",
          property_type: "house",
          area_value: 1,
          area_unit: "kanal"
        })
      ]),
      brokerId
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "listing",
      target_id: dhaSixHouseId
    });
    expect(resolved.payload).toMatchObject({
      listing_id: dhaSixHouseId
    });
  });

  it("returns ambiguous candidates instead of choosing between similar listings", async () => {
    const resolved = await resolveAgentActionEntities(
      promotionAction({
        query: "Promote my DHA Phase 6 house"
      }),
      makeSupabaseWithListings([
        makeListing({
          id: dhaSixHouseId,
          title: "DHA Phase 6 House A",
          location_area: "DHA Phase 6",
          property_type: "house"
        }),
        makeListing({
          id: dhaSixVillaId,
          title: "DHA Phase 6 House B",
          location_area: "DHA Phase 6",
          property_type: "house"
        })
      ]),
      brokerId
    );

    expect(resolved.resolution?.status).toBe("ambiguous");
    expect(resolved.resolution?.target_type).toBe("listing");
    expect(resolved.resolution?.candidates?.map((candidate) => candidate.id)).toEqual([
      dhaSixHouseId,
      dhaSixVillaId
    ]);
    expect(resolved.payload).not.toHaveProperty("listing_id");
  });

  it("returns no_match and does not attach the latest listing for an unmatched requested listing", async () => {
    const resolved = await resolveAgentActionEntities(
      updateListingAction({
        query: "Change my Gulberg penthouse price to 7 crore",
        price_amount: 70000000
      }),
      makeSupabaseWithListings([
        makeListing({
          id: dhaSixHouseId,
          title: "1 Kanal House in DHA Phase 6",
          location_area: "DHA Phase 6",
          property_type: "house",
          area_value: 1,
          area_unit: "kanal"
        })
      ]),
      brokerId
    );

    expect(resolved.resolution).toMatchObject({
      status: "no_match",
      target_type: "listing"
    });
    expect(resolved.payload).not.toHaveProperty("listing_id");
  });

  it("uses current listing context only when the query says this or current", async () => {
    const resolved = await resolveAgentActionEntities(
      updateListingAction({
        query: "Change this listing price to 8.3 crore",
        price_amount: 83000000
      }),
      makeSupabaseWithListings([
        makeListing({
          id: dhaSixHouseId,
          title: "1 Kanal House in DHA Phase 6",
          location_area: "DHA Phase 6"
        })
      ]),
      brokerId,
      { currentListingId: dhaSixHouseId }
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "listing",
      target_id: dhaSixHouseId
    });
    expect(resolved.payload).toMatchObject({
      listing_id: dhaSixHouseId,
      price_amount: 83000000
    });
  });

  it("uses latest listing only when the broker explicitly asks for latest", async () => {
    const resolved = await resolveAgentActionEntities(
      promotionAction({
        query: "Promote my latest listing on WhatsApp"
      }),
      makeSupabaseWithListings([
        makeListing({
          id: dhaSixHouseId,
          title: "Most recently updated listing",
          location_area: "DHA Phase 6"
        }),
        makeListing({
          id: bahriaHouseId,
          title: "Older listing",
          location_area: "Bahria Town"
        })
      ]),
      brokerId
    );

    expect(resolved.resolution).toMatchObject({
      status: "matched",
      target_type: "listing",
      target_id: dhaSixHouseId
    });
    expect(resolved.payload).toMatchObject({
      listing_id: dhaSixHouseId
    });
  });
});
