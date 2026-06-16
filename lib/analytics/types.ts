export type AnalyticsRange = "today" | "week" | "month" | "all";

export type AnalyticsFocus = "overview" | "channels" | "listings" | "followups";

export type AnalyticsStatusCount = {
  status: "new" | "contacted" | "qualified" | "closed" | "lost";
  count: number;
};

export type ChannelPerformance = {
  channel: string;
  clicks: number;
  leads: number;
  conversionRate: number;
};

export type ListingPerformance = {
  listingId: string;
  title: string;
  location: string | null;
  clicks: number;
  leads: number;
  conversionRate: number;
};

export type FollowUpStats = {
  dueToday: number;
  overdue: number;
  hotLeads: number;
  notContacted: number;
};

export type AnalyticsSummary = {
  generatedAt: string;
  range: AnalyticsRange;
  rangeLabel: string;
  totals: {
    clicks: number;
    leads: number;
    todayLeads: number;
    weekLeads: number;
    newLeads: number;
    conversionRate: number;
  };
  statusCounts: AnalyticsStatusCount[];
  channelPerformance: ChannelPerformance[];
  listingPerformance: ListingPerformance[];
  followUpStats: FollowUpStats;
};
