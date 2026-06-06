"use client";

import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/sign-in";
  }

  return (
    <button className="outline-button" type="button" onClick={handleSignOut}>
      <LogOut size={17} /> Sign out
    </button>
  );
}
