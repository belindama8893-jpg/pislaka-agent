import type { SupabaseClient } from "@supabase/supabase-js";
import type { FollowUpActivityRecord, LeadListItem, LeadRecord, TodayFollowUpLead } from "@/lib/leads/types";

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

export async function getNewLeadsCountForBroker(supabase: SupabaseClient, brokerId: string) {
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("broker_id", brokerId)
    .eq("status", "new");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
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

export async function getFollowUpActivitiesForLead(
  supabase: SupabaseClient,
  brokerId: string,
  leadId: string,
  limit = 30
): Promise<FollowUpActivityRecord[]> {
  const { data, error } = await supabase
    .from("follow_up_activities")
    .select(
      "id, broker_id, lead_id, related_listing_id, activity_type, channel, summary, message_draft, old_status, new_status, next_follow_up_at, source_type, original_chat_saved, original_chat_text, occurred_at, created_at, created_by"
    )
    .eq("broker_id", brokerId)
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FollowUpActivityRecord[];
}

function getActivitySummary(activity: FollowUpActivityRecord | undefined) {
  return activity?.summary?.trim() || activity?.message_draft?.trim() || null;
}

function compactText(value: string | null | undefined, maxLength = 130) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function formatElapsedHours(hours: number) {
  if (!Number.isFinite(hours)) {
    return "no recorded contact";
  }

  if (hours < 1) {
    return "less than 1 hour ago";
  }

  if (hours < 24) {
    return `${Math.floor(hours)}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function hoursBetween(now: Date, value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return (now.getTime() - new Date(value).getTime()) / 36e5;
}

function hasActivity(activities: FollowUpActivityRecord[], activityTypes: FollowUpActivityRecord["activity_type"][]) {
  return activities.some((activity) => activityTypes.includes(activity.activity_type));
}

function describeLeadNeed(lead: LeadListItem) {
  const location = lead.interested_area ?? lead.listing_area ?? lead.listing_city;
  const budget =
    lead.budget_min || lead.budget_max
      ? [lead.budget_min, lead.budget_max].filter((amount): amount is number => Boolean(amount)).join("-")
      : null;
  const listing = lead.listing_title ?? null;

  return [
    location ? `area: ${location}` : null,
    budget ? `budget: ${budget}` : null,
    listing ? `listing: ${listing}` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

function hasClearNeed(lead: LeadListItem, activities: FollowUpActivityRecord[]) {
  const contextText = [
    lead.ai_summary,
    lead.last_note,
    lead.message,
    ...activities.slice(0, 3).map((activity) => activity.summary)
  ]
    .filter(Boolean)
    .join(" ");

  return Boolean(
    lead.budget_min ||
      lead.budget_max ||
      lead.interested_area ||
      lead.interested_listing_id ||
      lead.listing_id ||
      /option|options|send|share|房源|listing|apartment|villa|plot|budget|area|move|viewing|visit|schedule|看房|预算|区域/i.test(
        contextText
      )
  );
}

function hasHandledClearNeed(activities: FollowUpActivityRecord[]) {
  return hasActivity(activities, ["message_sent", "whatsapp_opened", "viewing_scheduled"]);
}

function inferBestAction(lead: LeadListItem, latestActivity: FollowUpActivityRecord | undefined) {
  const contextText = [lead.ai_summary, lead.last_note, latestActivity?.summary, lead.message].filter(Boolean).join(" ");
  const hasSpecificRequest = /option|options|房源|listing|apartment|villa|plot|budget|move|viewing|visit|schedule/i.test(contextText);

  if (!lead.phone && !lead.email) {
    return "Review lead and capture a contact channel";
  }

  if (hasSpecificRequest) {
    return "Send matching options and ask for viewing availability";
  }

  if (lead.status === "new") {
    return "Send first WhatsApp reply";
  }

  if (lead.status === "contacted") {
    return "Ask for next step";
  }

  return lead.phone ? "Send WhatsApp reply" : "Review lead";
}

function getFollowUpLane(lead: LeadListItem, now: Date, activities: FollowUpActivityRecord[]) {
  const nextFollowUpAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
  const hoursSinceCreated = hoursBetween(now, lead.created_at);
  const hoursSinceContacted = hoursBetween(now, lead.last_contacted_at);
  const hasRecordedContact = Boolean(lead.last_contacted_at) || hasActivity(activities, ["message_sent", "whatsapp_opened"]);
  const clearNeed = hasClearNeed(lead, activities);
  const handledClearNeed = hasHandledClearNeed(activities);

  if (lead.status === "new" && !hasRecordedContact && hoursSinceCreated >= 24 && hoursSinceCreated <= 72) {
    return {
      lane: 1,
      reasonKind: "new_uncontacted" as const
    };
  }

  if (
    (nextFollowUpAt && nextFollowUpAt.getTime() <= now.getTime()) ||
    ((lead.urgency === "high" || lead.status === "qualified" || clearNeed) && !handledClearNeed)
  ) {
    return {
      lane: 2,
      reasonKind: nextFollowUpAt && nextFollowUpAt.getTime() <= now.getTime() ? ("due_commitment" as const) : ("open_need" as const)
    };
  }

  if (
    lead.status === "contacted" &&
    hoursSinceContacted >= 48 &&
    !hasActivity(activities, ["message_sent", "viewing_scheduled"])
  ) {
    return {
      lane: 3,
      reasonKind: "reactivate" as const
    };
  }

  return null;
}

function buildFollowUpRecommendation(
  lead: LeadListItem,
  now: Date,
  activities: FollowUpActivityRecord[] = []
) {
  const latestActivity = activities[0];
  const latestSummary = getActivitySummary(latestActivity);
  const needSignal = describeLeadNeed(lead);
  const profileContext = compactText(lead.ai_summary ?? lead.last_note ?? lead.message);
  const recommendationContext = compactText(latestSummary ?? (needSignal || profileContext));
  const hoursSinceCreated = hoursBetween(now, lead.created_at);
  const hoursSinceContacted = hoursBetween(now, lead.last_contacted_at);
  const bestAction = inferBestAction(lead, latestActivity);
  const lane = getFollowUpLane(lead, now, activities);

  if (lane?.reasonKind === "new_uncontacted") {
    return {
      recommended_reason: `Suggested first reply: yesterday's new lead has not received a recorded first contact (${formatElapsedHours(hoursSinceCreated)}).`,
      recommended_action: "Send first WhatsApp reply",
      recommendation_context: recommendationContext,
      priority_label: "First reply"
    };
  }

  if (lane?.reasonKind === "due_commitment") {
    return {
      recommended_reason: latestSummary
        ? `Suggested because a promised or scheduled follow-up is due. Latest note: ${compactText(latestSummary, 90)}`
        : "Suggested because a promised or scheduled follow-up is due.",
      recommended_action: bestAction,
      recommendation_context: recommendationContext,
      priority_label: "Open task"
    };
  }

  if (lane?.reasonKind === "open_need") {
    return {
      recommended_reason: needSignal
        ? `Suggested because the customer has a clear need (${needSignal}) and no completed follow-up action is recorded yet.`
        : "Suggested because the customer has a clear need or high intent, but no completed follow-up action is recorded yet.",
      recommended_action: bestAction,
      recommendation_context: recommendationContext,
      priority_label: "Handle request"
    };
  }

  if (lane?.reasonKind === "reactivate") {
    return {
      recommended_reason: latestSummary
        ? `Optional check-in after ${formatElapsedHours(hoursSinceContacted)}. Latest note: ${compactText(latestSummary, 90)}`
        : `Optional check-in: contacted lead has no recent progress for ${formatElapsedHours(hoursSinceContacted)}.`,
      recommended_action: bestAction,
      recommendation_context: recommendationContext,
      priority_label: "Check again"
    };
  }

  return {
    recommended_reason: profileContext
      ? `Recent lead worth checking: ${compactText(profileContext, 90)}`
      : "Recent lead worth checking today.",
    recommended_action: bestAction,
    recommendation_context: recommendationContext,
    priority_label: "Check today"
  };
}

function followUpPriorityWithActivities(lead: LeadListItem, now: Date, activities: FollowUpActivityRecord[]) {
  const lane = getFollowUpLane(lead, now, activities);
  const nextFollowUpAt = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
  const hoursSinceCreated = hoursBetween(now, lead.created_at);
  const hoursSinceContacted = hoursBetween(now, lead.last_contacted_at);

  if (!lane) {
    return 0;
  }

  if (lane.lane === 1) {
    return 30_000 + Math.min(hoursSinceCreated, 96);
  }

  if (lane.lane === 2) {
    const dueMinutes = nextFollowUpAt ? Math.max(0, now.getTime() - nextFollowUpAt.getTime()) / 60000 : 0;
    const intentBoost = lead.urgency === "high" || lead.status === "qualified" ? 500 : 0;
    return 20_000 + intentBoost + dueMinutes;
  }

  return 10_000 + Math.min(hoursSinceContacted, 240);
}

function shouldShowTodayFollowUp(lead: LeadListItem, now: Date, activities: FollowUpActivityRecord[] = []) {
  return Boolean(getFollowUpLane(lead, now, activities));
}

export async function getTodayFollowUpsForBroker(
  supabase: SupabaseClient,
  brokerId: string,
  limit = 12,
  options: { seedTag?: string } = {}
): Promise<TodayFollowUpLead[]> {
  const recentLeads = await getRecentLeadsForBroker(supabase, brokerId, 100);
  const seedTag = options.seedTag;
  const leads = seedTag
    ? recentLeads.filter((lead) => lead.message?.includes(seedTag))
    : recentLeads;
  const now = new Date();
  const leadIds = leads.map((lead) => lead.id);
  const activitiesByLeadId = new Map<string, FollowUpActivityRecord[]>();

  if (leadIds.length) {
    const { data, error } = await supabase
      .from("follow_up_activities")
      .select(
        "id, broker_id, lead_id, related_listing_id, activity_type, channel, summary, message_draft, old_status, new_status, next_follow_up_at, source_type, original_chat_saved, original_chat_text, occurred_at, created_at, created_by"
      )
      .eq("broker_id", brokerId)
      .in("lead_id", leadIds)
      .order("occurred_at", { ascending: false })
      .limit(300);

    if (error) {
      throw new Error(error.message);
    }

    for (const activity of (data ?? []) as FollowUpActivityRecord[]) {
      const activities = activitiesByLeadId.get(activity.lead_id) ?? [];
      activities.push(activity);
      activitiesByLeadId.set(activity.lead_id, activities);
    }
  }

  const candidateLeads = leads.filter((lead) => shouldShowTodayFollowUp(lead, now, activitiesByLeadId.get(lead.id) ?? []));
  const primaryLeads = candidateLeads.filter((lead) => {
    const lane = getFollowUpLane(lead, now, activitiesByLeadId.get(lead.id) ?? []);
    return lane ? lane.lane <= 2 : false;
  });
  const leadsToRecommend = primaryLeads.length ? primaryLeads : candidateLeads;

  return leadsToRecommend
    .map((lead) => ({
      ...lead,
      ...buildFollowUpRecommendation(lead, now, activitiesByLeadId.get(lead.id) ?? [])
    }))
    .sort(
      (left, right) =>
        followUpPriorityWithActivities(right, now, activitiesByLeadId.get(right.id) ?? []) -
        followUpPriorityWithActivities(left, now, activitiesByLeadId.get(left.id) ?? [])
    )
    .slice(0, Math.min(Math.max(limit, 1), 30));
}
