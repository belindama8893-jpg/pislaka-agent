import { redirect } from "next/navigation";
import { LeadListPanel } from "@/components/leads/LeadListPanel";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getSupabaseUserSafely } from "@/lib/auth/safe-user";
import { getNewLeadsCountForBroker, getRecentLeadsForBroker } from "@/lib/leads/queries";
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
  const { user, error: userError } = await getSupabaseUserSafely(supabase);

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
  const [leads, newLeadsCount] = await Promise.all([
    getRecentLeadsForBroker(supabase, broker.id, 30),
    getNewLeadsCountForBroker(supabase, broker.id)
  ]);

  return (
    <WorkspaceShell
      active="leads"
      broker={broker}
      initials={getInitials(broker)}
      leadsCount={newLeadsCount}
      subtitle="Review buyer inquiries, source channels, and follow-up status."
      title="Leads"
    >
      <LeadListPanel className="library-page-panel" leads={leads} />
    </WorkspaceShell>
  );
}
