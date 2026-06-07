"use client";

import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SidebarAccountProps = {
  agency?: string | null;
  city?: string | null;
  initials: string;
  name: string;
};

export function SidebarAccount({ agency, city, initials, name }: SidebarAccountProps) {
  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/sign-in";
  }

  return (
    <div className="workspace-sidebar-account">
      <div className="account-menu-profile">
        <span className="account-avatar large">{initials || "P"}</span>
        <div>
          <strong>{name}</strong>
          <small>{[agency, city].filter(Boolean).join(", ") || "Pislaka workspace"}</small>
        </div>
      </div>
      <button className="account-signout" type="button" onClick={handleSignOut}>
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
