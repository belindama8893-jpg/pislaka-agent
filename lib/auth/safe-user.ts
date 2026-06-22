import type { SupabaseClient, User } from "@supabase/supabase-js";

export type SupabaseUserResult = {
  error: unknown;
  user: User | null;
};

export async function getSupabaseUserSafely(supabase: SupabaseClient): Promise<SupabaseUserResult> {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    return {
      error,
      user: error ? null : user
    };
  } catch (error) {
    return {
      error,
      user: null
    };
  }
}
