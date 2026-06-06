import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireServerEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireServerEnv("supabaseUrl"),
    requireServerEnv("supabaseAnonKey"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies; Route Handlers can.
          }
        }
      }
    }
  );
}

export function createServiceClient() {
  return createClient(
    requireServerEnv("supabaseUrl"),
    requireServerEnv("supabaseServiceRoleKey"),
    {
      auth: {
        persistSession: false
      }
    }
  );
}
