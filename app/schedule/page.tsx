import { redirect } from "next/navigation";
import { SchedulePanel } from "@/components/schedule/SchedulePanel";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getBrokerEventsForBroker } from "@/lib/events/queries";
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

async function getListingsCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  brokerId: string
) {
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("broker_id", brokerId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export default async function SchedulePage() {
  const { supabase, broker } = await getCurrentBrokerContext();
  const [leads, listingsCount, eventsResult] = await Promise.all([
    getRecentLeadsForBroker(supabase, broker.id, 30),
    getListingsCount(supabase, broker.id),
    getBrokerEventsForBroker(supabase, broker.id, { status: "all", limit: 40 }).then(
      (events) => ({ events, migrationRequired: false }),
      (error) => ({
        events: [],
        migrationRequired:
          error instanceof Error && /broker_events|does not exist|schema cache/i.test(error.message)
      })
    )
  ]);
  const newLeadsCount = leads.filter((lead) => lead.status === "new").length;

  return (
    <WorkspaceShell
      active="schedule"
      broker={broker}
      initials={getInitials(broker)}
      leadsCount={newLeadsCount}
      listingsCount={listingsCount}
      subtitle="Manage viewings, follow-ups, signing dates, handovers, and reminders."
      title="Schedule"
    >
      <SchedulePanel
        className="library-page-panel"
        events={eventsResult.events}
        migrationRequired={eventsResult.migrationRequired}
      />
    </WorkspaceShell>
  );
}
