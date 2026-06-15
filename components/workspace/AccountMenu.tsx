"use client";

import { BarChart3, CalendarClock, List, LogOut, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const GUEST_CHAT_STORAGE_KEY = "pislaka_guest_chat_v1";
const GUEST_CHAT_RESTORE_FLAG = "pislaka_restore_guest_chat";

type AccountMenuProps = {
  initials: string;
  name: string;
  email?: string | null;
  agency?: string | null;
  city?: string | null;
  isGuest?: boolean;
  leadsCount?: number;
};

export function AccountMenu({ initials, name, email, agency, city, isGuest = false, leadsCount }: AccountMenuProps) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeMenu() {
      menuRef.current?.removeAttribute("open");
      setIsOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/sign-in";
  }

  function markGuestTranscriptForRestore() {
    if (window.localStorage.getItem(GUEST_CHAT_STORAGE_KEY)) {
      window.localStorage.setItem(GUEST_CHAT_RESTORE_FLAG, "true");
    }
  }

  if (isGuest) {
    return (
      <>
        <button className="account-signin-link" type="button" onClick={() => setIsAuthModalOpen(true)}>
          Sign in
        </button>
        {isAuthModalOpen ? (
          <div className="auth-modal-backdrop" role="presentation" onClick={() => setIsAuthModalOpen(false)}>
            <section
              aria-label="Sign in to Pislaka Agent"
              className="auth-modal"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="auth-modal-heading">
                <span>Sign in to continue</span>
                <button type="button" onClick={() => setIsAuthModalOpen(false)}>
                  Close
                </button>
              </div>
              <AuthForm onAuthStarted={markGuestTranscriptForRestore} />
            </section>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <details
      className="account-menu"
      ref={menuRef}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary aria-label="Open account menu">
        <span className="account-avatar">{initials || "P"}</span>
      </summary>
      <div className="account-menu-panel">
        <div className="account-menu-profile">
          <span className="account-avatar large">{initials || "P"}</span>
          <div>
            <strong>{name}</strong>
            {email ? <small>{email}</small> : null}
            <small>
              {[agency, city].filter(Boolean).join(", ") || "Pislaka workspace"}
            </small>
          </div>
        </div>

        <nav className="account-menu-links" aria-label="Account workspace links">
          <Link href="/">
            <MessageCircle size={16} /> Agent Chat
          </Link>
          <Link href="/listings">
            <List size={16} /> Listings
          </Link>
          <Link href="/leads">
            <Users size={16} /> Leads
            {typeof leadsCount === "number" ? <span className="urgent">{leadsCount}</span> : null}
          </Link>
          <Link href="#">
            <BarChart3 size={16} /> Analytics
          </Link>
          <Link href="/schedule">
            <CalendarClock size={16} /> Schedule
          </Link>
        </nav>

        <button className="account-signout" type="button" onClick={handleSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </details>
  );
}
