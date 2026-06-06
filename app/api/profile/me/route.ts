import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentBroker } from "@/lib/auth/current-user";

const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  agency_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  preferred_language: z
    .enum(["english_roman_urdu", "urdu", "english"])
    .default("english_roman_urdu")
});

export async function GET() {
  try {
    const { user, broker } = await requireCurrentBroker();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      broker
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { data: updatedProfile, error } = await supabase
      .from("broker_profiles")
      .update({
        ...parsed.data,
        phone: parsed.data.phone || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", broker.id)
      .select("id, auth_user_id, full_name, email, city, agency_name, phone, preferred_language")
      .single();

    if (error || !updatedProfile) {
      return NextResponse.json({ error: error?.message ?? "Profile not found" }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      broker_id: broker.id,
      actor_type: "user",
      action: "update_broker_profile",
      entity_type: "broker_profile",
      entity_id: broker.id,
      before_payload: broker,
      after_payload: updatedProfile,
      metadata: {
        source: "api"
      }
    });

    return NextResponse.json({ broker: updatedProfile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
