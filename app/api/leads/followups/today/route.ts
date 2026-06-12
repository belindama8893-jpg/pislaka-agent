import { NextResponse } from "next/server";
import { requireCurrentBroker } from "@/lib/auth/current-user";
import { getTodayFollowUpsForBroker } from "@/lib/leads/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 12);
    const seedTag = searchParams.get("seed") === "followup-test" ? "[seed:followup-test]" : undefined;
    const { supabase, broker } = await requireCurrentBroker();
    const leads = await getTodayFollowUpsForBroker(supabase, broker.id, limit, { seedTag });

    return NextResponse.json({ leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
