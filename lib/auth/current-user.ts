import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseUserSafely } from "@/lib/auth/safe-user";

export async function requireCurrentBroker() {
  const supabase = await createSupabaseServerClient();
  const { user, error: userError } = await getSupabaseUserSafely(supabase);

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await supabase
    .from("broker_profiles")
    .select("id, auth_user_id, full_name, email, city, agency_name, phone, preferred_language")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Broker profile not found");
  }

  return {
    supabase,
    user,
    broker: profile
  };
}
