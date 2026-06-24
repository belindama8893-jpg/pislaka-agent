import type { SupabaseClient, User } from "@supabase/supabase-js";

export type SupabaseUserResult = {
  error: unknown;
  user: User | null;
};

function isRecoverableAuthSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return (
    code === "refresh_token_not_found" ||
    /invalid refresh token|refresh token not found/i.test(message)
  );
}

export async function getSupabaseUserSafely(supabase: SupabaseClient): Promise<SupabaseUserResult> {
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (isRecoverableAuthSessionError(error)) {
      return {
        error: null,
        user: null
      };
    }

    return {
      error,
      user: error ? null : user
    };
  } catch (error) {
    if (isRecoverableAuthSessionError(error)) {
      return {
        error: null,
        user: null
      };
    }

    return {
      error,
      user: null
    };
  }
}
