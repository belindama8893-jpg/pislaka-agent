export type AnalyticsRange = "today" | "week" | "month" | "all";

export type AnalyticsFocus = "overview" | "channels" | "listings" | "followups";

export type AnalyticsStatusCount = {
  status: "new" | "contacted" | "qualified" | "closed" | "lost";
  count: number;
};

export type ChannelPerformance = {
  channel: string;
  clicks: number;
  pageViews: number;
  leads: number;
  conversionRate: number;
};

export type ListingPerformance = {
  listingId: string;
  title: string;
  location: string | null;
  clicks: number;
  pageViews: number;
  leads: number;
  conversionRate: number;
};

export type VariantPerformance = {
  experimentKey: string;
  variant: string;
  pageViews: number;
  uniqueVisitors: number;
  formStarts: number;
  submissions: number;
  leads: number;
  submitRate: number;
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
    pageViews: number;
    uniqueVisitors: number;
    formStarts: number;
    leadSubmitSuccesses: number;
    leads: number;
    todayLeads: number;
    weekLeads: number;
    newLeads: number;
    conversionRate: number;
    pageViewConversionRate: number;
    formCompletionRate: number;
  };
  statusCounts: AnalyticsStatusCount[];
  channelPerformance: ChannelPerformance[];
  listingPerformance: ListingPerformance[];
  variantPerformance: VariantPerformance[];
  followUpStats: FollowUpStats;
};
