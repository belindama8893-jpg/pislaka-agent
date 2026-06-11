import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadListItem, LeadRecord, TodayFollowUpLead } from "@/lib/leads/types";

export const leadBaseSelect =
  "id, broker_id, listing_id, campaign_link_id, source_channel, full_name, phone, email, message, status, urgency, ai_summary, last_contacted_at, next_follow_up_at, last_note, budget_min, budget_max, interested_area, interested_listing_id, created_at, updated_at";
const legacyLeadBaseSelect =
  "id, broker_id, listing_id, campaign_link_id, source_channel, full_name, phone, email, message, status, urgency, ai_summary, created_at, updated_at";

function withFollowUpDefaults(lead: Partial<LeadRecord>): LeadRecord {
  return {
    id: lead.id ?? "",
    broker_id: lead.broker_id ?? "",
    listing_id: lead.listing_id ?? null,
    campaign_link_id: lead.campaign_link_id ?? null,
    source_channel: lead.source_channel ?? null,
    full_name: lead.full_name ?? null,
    phone: lead.phone ?? null,
    email: lead.email ?? null,
    message: lead.message ?? null,
    status: lead.status ?? "new",
    urgency: lead.urgency ?? null,
    ai_summary: lead.ai_summary ?? null,
    last_contacted_at: lead.last_contacted_at ?? null,
    next_follow_up_at: lead.next_follow_up_at ?? null,
    last_note: lead.last_note ?? null,
    budget_min: lead.budget_min ?? null,
    budget_max: lead.budget_max ?? null,
    interested_area: lead.interested_area ?? null,
    interested_listing_id: lead.interested_listing_id ?? null,
    created_at: lead.created_at ?? new Date(0).toISOString(),
    updated_at: lead.updated_at ?? null
  };
}

type ListingLookup = {
  id: string;
  title: string | null;
  location_area: string | null;
  city: string | null;
};

type CampaignLookup = {
  id: string;
  code: string | null;
  channel: string | null;
};

async function hydrateLeadRows(
  supabase: SupabaseClient,
  leads: Partial<LeadRecord>[]
): Promise<LeadListItem[]> {
  const leadRows = leads.map(withFollowUpDefaults);
  const listingIds = Array.from(
    new Set(leadRows.map((lead) => lead.listing_id).filter((id): id is string => Boolean(id)))
  );
  const campaignIds = Array.from(
    new Set(leadRows.map((lead) => lead.campaign_link_id).filter((id): id is string => Boolean(id)))
  );

  const [{ data: listings }, { data: campaigns }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, title, location_area, city").in("id", listingIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length
      ? supabase.from("campaign_links").select("id, code, channel").in("id", campaignIds)
      : Promise.resolve({ data: [] })
  ]);

  const listingById = new Map(
    ((listings ?? []) as ListingLookup[]).map((listing) => [listing.id, listing])
  );
  const campaignById = new Map(
    ((campaigns ?? []) as CampaignLookup[]).map((campaign) => [campaign.id, campaign])
  );

  return leadRows.map((lead) => {
    const listing = lead.listing_id ? listingById.get(lead.listing_id) : undefined;
    const campaign = lead.campaign_link_id ? campaignById.get(lead.campaign_link_id) : undefined;

    return {
      ...lead,
      listing_title: listing?.title ?? null,
      listing_area: listing?.location_area ?? null,
      listing_city: listing?.city ?? null,
      campaign_code: campaign?.code ?? null,
      campaign_channel: campaign?.channel ?? null
    };
  });
}

export async function getRecentLeadsForBroker(
  supabase: SupabaseClient,
  brokerId: string,
  limit = 6,
  options: { includeClosed?: boolean } = {}
): Promise<LeadListItem[]> {
  let query = supabase
    .from("leads")
    .select(leadBaseSelect)
    .eq("broker_id", brokerId);

  if (!options.includeClosed) {
    query = query.neq("status", "closed").neq("status", "lost");
  }

  const initialResult = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  let leads = initialResult.data as unknown[] | null;
  let error = initialResult.error;

  if (error && /last_contacted_at|next_follow_up_at|last_note|budget_min|interested_area/i.test(error.message)) {
    let legacyQuery = supabase
      .from("leads")
      .select(legacyLeadBaseSelect)
      .eq("broker_id", brokerId);

    if (!options.includeClosed) {
      legacyQuery = legacyQuery.neq("status", "closed").neq("status", "lost");
    }

    const legacyResult = await legacyQuery
      .order("created_at", { ascending: false })
      .limit(limit);

    leads = legacyResult.data as unknown[] | null;
    error = legacyResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return hydrateLeadRows(supabase, (leads ?? []) as Partial<LeadRecord>[]);
}

export async function getLeadsByIdsForBroker(
  supabase: SupabaseClient,
  brokerId: string,
  leadIds: string[]
): Promise<LeadListItem[]> {
  const ids = Array.from(new Set(leadIds.filter(Boolean)));
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("leads")
    .select(leadBaseSelect)
    .eq("broker_id", brokerId)
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return hydrateLeadRows(supabase, (data ?? []) as Partial<LeadRecord>[]);
}

function getLeadTime(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function buildFollowUpRecommendation(lead: LeadListItem, now: Date) {
  const nextFollowUpAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
  const lastContactedAt = lead.last_contacted_at ? new Date(lead.last_contacted_at) : null;
  const createdAt = new Date(lead.created_at);
  const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / 36e5;
  const hoursSinceContacted = lastContactedAt
    ? (now.getTime() - lastContactedAt.getTime()) / 36e5
    : Number.POSITIVE_INFINITY;

  if (nextFollowUpAt && nextFollowUpAt.getTime() <= now.getTime()) {
    return {
      recommended_reason: "Follow-up reminder is due.",
      recommended_action: "Send WhatsApp reply"
    };
  }

  if (lead.urgency === "high" || lead.status === "qualified") {
    return {
      recommended_reason: "High-intent lead needs active follow-up.",
      recommended_action: "Send WhatsApp reply"
    };
  }

  if (lead.status === "new" && !lead.last_contacted_at && hoursSinceCreated >= 24) {
    return {
      recommended_reason: "New lead has not been contacted for over 24 hours.",
      recommended_action: "Send first WhatsApp reply"
    };
  }

  if (lead.status === "contacted" && hoursSinceContacted >= 48) {
    return {
      recommended_reason: "Contacted lead has no recent follow-up.",
      recommended_action: "Ask for next step"
    };
  }

  return {
    recommended_reason: "Recent lead worth checking today.",
    recommended_action: lead.phone ? "Review and reply" : "Review lead"
  };
}

function followUpPriority(lead: LeadListItem, now: Date) {
  const nextFollowUpAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
  const createdAt = new Date(lead.created_at);
  const lastContactedAt = lead.last_contacted_at ? new Date(lead.last_contacted_at) : null;
  const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / 36e5;
  const hoursSinceContacted = lastContactedAt
    ? (now.getTime() - lastContactedAt.getTime()) / 36e5
    : Number.POSITIVE_INFINITY;

  if (nextFollowUpAt && nextFollowUpAt.getTime() <= now.getTime()) {
    return 10_000 + Math.max(0, now.getTime() - nextFollowUpAt.getTime()) / 60000;
  }

  if (lead.urgency === "high" || lead.status === "qualified") {
    return 8_000 + hoursSinceContacted;
  }

  if (lead.status === "new" && !lead.last_contacted_at && hoursSinceCreated >= 24) {
    return 6_000 + hoursSinceCreated;
  }

  if (lead.status === "contacted" && hoursSinceContacted >= 48) {
    return 4_000 + hoursSinceContacted;
  }

  return Math.max(0, 1_000 - (now.getTime() - getLeadTime(lead.created_at)) / 36e5);
}

function shouldShowTodayFollowUp(lead: LeadListItem, now: Date) {
  const nextFollowUpAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
  const createdAt = new Date(lead.created_at);
  const lastContactedAt = lead.last_contacted_at ? new Date(lead.last_contacted_at) : null;
  const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / 36e5;
  const hoursSinceContacted = lastContactedAt
    ? (now.getTime() - lastContactedAt.getTime()) / 36e5
    : Number.POSITIVE_INFINITY;

  return Boolean(
    (nextFollowUpAt && nextFollowUpAt.getTime() <= now.getTime()) ||
      lead.urgency === "high" ||
      lead.status === "qualified" ||
      (lead.status === "new" && !lead.last_contacted_at && hoursSinceCreated >= 24) ||
      (lead.status === "contacted" && hoursSinceContacted >= 48)
  );
}

export async function getTodayFollowUpsForBroker(
  supabase: SupabaseClient,
  brokerId: string,
  limit = 12
): Promise<TodayFollowUpLead[]> {
  const leads = await getRecentLeadsForBroker(supabase, brokerId, 100);
  const now = new Date();

  return leads
    .filter((lead) => shouldShowTodayFollowUp(lead, now))
    .map((lead) => ({
      ...lead,
      ...buildFollowUpRecommendation(lead, now)
    }))
    .sort((left, right) => followUpPriority(right, now) - followUpPriority(left, now))
    .slice(0, Math.min(Math.max(limit, 1), 30));
}
