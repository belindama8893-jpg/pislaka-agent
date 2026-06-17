import { NextResponse } from "next/server";
import { recordProductAnalyticsEvent } from "@/lib/analytics/server-events";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const service = createServiceClient();
      const { data: broker } = await service
        .from("broker_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      await recordProductAnalyticsEvent(service, {
        authUserId: user.id,
        brokerId: (broker as { id: string } | null)?.id ?? null,
        eventName: "auth_succeeded",
        metadata: {
          method: "google"
        },
        request
      });
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
