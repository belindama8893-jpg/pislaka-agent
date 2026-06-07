"use client";

import { type FormEvent, useState } from "react";
import { BarChart3, CalendarClock, Home, List, Megaphone, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import { AgentComposer } from "@/components/agent/AgentComposer";
import { AuthForm } from "@/components/auth/AuthForm";

const quickActions = [
  {
    label: "List a Property",
    icon: Home,
    prompt: "List a property"
  },
  {
    label: "Promote Listing",
    icon: Megaphone,
    prompt: "Promote a listing"
  },
  {
    label: "Add a Lead",
    icon: UserPlus,
    prompt: "Add a lead"
  },
  {
    label: "Schedule Viewing",
    icon: CalendarClock,
    prompt: "Schedule a viewing"
  }
];

const dataPages = [
  {
    label: "Listings",
    icon: List
  },
  {
    label: "Leads",
    icon: Users
  },
  {
    label: "Analytics",
    icon: BarChart3
  },
  {
    label: "Schedule",
    icon: CalendarClock
  }
];

export function AuthLanding() {
  const [showAuth, setShowAuth] = useState(false);
  const [draft, setDraft] = useState("");

  function requireSignIn(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setShowAuth(true);
  }

  return (
    <main className="auth-page auth-homepage">
      <header className="auth-shell-topbar">
        <Image className="auth-brand-logo" src="/logo.png" alt="Pislaka" width={324} height={120} priority />
        <button className="auth-trigger" type="button" onClick={() => setShowAuth(true)}>
          Sign in
        </button>
      </header>

      <aside className="auth-sidebar" aria-label="Pislaka workspace navigation">
        <div className="auth-sidebar-brand">
          <Image src="/logo.png" alt="Pislaka" width={324} height={120} priority />
        </div>

        <nav className="auth-sidebar-nav" aria-label="Agent conversations">
          <p>Agent conversations</p>
          <button type="button" onClick={() => setShowAuth(true)}>
            <Megaphone size={18} />
            <span>Agent Chat</span>
          </button>
        </nav>

        <nav className="auth-sidebar-nav" aria-label="Workspace pages">
          <p>Workspace</p>
          {dataPages.map((page) => {
            const Icon = page.icon;

            return (
              <button key={page.label} type="button" onClick={() => setShowAuth(true)}>
                <Icon size={18} />
                <span>{page.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="auth-workspace">
        <div className="auth-center">
          <h1>What should we handle today?</h1>
          <p className="auth-copy">Built for Pakistan&apos;s Property Agents</p>

          {!showAuth ? (
            <AgentComposer
              actions={quickActions.map((action) => ({
                icon: action.icon,
                label: action.label,
                onClick: () => {
                  setDraft(action.prompt);
                  setShowAuth(true);
                }
              }))}
              className="auth-agent-composer"
              onAttach={() => setShowAuth(true)}
              onChange={setDraft}
              onSubmit={requireSignIn}
              onVoice={() => setShowAuth(true)}
              placeholder="Ask Pislaka Agent to help..."
              value={draft}
            />
          ) : null}

          {showAuth ? (
            <div className="auth-modal-backdrop" role="presentation" onClick={() => setShowAuth(false)}>
              <section
                aria-label="Sign in to Pislaka Agent"
                className="auth-modal"
                role="dialog"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="auth-modal-heading">
                  <span>Sign in to continue</span>
                  <button type="button" onClick={() => setShowAuth(false)}>
                    Close
                  </button>
                </div>
                <AuthForm />
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
