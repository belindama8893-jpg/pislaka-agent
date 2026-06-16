import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrokerDayRange } from "@/lib/events/time";
import type {
  AnalyticsRange,
  AnalyticsStatusCount,
  AnalyticsSummary,
  ChannelPerformance,
  ListingPerformance
} from "@/lib/analytics/types";

type ClickEventRow = {
  listing_id: string | null;
  channel: string | null;
  created_at: string;
};

type LeadAnalyticsRow = {
  id: string;
  listing_id: string | null;
  source_channel: string | null;
  status: AnalyticsStatusCount["status"];
  urgency: "low" | "normal" | "high" | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type ListingLookupRow = {
  id: string;
  title: string | null;
  location_area: string | null;
  city: string | null;
};

const leadStatuses: AnalyticsStatusCount["status"][] = ["new", "contacted", "qualified", "closed", "lost"];

function getRangeWindow(range: AnalyticsRange, timeZone?: string | null) {
  if (range === "today") {
    return {
      ...getBrokerDayRange(0, 0, timeZone),
      label: "Today"
    };
  }

  if (range === "week") {
    return {
      ...getBrokerDayRange(-6, 6, timeZone),
      label: "Last 7 days"
    };
  }

  if (range === "month") {
    return {
      ...getBrokerDayRange(-29, 29, timeZone),
      label: "Last 30 days"
    };
  }

  return {
    from: undefined,
    to: undefined,
    label: "All time"
  };
}

function applyCreatedAtRange<T>(
  query: T,
  rangeWindow: { from?: string; to?: string }
): T {
  let rangedQuery = query as {
    gte: (column: string, value: string) => typeof query;
    lte: (column: string, value: string) => typeof query;
  };

  if (rangeWindow.from) {
    rangedQuery = rangedQuery.gte("created_at", rangeWindow.from) as typeof rangedQuery;
  }

  if (rangeWindow.to) {
    rangedQuery = rangedQuery.lte("created_at", rangeWindow.to) as typeof rangedQuery;
  }

  return rangedQuery as T;
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function getConversionRate(leads: number, clicks: number) {
  if (!clicks) {
    return leads ? 100 : 0;
  }

  return Math.round((leads / clicks) * 1000) / 10;
}

function getChannel(value: string | null | undefined) {
  return value?.trim() || "unknown";
}

function getListingLocation(listing: ListingLookupRow | undefined) {
  const location = [listing?.location_area, listing?.city].filter(Boolean).join(", ");
  return location || null;
}

function sortPerformance<T extends { clicks: number; leads: number; conversionRate: number }>(items: T[]) {
  return [...items].sort((left, right) => {
    if (right.leads !== left.leads) {
      return right.leads - left.leads;
    }
    if (right.clicks !== left.clicks) {
      return right.clicks - left.clicks;
    }
    return right.conversionRate - left.conversionRate;
  });
}

async function getLeadRowsForRange(
  supabase: SupabaseClient,
  brokerId: string,
  rangeWindow: { from?: string; to?: string }
) {
  const query = applyCreatedAtRange(
    supabase
      .from("leads")
      .select("id, listing_id, source_channel, status, urgency, last_contacted_at, next_follow_up_at, created_at")
      .eq("broker_id", brokerId)
      .limit(5000),
    rangeWindow
  );
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LeadAnalyticsRow[];
}

async function getClickRowsForRange(
  supabase: SupabaseClient,
  brokerId: string,
  rangeWindow: { from?: string; to?: string }
) {
  const query = applyCreatedAtRange(
    supabase
      .from("click_events")
      .select("listing_id, channel, created_at")
      .eq("broker_id", brokerId)
      .limit(5000),
    rangeWindow
  );
  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClickEventRow[];
}

async function getAllOpenLeadRows(supabase: SupabaseClient, brokerId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, listing_id, source_channel, status, urgency, last_contacted_at, next_follow_up_at, created_at")
    .eq("broker_id", brokerId)
    .not("status", "in", "(closed,lost)")
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as LeadAnalyticsRow[];
}

async function getListingLookup(supabase: SupabaseClient, listingIds: string[]) {
  const ids = Array.from(new Set(listingIds.filter(Boolean)));
  if (!ids.length) {
    return new Map<string, ListingLookupRow>();
  }

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, location_area, city")
    .in("id", ids);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as ListingLookupRow[]).map((listing) => [listing.id, listing]));
}

async function countLeadsInRange(
  supabase: SupabaseClient,
  brokerId: string,
  rangeWindow: { from?: string; to?: string }
) {
  const query = applyCreatedAtRange(
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("broker_id", brokerId),
    rangeWindow
  );
  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function getBrokerAnalyticsSummary(
  supabase: SupabaseClient,
  brokerId: string,
  options: { range?: AnalyticsRange; timeZone?: string | null } = {}
): Promise<AnalyticsSummary> {
  const range = options.range ?? "week";
  const rangeWindow = getRangeWindow(range, options.timeZone);
  const todayWindow = getRangeWindow("today", options.timeZone);
  const weekWindow = getRangeWindow("week", options.timeZone);

  const [leadRows, clickRows, openLeadRows, todayLeads, weekLeads] = await Promise.all([
    getLeadRowsForRange(supabase, brokerId, rangeWindow),
    getClickRowsForRange(supabase, brokerId, rangeWindow),
    getAllOpenLeadRows(supabase, brokerId),
    countLeadsInRange(supabase, brokerId, todayWindow),
    countLeadsInRange(supabase, brokerId, weekWindow)
  ]);

  const clickChannelCounts = new Map<string, number>();
  const leadChannelCounts = new Map<string, number>();
  const clickListingCounts = new Map<string, number>();
  const leadListingCounts = new Map<string, number>();
  const statusCounts = new Map<AnalyticsStatusCount["status"], number>(leadStatuses.map((status) => [status, 0]));

  for (const row of clickRows) {
    increment(clickChannelCounts, getChannel(row.channel));
    if (row.listing_id) {
      increment(clickListingCounts, row.listing_id);
    }
  }

  for (const row of leadRows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    increment(leadChannelCounts, getChannel(row.source_channel));
    if (row.listing_id) {
      increment(leadListingCounts, row.listing_id);
    }
  }

  const channels = Array.from(new Set([...clickChannelCounts.keys(), ...leadChannelCounts.keys()]));
  const channelPerformance: ChannelPerformance[] = sortPerformance(
    channels.map((channel) => {
      const clicks = clickChannelCounts.get(channel) ?? 0;
      const leads = leadChannelCounts.get(channel) ?? 0;

      return {
        channel,
        clicks,
        leads,
        conversionRate: getConversionRate(leads, clicks)
      };
    })
  );

  const listingIds = Array.from(new Set([...clickListingCounts.keys(), ...leadListingCounts.keys()]));
  const listingLookup = await getListingLookup(supabase, listingIds);
  const listingPerformance: ListingPerformance[] = sortPerformance(
    listingIds.map((listingId) => {
      const listing = listingLookup.get(listingId);
      const clicks = clickListingCounts.get(listingId) ?? 0;
      const leads = leadListingCounts.get(listingId) ?? 0;

      return {
        listingId,
        title: listing?.title || "Untitled listing",
        location: getListingLocation(listing),
        clicks,
        leads,
        conversionRate: getConversionRate(leads, clicks)
      };
    })
  );

  const now = new Date();
  const todayTo = todayWindow.to ? new Date(todayWindow.to) : now;
  const followUpStats = openLeadRows.reduce(
    (stats, lead) => {
      const nextFollowUp = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;

      if (nextFollowUp && nextFollowUp <= todayTo) {
        stats.dueToday += 1;
      }

      if (nextFollowUp && nextFollowUp < now) {
        stats.overdue += 1;
      }

      if (lead.status === "qualified" && lead.urgency === "high") {
        stats.hotLeads += 1;
      }

      if (!lead.last_contacted_at && lead.status === "new") {
        stats.notContacted += 1;
      }

      return stats;
    },
    { dueToday: 0, overdue: 0, hotLeads: 0, notContacted: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    range,
    rangeLabel: rangeWindow.label,
    totals: {
      clicks: clickRows.length,
      leads: leadRows.length,
      todayLeads,
      weekLeads,
      newLeads: openLeadRows.filter((lead) => lead.status === "new").length,
      conversionRate: getConversionRate(leadRows.length, clickRows.length)
    },
    statusCounts: leadStatuses.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0
    })),
    channelPerformance,
    listingPerformance: listingPerformance.slice(0, 8),
    followUpStats
  };
}
