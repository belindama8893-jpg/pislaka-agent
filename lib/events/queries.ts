import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrokerEventRecord, BrokerEventStatus, BrokerEventType } from "@/lib/events/types";

export const brokerEventSelect =
  "id, broker_id, event_category, event_type, title, description, start_at, end_at, reminder_at, recurrence_rule, status, lead_id, listing_id, lead_name, listing_reference, location_text, source_payload, created_from, created_at, updated_at";

export type BrokerEventQueryOptions = {
  status?: BrokerEventStatus | "all";
  eventType?: BrokerEventType | "all";
  from?: string;
  to?: string;
  limit?: number;
};

export async function getBrokerEventsForBroker(
  supabase: SupabaseClient,
  brokerId: string,
  options: BrokerEventQueryOptions = {}
): Promise<BrokerEventRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  let query = supabase
    .from("broker_events")
    .select(brokerEventSelect)
    .eq("broker_id", brokerId)
    .order("start_at", { ascending: true, nullsFirst: false })
    .order("reminder_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options.eventType && options.eventType !== "all") {
    query = query.eq("event_type", options.eventType);
  }

  if (options.from) {
    query = query.or(`start_at.gte.${options.from},reminder_at.gte.${options.from}`);
  }

  if (options.to) {
    query = query.or(`start_at.lte.${options.to},reminder_at.lte.${options.to}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BrokerEventRecord[];
}
