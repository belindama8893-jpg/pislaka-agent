import { BarChart3, Clock3, Eye, Flame, MousePointerClick, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type {
  AnalyticsSummary,
  ChannelPerformance,
  ListingPerformance,
  VariantPerformance
} from "@/lib/analytics/types";

type AnalyticsDashboardProps = {
  summary: AnalyticsSummary;
};

type AnalyticsSummaryCardProps = {
  compact?: boolean;
  summary: AnalyticsSummary;
};

function formatPercent(value: number | null | undefined) {
  const safeValue = value ?? 0;
  return `${safeValue.toFixed(safeValue % 1 === 0 ? 0 : 1)}%`;
}

function formatNumber(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-PK");
}

function getChannelLabel(channel: string) {
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    instagram: "Instagram",
    portal: "Portal",
    direct: "Direct",
    unknown: "Unknown"
  };

  return labels[channel] ?? channel;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Hot",
    closed: "Closed",
    lost: "Lost"
  };

  return labels[status] ?? status;
}

function StatTile({
  icon,
  label,
  value,
  note
}: {
  icon: ReactNode;
  label: string;
  note?: string;
  value: string;
}) {
  return (
    <article className="analytics-stat-tile">
      <span className="analytics-stat-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </article>
  );
}

function ChannelRows({ channels, limit = 5 }: { channels: ChannelPerformance[]; limit?: number }) {
  if (!channels.length) {
    return <p className="analytics-empty">No campaign clicks or leads recorded in this range yet.</p>;
  }

  return (
    <div className="analytics-table-list">
      {channels.slice(0, limit).map((channel) => (
        <article className="analytics-performance-row" key={channel.channel}>
          <div>
            <strong>{getChannelLabel(channel.channel)}</strong>
            <span>
              {formatNumber(channel.pageViews)} views / {formatNumber(channel.clicks)} clicks /{" "}
              {formatNumber(channel.leads)} leads
            </span>
          </div>
          <b>{formatPercent(channel.conversionRate)}</b>
        </article>
      ))}
    </div>
  );
}

function ListingRows({ listings, limit = 5 }: { listings: ListingPerformance[]; limit?: number }) {
  if (!listings.length) {
    return <p className="analytics-empty">No listing-level performance yet. Generate campaign links to start tracking.</p>;
  }

  return (
    <div className="analytics-table-list">
      {listings.slice(0, limit).map((listing) => (
        <article className="analytics-performance-row" key={listing.listingId}>
          <div>
            <strong>{listing.title}</strong>
            <span>
              {[listing.location, `${formatNumber(listing.pageViews)} views`, `${formatNumber(listing.leads)} leads`]
                .filter(Boolean)
                .join(" / ")}
            </span>
          </div>
          <b>{formatPercent(listing.conversionRate)}</b>
        </article>
      ))}
    </div>
  );
}

function VariantRows({ variants, limit = 5 }: { variants: VariantPerformance[]; limit?: number }) {
  if (!variants.length) {
    return <p className="analytics-empty">No gray-test variants recorded in this range yet.</p>;
  }

  return (
    <div className="analytics-table-list">
      {variants.slice(0, limit).map((variant) => (
        <article className="analytics-performance-row" key={`${variant.experimentKey}:${variant.variant}`}>
          <div>
            <strong>{variant.variant}</strong>
            <span>
              {formatNumber(variant.uniqueVisitors)} visitors / {formatNumber(variant.pageViews)} views /{" "}
              {formatNumber(variant.submissions || variant.leads)} submits
            </span>
          </div>
          <b>{formatPercent(variant.submitRate)}</b>
        </article>
      ))}
    </div>
  );
}

export function AnalyticsSummaryCard({ compact = false, summary }: AnalyticsSummaryCardProps) {
  const channelPerformance = summary.channelPerformance ?? [];
  const listingPerformance = summary.listingPerformance ?? [];
  const topChannel = channelPerformance[0];
  const topListing = listingPerformance[0];
  const totals = summary.totals;
  const followUpStats = summary.followUpStats;

  return (
    <section className={`analytics-summary-card ${compact ? "compact" : ""}`} aria-label="Analytics summary">
      <div className="analytics-summary-header">
        <div>
          <span>{summary.rangeLabel}</span>
          <h3>Performance summary</h3>
        </div>
        <BarChart3 size={18} />
      </div>

      <div className="analytics-stat-grid">
        <StatTile
          icon={<Users size={16} />}
          label="Leads"
          value={formatNumber(totals?.leads)}
          note={`${formatNumber(totals?.todayLeads)} today`}
        />
        <StatTile
          icon={<Users size={16} />}
          label="Visitors"
          value={formatNumber(totals?.uniqueVisitors)}
          note={`${formatPercent(totals?.pageViewConversionRate)} visitor conversion`}
        />
        <StatTile
          icon={<Eye size={16} />}
          label="Page views"
          value={formatNumber(totals?.pageViews)}
          note={`${formatNumber(totals?.clicks)} tracked clicks`}
        />
        <StatTile
          icon={<MousePointerClick size={16} />}
          label="Form starts"
          value={formatNumber(totals?.formStarts)}
          note={`${formatPercent(totals?.formCompletionRate)} completion`}
        />
      </div>

      <div className="analytics-insight-strip">
        <p>
          {topChannel
            ? `${getChannelLabel(topChannel.channel)} is leading with ${formatNumber(topChannel.leads)} lead${topChannel.leads === 1 ? "" : "s"} and ${formatPercent(topChannel.conversionRate)} conversion.`
            : "No channel has enough activity yet."}
        </p>
        {topListing ? (
          <p>
            Top listing: <strong>{topListing.title}</strong> with {formatNumber(topListing.leads)} lead{topListing.leads === 1 ? "" : "s"}.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function AnalyticsDashboard({ summary }: AnalyticsDashboardProps) {
  const statusCounts = summary.statusCounts ?? [];
  const channelPerformance = summary.channelPerformance ?? [];
  const variantPerformance = summary.variantPerformance ?? [];
  const listingPerformance = summary.listingPerformance ?? [];
  const followUpStats = summary.followUpStats;

  return (
    <div className="analytics-dashboard">
      <AnalyticsSummaryCard summary={summary} />

      <section className="analytics-panel" aria-labelledby="lead-status-title">
        <div className="analytics-panel-header">
          <div>
            <span>Lead funnel</span>
            <h2 id="lead-status-title">Status distribution</h2>
          </div>
          <TrendingUp size={18} />
        </div>
        <div className="analytics-status-grid">
          {statusCounts.map((item) => (
            <article className={`analytics-status-pill ${item.status}`} key={item.status}>
              <span>{getStatusLabel(item.status)}</span>
              <strong>{formatNumber(item.count)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="analytics-panel" aria-labelledby="channel-performance-title">
        <div className="analytics-panel-header">
          <div>
            <span>Attribution</span>
            <h2 id="channel-performance-title">Channel performance</h2>
          </div>
          <MousePointerClick size={18} />
        </div>
        <ChannelRows channels={channelPerformance} />
      </section>

      <section className="analytics-panel" aria-labelledby="variant-performance-title">
        <div className="analytics-panel-header">
          <div>
            <span>Gray test</span>
            <h2 id="variant-performance-title">Variant performance</h2>
          </div>
          <Eye size={18} />
        </div>
        <VariantRows variants={variantPerformance} />
      </section>

      <section className="analytics-panel" aria-labelledby="listing-performance-title">
        <div className="analytics-panel-header">
          <div>
            <span>Inventory</span>
            <h2 id="listing-performance-title">Top listings</h2>
          </div>
          <BarChart3 size={18} />
        </div>
        <ListingRows listings={listingPerformance} />
      </section>

      <section className="analytics-panel" aria-labelledby="followup-health-title">
        <div className="analytics-panel-header">
          <div>
            <span>Action queue</span>
            <h2 id="followup-health-title">Follow-up health</h2>
          </div>
          <Clock3 size={18} />
        </div>
        <div className="analytics-followup-grid">
          <StatTile icon={<Clock3 size={16} />} label="Due today" value={formatNumber(followUpStats?.dueToday)} />
          <StatTile icon={<Clock3 size={16} />} label="Overdue" value={formatNumber(followUpStats?.overdue)} />
          <StatTile icon={<Flame size={16} />} label="Hot leads" value={formatNumber(followUpStats?.hotLeads)} />
          <StatTile icon={<Users size={16} />} label="No first reply" value={formatNumber(followUpStats?.notContacted)} />
        </div>
        <Link className="outline-button small analytics-followup-link" href="/leads">
          Review leads
        </Link>
      </section>
    </div>
  );
}
