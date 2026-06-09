import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { brokerEventSelect } from "@/lib/events/queries";
import type { BrokerEventRecord } from "@/lib/events/types";

const reminderDismissSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(20)
});

function isMissingReminderColumns(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "42703" ||
    /in_app_reminded_at|in_app_reminder_dismissed_at|schema cache/i.test(error?.message ?? "")
  );
}

export async function GET() {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const remindedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("broker_events")
      .select(brokerEventSelect)
      .eq("broker_id", broker.id)
      .eq("status", "scheduled")
      .not("reminder_at", "is", null)
      .is("in_app_reminded_at", null)
      .lte("reminder_at", remindedAt)
      .order("reminder_at", { ascending: true })
      .limit(5);

    if (error) {
      if (isMissingReminderColumns(error)) {
        return NextResponse.json({ reminders: [], migration_required: true });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reminders = (data ?? []) as BrokerEventRecord[];
    const reminderIds = reminders.map((event) => event.id);

    if (reminderIds.length > 0) {
      const { error: updateError } = await supabase
        .from("broker_events")
        .update({
          in_app_reminded_at: remindedAt,
          updated_at: remindedAt
        })
        .eq("broker_id", broker.id)
        .in("id", reminderIds)
        .is("in_app_reminded_at", null);

      if (updateError && !isMissingReminderColumns(updateError)) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      reminders: reminders.map((event) => ({
        ...event,
        in_app_reminded_at: remindedAt
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = reminderDismissSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reminder dismiss payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const dismissedAt = new Date().toISOString();
    const { error } = await supabase
      .from("broker_events")
      .update({
        in_app_reminder_dismissed_at: dismissedAt,
        updated_at: dismissedAt
      })
      .eq("broker_id", broker.id)
      .in("id", parsed.data.ids);

    if (error) {
      if (isMissingReminderColumns(error)) {
        return NextResponse.json({ migration_required: true }, { status: 424 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dismissed: parsed.data.ids });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
