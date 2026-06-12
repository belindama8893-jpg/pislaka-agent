import { BarChart3, CalendarClock, List, MessageCircle, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScheduleReminderToasts } from "@/components/schedule/ScheduleReminderToasts";
import { AccountMenu } from "@/components/workspace/AccountMenu";
import { SidebarAccount } from "@/components/workspace/SidebarAccount";

type WorkspaceSection = "agent" | "listings" | "leads" | "analytics" | "schedule";

type BrokerShellProfile = {
  full_name: string | null;
  email: string | null;
  city: string | null;
  agency_name: string | null;
};

type WorkspaceShellProps = {
  active: WorkspaceSection;
  broker: BrokerShellProfile;
  children: ReactNode;
  initials: string;
  isGuest?: boolean;
  leadsCount?: number;
  subtitle?: string;
  title?: string;
};

const agentNav = [
  { id: "agent", label: "Agent Chat", href: "/", icon: MessageCircle }
] as const;

const workspaceNav = [
  { id: "listings", label: "Listings", href: "/listings", icon: List },
  { id: "leads", label: "Leads", href: "/leads", icon: Users },
  { id: "analytics", label: "Analytics", href: "#", icon: BarChart3 },
  { id: "schedule", label: "Schedule", href: "/schedule", icon: CalendarClock }
] as const;

function getDisplayName(broker: BrokerShellProfile) {
  return broker.full_name || broker.email || "Pislaka Broker";
}

function getNavClass(active: WorkspaceSection, id: WorkspaceSection) {
  return active === id ? "workspace-nav-item active" : "workspace-nav-item";
}

export function WorkspaceShell({
  active,
  broker,
  children,
  initials,
  isGuest = false,
  leadsCount,
  subtitle,
  title
}: WorkspaceShellProps) {
  return (
    <main className={`workspace-shell ${active === "agent" ? "is-agent-home" : ""}`}>
      <aside className="workspace-sidebar" aria-label="Pislaka workspace navigation">
        <Link className="workspace-sidebar-brand" href="/">
          <Image src="/logo.png" alt="Pislaka" width={324} height={120} priority />
        </Link>

        <nav className="workspace-sidebar-nav" aria-label="Agent conversations">
          <p>Agent conversations</p>
          {agentNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link className={getNavClass(active, item.id)} href={item.href} key={item.id}>
                <span>
                  <Icon size={16} /> {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <nav className="workspace-sidebar-nav" aria-label="Workspace pages">
          <p>Workspace</p>
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            const count = item.id === "leads" ? leadsCount : undefined;
            return (
              <Link className={getNavClass(active, item.id)} href={item.href} key={item.id}>
                <span>
                  <Icon size={16} /> {item.label}
                </span>
                {typeof count === "number" ? <strong>{count}</strong> : null}
              </Link>
            );
          })}
        </nav>

        <SidebarAccount
          agency={broker.agency_name}
          city={broker.city}
          initials={initials}
          isGuest={isGuest}
          name={getDisplayName(broker)}
        />
      </aside>

      <section className="workspace-main">
        <header className="workspace-main-topbar">
          <Link className="workspace-mobile-brand" href="/">
            <Image src="/logo.png" alt="Pislaka" width={324} height={120} priority />
          </Link>
          {title || subtitle ? (
            <div className="workspace-title">
              {title ? <h1>{title}</h1> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          ) : null}
          <div className="workspace-top-account">
            <AccountMenu
              agency={broker.agency_name}
              city={broker.city}
              email={broker.email}
              initials={initials}
              isGuest={isGuest}
              leadsCount={leadsCount}
              name={getDisplayName(broker)}
            />
          </div>
        </header>

        <div className="workspace-content">{children}</div>
      </section>
      <ScheduleReminderToasts disabled={isGuest} />
    </main>
  );
}
