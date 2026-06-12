import { NextResponse } from "next/server";
import { requireCurrentBroker } from "@/lib/auth/current-user";

type SeedScenario = "primary" | "reactivate";

const seedTag = "[seed:followup-test]";

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function normalizeScenario(value: unknown): SeedScenario {
  return value === "reactivate" ? "reactivate" : "primary";
}

export async function GET() {
  return NextResponse.json({
    message: "POST this endpoint while signed in to seed follow-up test data for the current broker.",
    scenarios: {
      primary: "Creates first-reply and open-request recommendations. Reactivation candidates are also seeded but hidden while primary work exists.",
      reactivate: "Creates only reactivation candidates so optional check-ins appear."
    }
  });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_SEED !== "true") {
    return NextResponse.json({ error: "Test seed endpoint is disabled in production." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as { scenario?: unknown })
    : ({ scenario: (await request.formData().catch(() => new FormData())).get("scenario") } as { scenario?: unknown });
  const scenario = normalizeScenario(body.scenario);
  const { supabase, broker, user } = await requireCurrentBroker();

  const { data: existingSeedLeads, error: existingSeedLeadsError } = await supabase
    .from("leads")
    .select("id")
    .eq("broker_id", broker.id)
    .ilike("message", `%${seedTag}%`);

  if (existingSeedLeadsError) {
    return NextResponse.json({ error: existingSeedLeadsError.message }, { status: 500 });
  }

  const seedLeadIds = (existingSeedLeads ?? []).map((lead) => lead.id as string);

  if (seedLeadIds.length) {
    const { error: deleteActivitiesError } = await supabase
      .from("follow_up_activities")
      .delete()
      .eq("broker_id", broker.id)
      .in("lead_id", seedLeadIds);

    if (deleteActivitiesError) {
      return NextResponse.json({ error: deleteActivitiesError.message }, { status: 500 });
    }

    const { error: deleteLeadsError } = await supabase
      .from("leads")
      .delete()
      .eq("broker_id", broker.id)
      .in("id", seedLeadIds);

    if (deleteLeadsError) {
      return NextResponse.json({ error: deleteLeadsError.message }, { status: 500 });
    }
  }

  const { data: existingSeedListings, error: existingSeedListingsError } = await supabase
    .from("listings")
    .select("id")
    .eq("broker_id", broker.id)
    .ilike("title", `${seedTag}%`);

  if (existingSeedListingsError) {
    return NextResponse.json({ error: existingSeedListingsError.message }, { status: 500 });
  }

  const seedListingIds = (existingSeedListings ?? []).map((listing) => listing.id as string);

  if (seedListingIds.length) {
    const { error: deleteListingsError } = await supabase
      .from("listings")
      .delete()
      .eq("broker_id", broker.id)
      .in("id", seedListingIds);

    if (deleteListingsError) {
      return NextResponse.json({ error: deleteListingsError.message }, { status: 500 });
    }
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .insert([
      {
        broker_id: broker.id,
        status: "published",
        title: `${seedTag} Furnished 2-bed apartment in Gulberg`,
        description: "Seed listing for testing follow-up recommendations.",
        city: "Lahore",
        location_area: "Gulberg",
        property_type: "apartment",
        listing_type: "rent",
        price_amount: 200000,
        price_currency: "PKR",
        area_value: 1200,
        area_unit: "sqft",
        bedrooms: 2,
        bathrooms: 2,
        features: ["furnished", "near MM Alam Road", "family building"]
      },
      {
        broker_id: broker.id,
        status: "published",
        title: `${seedTag} 10 marla villa in DHA Phase 5`,
        description: "Seed listing for testing lead/listing context.",
        city: "Lahore",
        location_area: "DHA Phase 5",
        property_type: "villa",
        listing_type: "sale",
        price_amount: 85000000,
        price_currency: "PKR",
        area_value: 10,
        area_unit: "marla",
        bedrooms: 4,
        bathrooms: 5,
        features: ["corner", "near park", "renovated"]
      }
    ])
    .select("id, title");

  if (listingsError || !listings?.length) {
    return NextResponse.json({ error: listingsError?.message ?? "Unable to create seed listings." }, { status: 500 });
  }

  const gulbergListing = listings[0];
  const dhaListing = listings[1];
  const primaryLeads = [
    {
      broker_id: broker.id,
      listing_id: null,
      source_channel: "whatsapp",
      full_name: "Seed Ayesha New Yesterday",
      phone: "+923001110001",
      email: null,
      message: `${seedTag} New inquiry from yesterday. Looking for a furnished apartment in Gulberg.`,
      status: "new",
      urgency: "normal",
      ai_summary: "New customer asked for a furnished apartment in Gulberg.",
      last_contacted_at: null,
      next_follow_up_at: null,
      last_note: null,
      budget_min: null,
      budget_max: null,
      interested_area: "Gulberg",
      interested_listing_id: null,
      created_at: isoHoursAgo(30)
    },
    {
      broker_id: broker.id,
      listing_id: null,
      source_channel: "facebook",
      full_name: "Seed Omar New Uncontacted",
      phone: "+923001110002",
      email: null,
      message: `${seedTag} New lead from yesterday evening. Wants a 10 marla DHA option.`,
      status: "new",
      urgency: "normal",
      ai_summary: "New customer asked about DHA 10 marla options.",
      last_contacted_at: null,
      next_follow_up_at: null,
      last_note: null,
      budget_min: null,
      budget_max: null,
      interested_area: "DHA Phase 5",
      interested_listing_id: null,
      created_at: isoHoursAgo(26)
    },
    {
      broker_id: broker.id,
      listing_id: gulbergListing.id,
      source_channel: "whatsapp",
      full_name: "Seed Sara Open Request",
      phone: "+923001110003",
      email: null,
      message: `${seedTag} Customer asked for 3 furnished 2-bed options in Gulberg and MM Alam Road.`,
      status: "qualified",
      urgency: "high",
      ai_summary: "High intent. Budget and area are clear; customer asked for matching options.",
      last_contacted_at: isoHoursAgo(20),
      next_follow_up_at: null,
      last_note: "Asked agent to send matching options.",
      budget_min: 180000,
      budget_max: 220000,
      interested_area: "Gulberg",
      interested_listing_id: gulbergListing.id,
      created_at: isoHoursAgo(80)
    },
    {
      broker_id: broker.id,
      listing_id: dhaListing.id,
      source_channel: "phone",
      full_name: "Seed Bilal Due Promise",
      phone: "+923001110004",
      email: null,
      message: `${seedTag} Customer wanted DHA villa details and asked to be contacted today.`,
      status: "contacted",
      urgency: "normal",
      ai_summary: "Customer requested DHA Phase 5 villa details.",
      last_contacted_at: isoHoursAgo(36),
      next_follow_up_at: isoHoursAgo(2),
      last_note: "Promised to call back with DHA villa details.",
      budget_min: 80000000,
      budget_max: 90000000,
      interested_area: "DHA Phase 5",
      interested_listing_id: dhaListing.id,
      created_at: isoHoursAgo(120)
    },
    {
      broker_id: broker.id,
      listing_id: null,
      source_channel: "manual",
      full_name: "Seed Nadia Optional Check",
      phone: "+923001110005",
      email: null,
      message: `${seedTag} Contacted lead. No clear next task; may be worth checking later.`,
      status: "contacted",
      urgency: "normal",
      ai_summary: "Contacted previously, no active commitment.",
      last_contacted_at: isoHoursAgo(96),
      next_follow_up_at: null,
      last_note: "Asked to check again if new rentals come up.",
      budget_min: null,
      budget_max: null,
      interested_area: null,
      interested_listing_id: null,
      created_at: isoHoursAgo(180)
    }
  ];
  const reactivateLeads = [
    {
      broker_id: broker.id,
      listing_id: null,
      source_channel: "manual",
      full_name: "Seed Farah Optional Check",
      phone: "+923001110006",
      email: null,
      message: `${seedTag} Contacted lead with no active task. Test optional reactivation lane.`,
      status: "contacted",
      urgency: "normal",
      ai_summary: "Customer was contacted before but has no current next step.",
      last_contacted_at: isoHoursAgo(72),
      next_follow_up_at: null,
      last_note: "Could check whether still looking.",
      budget_min: null,
      budget_max: null,
      interested_area: null,
      interested_listing_id: null,
      created_at: isoHoursAgo(160)
    },
    {
      broker_id: broker.id,
      listing_id: null,
      source_channel: "manual",
      full_name: "Seed Hamza Optional Check",
      phone: "+923001110007",
      email: null,
      message: `${seedTag} Another contacted lead for optional check-in testing.`,
      status: "contacted",
      urgency: "normal",
      ai_summary: "No active request, but broker may want to check in.",
      last_contacted_at: isoHoursAgo(110),
      next_follow_up_at: null,
      last_note: "May still be searching.",
      budget_min: null,
      budget_max: null,
      interested_area: null,
      interested_listing_id: null,
      created_at: isoHoursAgo(220)
    }
  ];

  const leadsToInsert = scenario === "reactivate" ? reactivateLeads : primaryLeads;
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .insert(leadsToInsert)
    .select("id, full_name");

  if (leadsError || !leads?.length) {
    return NextResponse.json({ error: leadsError?.message ?? "Unable to create seed leads." }, { status: 500 });
  }

  const leadIdByName = new Map(leads.map((lead) => [lead.full_name as string, lead.id as string]));
  const activities =
    scenario === "reactivate"
      ? [
          {
            broker_id: broker.id,
            lead_id: leadIdByName.get("Seed Farah Optional Check"),
            activity_type: "note_added",
            channel: "whatsapp",
            summary: "Customer said she may resume search later. No active task.",
            source_type: "manual",
            occurred_at: isoHoursAgo(72),
            created_by: user.id
          },
          {
            broker_id: broker.id,
            lead_id: leadIdByName.get("Seed Hamza Optional Check"),
            activity_type: "note_added",
            channel: "phone",
            summary: "Customer was unsure and asked to check later if something good appears.",
            source_type: "manual",
            occurred_at: isoHoursAgo(110),
            created_by: user.id
          }
        ]
      : [
          {
            broker_id: broker.id,
            lead_id: leadIdByName.get("Seed Sara Open Request"),
            related_listing_id: gulbergListing.id,
            activity_type: "note_added",
            channel: "whatsapp",
            summary: "Customer asked for 3 furnished 2-bed options in Gulberg or near MM Alam Road.",
            source_type: "manual",
            occurred_at: isoHoursAgo(18),
            created_by: user.id
          },
          {
            broker_id: broker.id,
            lead_id: leadIdByName.get("Seed Bilal Due Promise"),
            related_listing_id: dhaListing.id,
            activity_type: "reminder_created",
            channel: "phone",
            summary: "Promised to call back with DHA Phase 5 villa details.",
            next_follow_up_at: isoHoursAgo(2),
            source_type: "manual",
            occurred_at: isoHoursAgo(30),
            created_by: user.id
          },
          {
            broker_id: broker.id,
            lead_id: leadIdByName.get("Seed Nadia Optional Check"),
            activity_type: "note_added",
            channel: "whatsapp",
            summary: "No urgent task. Optional future check-in only.",
            source_type: "manual",
            occurred_at: isoHoursAgo(96),
            created_by: user.id
          }
        ];
  const validActivities = activities.filter((activity) => activity.lead_id);

  if (validActivities.length) {
    const { error: activitiesError } = await supabase.from("follow_up_activities").insert(validActivities);

    if (activitiesError) {
      return NextResponse.json({ error: activitiesError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    scenario,
    listings: listings.map((listing) => listing.title),
    leads: leads.map((lead) => lead.full_name),
    next_steps:
      scenario === "primary"
        ? [
            "Open the Agent chat and ask: follow up",
            "Expected: First reply leads appear first, then open task / handle request leads. Optional check-in seed should not appear yet."
          ]
        : [
            "Open the Agent chat and ask: follow up",
            "Expected: only optional Check again recommendations appear because no first-reply or open-task seed leads exist."
          ]
  });
}
