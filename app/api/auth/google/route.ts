import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const origin = host ? `${protocol}://${host}` : requestUrl.origin;
  const callbackUrl = new URL("/auth/callback", origin);
  const next = requestUrl.searchParams.get("next");

  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true
    }
  });

  if (error || !data.url) {
    const fallbackUrl = new URL("/auth/sign-in", origin);
    fallbackUrl.searchParams.set("auth_error", error?.message ?? "Unable to start Google sign in");
    return NextResponse.redirect(fallbackUrl);
  }

  const response = NextResponse.redirect(data.url);
  response.headers.set("Cache-Control", "no-store");

  return response;
}
