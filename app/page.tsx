import {
  BarChart3,
  Bell,
  CalendarClock,
  ChevronRight,
  List,
  Menu,
  Plus,
  Sparkles,
  Users,
  Zap
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import { ProfileCompletionForm } from "@/components/profile/ProfileCompletionForm";
import { SignOutButton } from "@/components/workspace/SignOutButton";
import type { BrokerEventRecord } from "@/lib/events/types";
import { getRecentLeadsForBroker } from "@/lib/leads/queries";
import type { LeadListItem } from "@/lib/leads/types";
import type { ListingMediaRecord, ListingRecord } from "@/lib/listings/types";
import { createServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type BrokerProfile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  city: string | null;
  agency_name: string | null;
  phone: string | null;
  preferred_language: string | null;
};

type RawListingRecord = Omit<ListingRecord, "media"> & {
  listing_media?: ListingMediaRecord[] | null;
};

function getFirstName(profile: BrokerProfile) {
  return profile.full_name?.trim().split(/\s+/)[0] || "Broker";
}

function formatLeadAge(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function getLeadInterest(lead: LeadListItem) {
  const listing = [lead.listing_title, lead.listing_area, lead.listing_city].filter(Boolean).join(", ");
  const channel = lead.campaign_channel ?? lead.source_channel;

  return [listing || "Listing not set", channel ? `via ${channel}` : null].filter(Boolean).join(" · ");
}

function getEventTimeLabel(event: BrokerEventRecord) {
  const primaryTime = event.start_at ?? event.reminder_at;

  if (!primaryTime) {
    return event.recurrence_rule ? "Recurring" : "Time not set";
  }

  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(primaryTime));
}

function getEventContext(event: BrokerEventRecord) {
  return [event.lead_name, event.listing_reference, event.location_text].filter(Boolean).join(" · ");
}

function getInitials(profile: BrokerProfile) {
  const source = profile.full_name || profile.email || "Pislaka Broker";
  return source
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isProfileComplete(profile: BrokerProfile) {
  return Boolean(profile.full_name?.trim() && profile.city?.trim() && profile.agency_name?.trim());
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

  const { data: existingProfile, error: profileError } = await supabase
    .from("broker_profiles")
    .select("id, auth_user_id, full_name, email, city, agency_name, phone, preferred_language")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (existingProfile) {
    return { supabase, broker: existingProfile as BrokerProfile };
  }

  const { data: createdProfile, error: insertError } = await supabase
    .from("broker_profiles")
    .insert({
      auth_user_id: user.id,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      email: user.email ?? null
    })
    .select("id, auth_user_id, full_name, email, city, agency_name, phone, preferred_language")
    .single();

  if (insertError || !createdProfile) {
    throw new Error(insertError?.message ?? "Unable to create broker profile");
  }

  return { supabase, broker: createdProfile as BrokerProfile };
}

async function getListingsForBroker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  brokerId: string
) {
  const { data: listings, error } = await supabase
    .from("listings")
    .select(
      "id, status, title, description, city, location_area, property_type, listing_type, price_amount, price_currency, area_value, area_unit, bedrooms, bathrooms, features, created_at, updated_at, listing_media(id, listing_id, media_type, storage_url, sort_order, created_at)"
    )
    .eq("broker_id", brokerId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const service = createServiceClient();
  const rawListings = (listings ?? []) as RawListingRecord[];

  return Promise.all(
    rawListings.map(async ({ listing_media: mediaRows, ...listing }) => {
      const media = await Promise.all(
        (mediaRows ?? []).map(async (mediaRow) => {
          const { data: signedUrlData } = await service.storage
            .from("listing-media")
            .createSignedUrl(mediaRow.storage_url, 60 * 60);

          return {
            ...mediaRow,
            signed_url: signedUrlData?.signedUrl ?? null
          };
        })
      );

      return {
        ...listing,
        media: media.sort((left, right) => left.sort_order - right.sort_order)
      } as ListingRecord;
    })
  );
}

async function getUpcomingEventsForBroker(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  brokerId: string
) {
  const { data: events, error } = await supabase
    .from("broker_events")
    .select(
      "id, broker_id, event_category, event_type, title, description, start_at, end_at, reminder_at, recurrence_rule, status, lead_id, listing_id, lead_name, listing_reference, location_text, source_payload, created_from, created_at, updated_at"
    )
    .eq("broker_id", brokerId)
    .eq("status", "scheduled")
    .order("start_at", { ascending: true, nullsFirst: false })
    .order("reminder_at", { ascending: true, nullsFirst: false })
    .limit(5);

  if (error) {
    return [];
  }

  return (events ?? []) as BrokerEventRecord[];
}

export default async function Home() {
  const { supabase, broker } = await getCurrentBrokerContext();
  const [listings, leads, events] = await Promise.all([
    getListingsForBroker(supabase, broker.id),
    getRecentLeadsForBroker(supabase, broker.id, 5),
    getUpcomingEventsForBroker(supabase, broker.id)
  ]);
  const firstName = getFirstName(broker);
  const profileComplete = isProfileComplete(broker);
  const newLeadsCount = leads.filter((lead) => lead.status === "new").length;
  const listingsWithMediaCount = listings.filter((listing) => listing.media?.length).length;
  const activeCampaignLeadsCount = leads.filter((lead) => lead.campaign_code).length;
  const topLead = leads[0];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="logo">Pislaka Agent</div>
        <div className="nav-label">Workspace</div>
        <nav className="nav-menu">
          <a className="nav-item active" href="#">
            <span>
              <Sparkles size={18} /> AI Assistant
            </span>
          </a>
          <div className="nav-label embedded">Structured Data</div>
          <Link className="nav-item" href="/listings">
            <span>
              <List size={18} /> Listings
            </span>
            <strong>{listings.length}</strong>
          </Link>
          <Link className="nav-item" href="/leads">
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

      <section className="workspace">
        <header className="topbar">
          <div className="greeting">
            <button className="icon-button mobile-only" aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div>
              <span className="workspace-eyebrow">Agent workspace</span>
              <h1>Good afternoon, {firstName}</h1>
              <p>Create listings, launch campaigns, and follow up with buyers from one flow.</p>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="primary-button">
              <Plus size={18} /> Quick Post
            </button>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>
            <SignOutButton />
          </div>
        </header>

        {!profileComplete ? <ProfileCompletionForm profile={broker} /> : null}

        <section className="workspace-summary" aria-label="Workspace summary">
          <div>
            <span>Listings</span>
            <strong>{listings.length}</strong>
            <small>{listingsWithMediaCount} with media</small>
          </div>
          <div>
            <span>New leads</span>
            <strong>{newLeadsCount}</strong>
            <small>{activeCampaignLeadsCount} from campaigns</small>
          </div>
          <div>
            <span>Next action</span>
            <strong>{events[0] ? "Schedule" : topLead ? "Follow up" : "Create listing"}</strong>
            <small>{events[0]?.title || topLead?.full_name || "Voice, photo, or chat"}</small>
          </div>
        </section>

        <div className="content-grid">
          <AgentWorkspace
            firstName={firstName}
            listingsCount={listings.length}
            recentLeads={leads}
            recentListings={listings.map((listing) => ({
              id: listing.id,
              title: listing.title,
              location_area: listing.location_area,
              city: listing.city,
              property_type: listing.property_type,
              area_value: listing.area_value,
              area_unit: listing.area_unit,
              bedrooms: listing.bedrooms
            }))}
          />

          <aside className="side-widgets focus-rail">
            <section className="widget focus-widget">
              <div className="widget-header">
                <div>
                  <span className="section-kicker">Priority</span>
                  <h3>
                    <Zap size={17} /> Buyer queue
                  </h3>
                </div>
                <Link href="/leads">
                  View all <ChevronRight size={14} />
                </Link>
              </div>
              {leads.length ? (
                leads.slice(0, 3).map((lead) => (
                  <div className={`lead-row ${lead.urgency === "high" ? "urgent-lead" : ""}`} key={lead.id}>
                    <div>
                      <strong>{lead.full_name || "Unnamed buyer"}</strong>
                      <p>{getLeadInterest(lead)}</p>
                      {lead.ai_summary || lead.message ? <small>{lead.ai_summary || lead.message}</small> : null}
                      <span className="lead-meta">
                        {lead.phone || "No phone"} · {formatLeadAge(lead.created_at)}
                      </span>
                    </div>
                    <Link className="ghost-link" href="/leads">
                      Open
                    </Link>
                  </div>
                ))
              ) : (
                <p className="empty-state">
                  Campaign inquiries will appear here with channel attribution and follow-up context.
                </p>
              )}
            </section>

            <section className="widget focus-widget">
              <div className="widget-header">
                <div>
                  <span className="section-kicker">Today / Upcoming</span>
                  <h3>
                    <CalendarClock size={17} /> Schedule
                  </h3>
                </div>
              </div>
              {events.length ? (
                <div className="event-mini-list">
                  {events.slice(0, 4).map((event) => (
                    <div className="event-mini-row" key={event.id}>
                      <time>{getEventTimeLabel(event)}</time>
                      <div>
                        <strong>{event.title}</strong>
                        <small>{getEventContext(event) || event.event_type.replace(/_/g, " ")}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">
                  Ask the agent to schedule viewings, follow-up reminders, offer deadlines, or weekly reviews.
                </p>
              )}
            </section>

            <section className="widget focus-widget">
              <div className="widget-header">
                <div>
                  <span className="section-kicker">Workflow</span>
                  <h3>
                    <BarChart3 size={17} /> Operating rhythm
                  </h3>
                </div>
              </div>
              <div className="workflow-steps">
                <div className="workflow-step active">
                  <span>1</span>
                  <div>
                    <strong>Capture property</strong>
                    <small>Voice, photos, or chat</small>
                  </div>
                </div>
                <div className="workflow-step">
                  <span>2</span>
                  <div>
                    <strong>Confirm listing</strong>
                    <small>Edit facts before saving</small>
                  </div>
                </div>
                <div className="workflow-step">
                  <span>3</span>
                  <div>
                    <strong>Promote channels</strong>
                    <small>Each channel gets a lead page</small>
                  </div>
                </div>
                <div className="workflow-step">
                  <span>4</span>
                  <div>
                    <strong>Follow up</strong>
                    <small>Draft WhatsApp replies</small>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

      </section>
    </main>
  );
}
