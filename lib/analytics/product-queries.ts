import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrokerDayRange } from "@/lib/events/time";
import type { AnalyticsRange } from "@/lib/analytics/types";

type ProductAnalyticsRange = AnalyticsRange | "custom";

type ProductAnalyticsEventRow = {
  auth_user_id: string | null;
  broker_id: string | null;
  event_name: string;
  visitor_id: string | null;
  created_at: string;
};

export type ProductAnalyticsSummary = {
  generatedAt: string;
  range: ProductAnalyticsRange;
  rangeLabel: string;
  tableReady: boolean;
  totals: {
    homePageViews: number;
    uniqueHomeVisitors: number;
    uniqueAuthStartVisitors: number;
    signedInAccounts: number;
    authModalOpens: number;
    authStarts: number;
    authSuccesses: number;
    workspaceViews: number;
    uniqueWorkspaceUsers: number;
    profileCompletions: number;
    listingsCreated: number;
    leadsCreated: number;
    authStartRate: number;
    authSuccessRate: number;
    workspaceConversionRate: number;
    activationRate: number;
  };
};

function isDateInput(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getCustomRangeWindow(dateFrom?: string | null, dateTo?: string | null) {
  const hasFrom = isDateInput(dateFrom);
  const hasTo = isDateInput(dateTo);

  if (!hasFrom && !hasTo) {
    return null;
  }

  return {
    from: hasFrom ? `${dateFrom}T00:00:00.000Z` : undefined,
    to: hasTo ? `${dateTo}T23:59:59.999Z` : undefined,
    label: [dateFrom, dateTo].filter(Boolean).join(" to ")
  };
}

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

function getRate(numerator: number, denominator: number) {
  if (!denominator) {
    return numerator ? 100 : 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function countEvents(rows: ProductAnalyticsEventRow[], eventName: string) {
  return rows.filter((row) => row.event_name === eventName).length;
}

function uniqueCount(values: Array<string | null>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function buildEmptySummary(
  range: ProductAnalyticsRange,
  rangeLabel: string,
  tableReady: boolean
): ProductAnalyticsSummary {
  return {
    generatedAt: new Date().toISOString(),
    range,
    rangeLabel,
    tableReady,
    totals: {
      homePageViews: 0,
      uniqueHomeVisitors: 0,
      uniqueAuthStartVisitors: 0,
      signedInAccounts: 0,
      authModalOpens: 0,
      authStarts: 0,
      authSuccesses: 0,
      workspaceViews: 0,
      uniqueWorkspaceUsers: 0,
      profileCompletions: 0,
      listingsCreated: 0,
      leadsCreated: 0,
      authStartRate: 0,
      authSuccessRate: 0,
      workspaceConversionRate: 0,
      activationRate: 0
    }
  };
}

export async function getProductAnalyticsSummary(
  supabase: SupabaseClient,
  options: { dateFrom?: string | null; dateTo?: string | null; range?: AnalyticsRange; timeZone?: string | null } = {}
): Promise<ProductAnalyticsSummary> {
  const customRangeWindow = getCustomRangeWindow(options.dateFrom, options.dateTo);
  const range = customRangeWindow ? "custom" : (options.range ?? "week");
  const rangeWindow = customRangeWindow ?? getRangeWindow(options.range ?? "week", options.timeZone);
  const query = applyCreatedAtRange(
    supabase
      .from("analytics_events")
      .select("auth_user_id, broker_id, event_name, visitor_id, created_at")
      .in("event_name", [
        "home_page_view",
        "auth_modal_opened",
        "auth_started",
        "auth_succeeded",
        "workspace_view",
        "profile_completed",
        "listing_created",
        "lead_created"
      ])
      .limit(20000),
    rangeWindow
  );
  const { data, error } = await query;

  if (error) {
    if (/analytics_events|schema cache/i.test(error.message)) {
      return buildEmptySummary(range, rangeWindow.label, false);
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as ProductAnalyticsEventRow[];
  const homeRows = rows.filter((row) => row.event_name === "home_page_view");
  const authStartRows = rows.filter((row) => row.event_name === "auth_started");
  const authSuccessRows = rows.filter((row) => row.event_name === "auth_succeeded");
  const workspaceRows = rows.filter((row) => row.event_name === "workspace_view");
  const activationRows = rows.filter((row) =>
    ["profile_completed", "listing_created", "lead_created"].includes(row.event_name)
  );
  const uniqueHomeVisitors = uniqueCount(homeRows.map((row) => row.visitor_id));
  const uniqueAuthStartVisitors = uniqueCount(authStartRows.map((row) => row.visitor_id));
  const signedInAccounts = uniqueCount(authSuccessRows.map((row) => row.auth_user_id));
  const uniqueWorkspaceUsers = uniqueCount(workspaceRows.map((row) => row.auth_user_id ?? row.broker_id));
  const uniqueActivatedUsers = uniqueCount(activationRows.map((row) => row.auth_user_id ?? row.broker_id));
  const denominator = uniqueHomeVisitors || homeRows.length;

  return {
    generatedAt: new Date().toISOString(),
    range,
    rangeLabel: rangeWindow.label,
    tableReady: true,
    totals: {
      homePageViews: homeRows.length,
      uniqueHomeVisitors,
      uniqueAuthStartVisitors,
      signedInAccounts,
      authModalOpens: countEvents(rows, "auth_modal_opened"),
      authStarts: authStartRows.length,
      authSuccesses: authSuccessRows.length,
      workspaceViews: workspaceRows.length,
      uniqueWorkspaceUsers,
      profileCompletions: countEvents(rows, "profile_completed"),
      listingsCreated: countEvents(rows, "listing_created"),
      leadsCreated: countEvents(rows, "lead_created"),
      authStartRate: getRate(uniqueAuthStartVisitors || authStartRows.length, denominator),
      authSuccessRate: getRate(signedInAccounts || authSuccessRows.length, denominator),
      workspaceConversionRate: getRate(uniqueWorkspaceUsers || workspaceRows.length, denominator),
      activationRate: getRate(uniqueActivatedUsers || activationRows.length, denominator)
    }
  };
}
