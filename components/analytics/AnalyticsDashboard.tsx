import { BarChart3, Clock3, Flame, MousePointerClick, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AnalyticsSummary, ChannelPerformance, ListingPerformance } from "@/lib/analytics/types";

type AnalyticsDashboardProps = {
  summary: AnalyticsSummary;
};

type AnalyticsSummaryCardProps = {
  compact?: boolean;
  summary: AnalyticsSummary;
};

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-PK");
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
              {formatNumber(channel.clicks)} clicks / {formatNumber(channel.leads)} leads
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
              {[listing.location, `${formatNumber(listing.clicks)} clicks`, `${formatNumber(listing.leads)} leads`]
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

export function AnalyticsSummaryCard({ compact = false, summary }: AnalyticsSummaryCardProps) {
  const topChannel = summary.channelPerformance[0];
  const topListing = summary.listingPerformance[0];

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
          value={formatNumber(summary.totals.leads)}
          note={`${formatNumber(summary.totals.todayLeads)} today`}
        />
        <StatTile
          icon={<MousePointerClick size={16} />}
          label="Clicks"
          value={formatNumber(summary.totals.clicks)}
          note={`${formatPercent(summary.totals.conversionRate)} conversion`}
        />
        <StatTile
          icon={<Flame size={16} />}
          label="Hot leads"
          value={formatNumber(summary.followUpStats.hotLeads)}
          note={`${formatNumber(summary.followUpStats.notContacted)} need first reply`}
        />
        <StatTile
          icon={<Clock3 size={16} />}
          label="Follow-ups"
          value={formatNumber(summary.followUpStats.dueToday)}
          note={`${formatNumber(summary.followUpStats.overdue)} overdue`}
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
          {summary.statusCounts.map((item) => (
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
        <ChannelRows channels={summary.channelPerformance} />
      </section>

      <section className="analytics-panel" aria-labelledby="listing-performance-title">
        <div className="analytics-panel-header">
          <div>
            <span>Inventory</span>
            <h2 id="listing-performance-title">Top listings</h2>
          </div>
          <BarChart3 size={18} />
        </div>
        <ListingRows listings={summary.listingPerformance} />
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
          <StatTile icon={<Clock3 size={16} />} label="Due today" value={formatNumber(summary.followUpStats.dueToday)} />
          <StatTile icon={<Clock3 size={16} />} label="Overdue" value={formatNumber(summary.followUpStats.overdue)} />
          <StatTile icon={<Flame size={16} />} label="Hot leads" value={formatNumber(summary.followUpStats.hotLeads)} />
          <StatTile icon={<Users size={16} />} label="No first reply" value={formatNumber(summary.followUpStats.notContacted)} />
        </div>
        <Link className="outline-button small analytics-followup-link" href="/leads">
          Review leads
        </Link>
      </section>
    </div>
  );
}
