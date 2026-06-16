import { NextResponse } from "next/server";
import { getBrokerAnalyticsSummary } from "@/lib/analytics/queries";
import type { AnalyticsRange } from "@/lib/analytics/types";
import { requireCurrentBroker } from "@/lib/auth/current-user";

const analyticsRanges = new Set<AnalyticsRange>(["today", "week", "month", "all"]);

function getRange(value: string | null): AnalyticsRange {
  return value && analyticsRanges.has(value as AnalyticsRange) ? (value as AnalyticsRange) : "week";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { broker, supabase } = await requireCurrentBroker();
    const summary = await getBrokerAnalyticsSummary(supabase, broker.id, {
      range: getRange(searchParams.get("range")),
      timeZone: searchParams.get("time_zone")
    });

    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
