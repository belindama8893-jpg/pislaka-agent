import { BarChart3, List, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadListPanel } from "@/components/leads/LeadListPanel";
import { AccountMenu } from "@/components/workspace/AccountMenu";
import { MobileTabBar } from "@/components/workspace/MobileTabBar";
import { getRecentLeadsForBroker } from "@/lib/leads/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BrokerProfile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  city: string | null;
  agency_name: string | null;
};

function getInitials(profile: BrokerProfile) {
  const source = profile.full_name || profile.email || "Pislaka Broker";
  return source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function getCurrentBrokerContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/auth/sign-in");
  }

  const { data: broker, error } = await supabase
    .from("broker_profiles")
    .select("id, auth_user_id, full_name, email, city, agency_name")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !broker) {
    throw new Error(error?.message ?? "Broker profile not found");
  }

  return { supabase, broker: broker as BrokerProfile };
}

export default async function LeadsPage() {
  const { supabase, broker } = await getCurrentBrokerContext();
  const leads = await getRecentLeadsForBroker(supabase, broker.id, 100);
  const newLeadsCount = leads.filter((lead) => lead.status === "new").length;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="logo">Pislaka Agent</div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-menu">
          <Link className="nav-item" href="/">
            <span>
              <Sparkles size={18} /> AI Assistant
            </span>
          </Link>
          <div className="nav-label embedded">Structured Data</div>
          <Link className="nav-item" href="/listings">
            <span>
              <List size={18} /> Listings
            </span>
          </Link>
          <Link className="nav-item active" href="/leads">
            <span>
              <Users size={18} /> Leads
            </span>
            <strong className="urgent">{newLeadsCount}</strong>
          </Link>
          <a className="nav-item" href="#">
            <span>
              <BarChart3 size={18} /> Analytics
            </span>
          </a>
        </nav>
        <div className="profile">
          <div className="avatar">{getInitials(broker)}</div>
          <div>
            <strong>{broker.full_name || broker.email || "Pislaka Broker"}</strong>
            <small>
              {broker.agency_name ? `${broker.agency_name}, ` : ""}
              {broker.city || "Pakistan"}
            </small>
          </div>
        </div>
      </aside>
      <MobileTabBar active="leads" leadsCount={newLeadsCount} />

      <section className="workspace library-page">
        <header className="topbar library-topbar">
          <div className="greeting">
            <div>
              <h1>Leads</h1>
              <p>Review buyer inquiries, source channels, and follow-up status.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="outline-button" href="/">
              Back to Agent Workspace
            </Link>
            <AccountMenu
              initials={getInitials(broker)}
              name={broker.full_name || broker.email || "Pislaka Broker"}
              email={broker.email}
              agency={broker.agency_name}
              city={broker.city}
              leadsCount={newLeadsCount}
            />
          </div>
        </header>

        <LeadListPanel className="library-page-panel" leads={leads} />
      </section>
    </main>
  );
}
