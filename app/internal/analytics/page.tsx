import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, LogIn, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { getProductAnalyticsSummary } from "@/lib/analytics/product-queries";
import type { AnalyticsRange } from "@/lib/analytics/types";
import { getSupabaseUserSafely } from "@/lib/auth/safe-user";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const analyticsRanges = new Set<AnalyticsRange>(["today", "week", "month", "all"]);

type InternalAnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getRange(searchParams: Record<string, string | string[] | undefined>): AnalyticsRange {
  const value = searchParams.range;
  const range = Array.isArray(value) ? value[0] : value;
  return range && analyticsRanges.has(range as AnalyticsRange) ? (range as AnalyticsRange) : "week";
}

function getSearchParamValue(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function getDateInput(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = getSearchParamValue(searchParams, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function formatNumber(value: number) {
  return value.toLocaleString("en-PK");
}

function formatPercent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function StatCard({
  icon,
  label,
  note,
  value
}: {
  icon: React.ReactNode;
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

function MetricLabel({ english, chinese }: { chinese: string; english: string }) {
  return (
    <>
      <span>{chinese}</span>
      <small>{english}</small>
    </>
  );
}

async function requireInternalAnalyticsAccess() {
  const supabase = await createSupabaseServerClient();
  const { user, error } = await getSupabaseUserSafely(supabase);

  if (error || !user?.email) {
    redirect("/auth/sign-in");
  }

  const allowList = (process.env.INTERNAL_ANALYTICS_EMAILS || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowList.includes(user.email.toLowerCase())) {
    throw new Error("Internal analytics access is not configured for this account.");
  }
}

export default async function InternalAnalyticsPage({ searchParams }: InternalAnalyticsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  await requireInternalAnalyticsAccess();
  const range = getRange(resolvedSearchParams);
  const dateFrom = getDateInput(resolvedSearchParams, "from");
  const dateTo = getDateInput(resolvedSearchParams, "to");
  const summary = await getProductAnalyticsSummary(createServiceClient(), {
    dateFrom,
    dateTo,
    range
  });
  const activatedUsers =
    summary.totals.profileCompletions + summary.totals.listingsCreated + summary.totals.leadsCreated;
  const rangeLinks = [
    { href: "/internal/analytics?range=today", label: "今天", value: "today" },
    { href: "/internal/analytics?range=week", label: "近 7 天", value: "week" },
    { href: "/internal/analytics?range=month", label: "近 30 天", value: "month" },
    { href: "/internal/analytics?range=all", label: "全部", value: "all" }
  ] as const satisfies Array<{ href: `/internal/analytics?range=${AnalyticsRange}`; label: string; value: AnalyticsRange }>;

  return (
    <main className="internal-analytics-page">
      <section className="internal-analytics-shell">
        <header className="internal-analytics-header">
          <div className="workspace-title internal-analytics-title">
            <h1>内部运营看板 / Internal analytics</h1>
            <p>{summary.rangeLabel} · Pislaka Agent 产品漏斗 / product funnel.</p>
          </div>
        </header>

        <div className="analytics-dashboard">
          <section className="internal-analytics-filter" aria-labelledby="date-filter-title">
            <div className="internal-filter-copy">
              <span id="date-filter-title">日期筛选 / Date filter</span>
              <p>{summary.rangeLabel}</p>
            </div>
            <div className="internal-filter-controls">
              <div className="internal-range-links" aria-label="Quick date ranges">
                {rangeLinks.map((item) => (
                  <Link
                    className={`internal-range-link${!dateFrom && !dateTo && range === item.value ? " active" : ""}`}
                    href={item.href}
                    key={item.value}
                  >
                    <span>{item.label}</span>
                    <small>
                      {item.value === "today"
                        ? "Today"
                        : item.value === "week"
                          ? "7 days"
                          : item.value === "month"
                            ? "30 days"
                            : "All"}
                    </small>
                  </Link>
                ))}
              </div>
              <form action="/internal/analytics" className="internal-date-form">
                <label>
                  <span>From</span>
                  <input name="from" type="date" defaultValue={dateFrom} />
                </label>
                <label>
                  <span>To</span>
                  <input name="to" type="date" defaultValue={dateTo} />
                </label>
                <button className="internal-filter-button primary" type="submit">
                  Apply
                </button>
                <Link className="internal-filter-button" href="/internal/analytics?range=week">
                  Reset
                </Link>
              </form>
            </div>
          </section>

          {!summary.tableReady ? (
            <section className="analytics-panel" aria-label="Analytics setup required">
              <div className="analytics-panel-header">
                <div>
                  <span>需要配置 / Setup required</span>
                  <h2>执行数据表迁移 / Run the analytics migration</h2>
                </div>
                <BarChart3 size={18} />
              </div>
              <p className="analytics-empty">
                Supabase 里还没有 analytics_events 表。请在 Supabase SQL Editor 执行
                migrations/20260617_gray_analytics_events.sql，然后刷新本页。 / The analytics_events table does not
                exist yet. Run the migration, then refresh this page.
              </p>
            </section>
          ) : null}

          <section className="analytics-summary-card" aria-label="Internal analytics summary">
            <div className="analytics-summary-header">
              <div>
                <span>{summary.rangeLabel}</span>
                <h3>产品漏斗 / Product funnel</h3>
              </div>
              <BarChart3 size={18} />
            </div>
            <div className="analytics-stat-grid">
              <StatCard
                icon={<Users size={16} />}
                label="首页访客 UV / Home visitor UV"
                value={formatNumber(summary.totals.uniqueHomeVisitors)}
                note={`${formatNumber(summary.totals.homePageViews)} 页面浏览 / page views`}
              />
              <StatCard
                icon={<MousePointerClick size={16} />}
                label="点击登录 UV / Auth start UV"
                value={formatNumber(summary.totals.uniqueAuthStartVisitors)}
                note={`${formatPercent(summary.totals.authStartRate)} 来自首页访客 / from home visitors`}
              />
              <StatCard
                icon={<LogIn size={16} />}
                label="登录成功账号数 / Signed-in accounts"
                value={formatNumber(summary.totals.signedInAccounts)}
                note={`${formatPercent(summary.totals.authSuccessRate)} 来自首页访客 / from home visitors`}
              />
              <StatCard
                icon={<TrendingUp size={16} />}
                label="关键使用行为 / Key product actions"
                value={formatNumber(activatedUsers)}
                note={`${formatPercent(summary.totals.activationRate)} 激活率 / activation`}
              />
            </div>
          </section>

          <section className="analytics-panel" aria-labelledby="internal-funnel-title">
            <div className="analytics-panel-header">
              <div>
                <span>转化 / Conversion</span>
                <h2 id="internal-funnel-title">首页漏斗 / Homepage funnel</h2>
              </div>
              <TrendingUp size={18} />
            </div>
            <div className="analytics-status-grid">
              <article className="analytics-status-pill new">
                <MetricLabel chinese="打开登录弹窗次数" english="Auth modal open events" />
                <strong>{formatNumber(summary.totals.authModalOpens)}</strong>
              </article>
              <article className="analytics-status-pill contacted">
                <MetricLabel chinese="进入工作台用户" english="Workspace users" />
                <strong>{formatNumber(summary.totals.uniqueWorkspaceUsers)}</strong>
              </article>
              <article className="analytics-status-pill qualified">
                <MetricLabel chinese="工作台转化率" english="Workspace conversion" />
                <strong>{formatPercent(summary.totals.workspaceConversionRate)}</strong>
              </article>
            </div>
          </section>

          <section className="analytics-panel" aria-labelledby="internal-activation-title">
            <div className="analytics-panel-header">
              <div>
                <span>使用 / Usage</span>
                <h2 id="internal-activation-title">关键使用行为 / Key product actions</h2>
              </div>
              <BarChart3 size={18} />
            </div>
            <div className="analytics-followup-grid">
              <StatCard
                icon={<Users size={16} />}
                label="完善资料 / Profiles completed"
                value={formatNumber(summary.totals.profileCompletions)}
              />
              <StatCard
                icon={<BarChart3 size={16} />}
                label="创建房源 / Listings created"
                value={formatNumber(summary.totals.listingsCreated)}
              />
              <StatCard
                icon={<Users size={16} />}
                label="创建线索 / Leads created"
                value={formatNumber(summary.totals.leadsCreated)}
              />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
