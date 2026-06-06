import { NextResponse } from "next/server";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import {
  brokerEventCreateSchema,
  brokerEventUpdateSchema,
  type BrokerEventRecord
} from "@/lib/events/types";

const eventSelect =
  "id, broker_id, event_category, event_type, title, description, start_at, end_at, reminder_at, recurrence_rule, status, lead_id, listing_id, lead_name, listing_reference, location_text, source_payload, created_from, created_at, updated_at";

function isMissingBrokerEventsTable(error: { message?: string; code?: string } | null) {
  return error?.code === "42P01" || /broker_events/i.test(error?.message ?? "");
}

export async function GET(request: Request) {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "scheduled";
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

    let query = supabase
      .from("broker_events")
      .select(eventSelect)
      .eq("broker_id", broker.id)
      .order("start_at", { ascending: true, nullsFirst: false })
      .order("reminder_at", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: events, error } = await query;

    if (error) {
      if (isMissingBrokerEventsTable(error)) {
        return NextResponse.json({ events: [], migration_required: true });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: (events ?? []) as BrokerEventRecord[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = brokerEventCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();

    const { data: event, error } = await supabase
      .from("broker_events")
      .insert({
        ...parsed.data,
        broker_id: broker.id,
        created_from: "agent"
      })
      .select(eventSelect)
      .single();

    if (error || !event) {
      const status = isMissingBrokerEventsTable(error) ? 424 : 500;
      return NextResponse.json(
        {
          error: isMissingBrokerEventsTable(error)
            ? "broker_events table is not ready. Please run the schedule migration first."
            : error?.message ?? "Unable to create event"
        },
        { status }
      );
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "create_broker_event",
      entity_type: "broker_event",
      entity_id: event.id,
      after_payload: event,
      metadata: {
        source: "api"
      }
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = brokerEventUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid event update payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { id, ...changes } = parsed.data;

    const { data: existingEvent, error: readError } = await supabase
      .from("broker_events")
      .select(eventSelect)
      .eq("id", id)
      .eq("broker_id", broker.id)
      .single();

    if (readError || !existingEvent) {
      const status = isMissingBrokerEventsTable(readError) ? 424 : 404;
      return NextResponse.json(
        {
          error: isMissingBrokerEventsTable(readError)
            ? "broker_events table is not ready. Please run the schedule migration first."
            : readError?.message ?? "Event not found"
        },
        { status }
      );
    }

    const { data: event, error } = await supabase
      .from("broker_events")
      .update({
        ...changes,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("broker_id", broker.id)
      .select(eventSelect)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: error?.message ?? "Unable to update event" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "update_broker_event",
      entity_type: "broker_event",
      entity_id: event.id,
      before_payload: existingEvent,
      after_payload: event,
      metadata: {
        source: "api"
      }
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
