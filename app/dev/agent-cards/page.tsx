import type { ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Globe2,
  Home,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
  UsersRound
} from "lucide-react";
import { LeadCreateCard as LeadCreateAgentCard } from "@/components/agent/cards/LeadCreateCard";
import { LeadFollowupCard as LeadFollowupAgentCard } from "@/components/agent/cards/LeadFollowupCard";
import { LeadListCard as LeadListAgentCard } from "@/components/agent/cards/LeadListCard";
import { LeadReplyCard as LeadReplyAgentCard } from "@/components/agent/cards/LeadReplyCard";
import { LeadUpdateCard as LeadUpdateAgentCard } from "@/components/agent/cards/LeadUpdateCard";
import { ListingDraftCard as ListingDraftAgentCard } from "@/components/agent/cards/ListingDraftCard";
import { ListingUpdateCard as ListingUpdateAgentCard } from "@/components/agent/cards/ListingUpdateCard";
import { AnalyticsInsightCard as AnalyticsInsightAgentCard } from "@/components/agent/cards/AnalyticsInsightCard";
import { PromotionPackCard as PromotionPackAgentCard } from "@/components/agent/cards/PromotionPackCard";
import { PromotionTargetCard as PromotionTargetAgentCard } from "@/components/agent/cards/PromotionTargetCard";
import { ScheduleEventCard as ScheduleEventAgentCard } from "@/components/agent/cards/ScheduleEventCard";
import { ScheduleListCard as ScheduleListAgentCard } from "@/components/agent/cards/ScheduleListCard";
import { SystemStatusCard as SystemStatusAgentCard } from "@/components/agent/cards/SystemStatusCard";

type Intent = "draft" | "read" | "confirm" | "external" | "select" | "partial";
type ActionKind = "primary" | "secondary" | "quiet" | "ghost" | "success" | "warning" | "icon";

type Fact = {
  label: string;
  value: ReactNode;
  highlight?: boolean;
};

type Change = {
  label: string;
  before: string;
  after: string;
  highlight?: boolean;
};

type CardShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  domain: string;
  icon: ReactNode;
  intent: Intent;
  status?: ReactNode;
  subtitle: string;
  title: string;
};

type CatalogSection = {
  id: string;
  title: string;
  description: string;
  cards: Array<{
    id: string;
    label: string;
    render: () => ReactNode;
  }>;
};

const intentCopy: Record<Intent, string> = {
  draft: "Draft",
  read: "Read",
  confirm: "Confirm",
  external: "External",
  select: "Select",
  partial: "Partial"
};

function Badge({ intent }: { intent: Intent }) {
  return (
    <span className={`agent-card-showcase-badge ${intent}`}>
      <span aria-hidden="true" />
      {intentCopy[intent]}
    </span>
  );
}

function ActionButton({
  ariaLabel,
  children,
  icon,
  kind = "secondary"
}: {
  ariaLabel?: string;
  children: ReactNode;
  icon?: ReactNode;
  kind?: ActionKind;
}) {
  return (
    <button aria-label={ariaLabel} className={`agent-card-showcase-action ${kind}`} type="button">
      {icon}
      <span>{children}</span>
    </button>
  );
}

function CardShell({ actions, children, domain, icon, intent, status, subtitle, title }: CardShellProps) {
  return (
    <article className="agent-card-showcase-card" aria-label={title}>
      <header className="agent-card-showcase-card-header">
        <div className="agent-card-showcase-card-meta">
          <span className="agent-card-showcase-domain-icon" aria-hidden="true">
            {icon}
          </span>
          <span>{domain}</span>
        </div>
        <Badge intent={intent} />
      </header>
      <div className="agent-card-showcase-title-block">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="agent-card-showcase-card-body">{children}</div>
      {actions ? <footer className="agent-card-showcase-actions">{actions}</footer> : null}
      {status ? <div className="agent-card-showcase-status">{status}</div> : null}
    </article>
  );
}

function FactTable({ facts }: { facts: Fact[] }) {
  return (
    <dl className="agent-card-showcase-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd className={fact.highlight ? "highlight" : undefined}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <dl className="agent-card-showcase-changes">
      {changes.map((change) => (
        <div key={change.label}>
          <dt>{change.label}</dt>
          <dd className={change.highlight ? "highlight" : undefined}>
            <span>{change.before}</span>
            <ArrowRight size={13} aria-hidden="true" />
            <strong>{change.after}</strong>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PhotoStrip({ addMedia = false }: { addMedia?: boolean }) {
  return (
    <div className="agent-card-showcase-photos" aria-label="Listing media preview">
      <span>living</span>
      <span>kitchen</span>
      <span>balcony</span>
      {addMedia ? (
        <button className="agent-card-showcase-photo-action" type="button">
          <Plus size={16} aria-hidden="true" />
          <span>Add media</span>
        </button>
      ) : (
        <span className="agent-card-showcase-photo-more">+2</span>
      )}
    </div>
  );
}

function ObjectSummary({
  initials,
  meta,
  name
}: {
  initials: string;
  meta: string;
  name: string;
}) {
  return (
    <div className="agent-card-showcase-object">
      <span>{initials}</span>
      <div>
        <strong>{name}</strong>
        <p>{meta}</p>
      </div>
    </div>
  );
}

function Hint({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "success" }) {
  return (
    <div className={`agent-card-showcase-hint ${tone}`}>
      <span aria-hidden="true" />
      {children}
    </div>
  );
}

function MiniList({
  items
}: {
  items: Array<{
    action?: ReactNode;
    eyebrow?: string;
    meta: string;
    title: string;
  }>;
}) {
  return (
    <div className="agent-card-showcase-mini-list">
      {items.map((item) => (
        <div className="agent-card-showcase-mini-row" key={item.title}>
          <div>
            {item.eyebrow ? <small>{item.eyebrow}</small> : null}
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
          </div>
          {item.action}
        </div>
      ))}
    </div>
  );
}

function ListingDraftCard() {
  return (
    <ListingDraftAgentCard
      actions={
        <>
          <button className="primary-button small" type="button">
            <CheckCircle2 size={15} /> Confirm & save
          </button>
          <button className="outline-button small" type="button">
            <Pencil size={15} /> Edit fields
          </button>
        </>
      }
      addMediaButton={
        <button className="agent-media-add tile" type="button">
          <Plus size={16} />
          <span>Add media</span>
        </button>
      }
      description="Bright corner unit with open-plan living, modular kitchen, two covered parking spaces, and quick access to the DHA commercial belt."
      fields={[
        { label: "Price", value: "PKR 4.2 Cr" },
        { label: "Location", value: "DHA Phase 6, Lahore" },
        { label: "Area · Type", value: "1,450 sqft · Apartment" },
        { label: "Beds · Baths", value: "2 · 2" }
      ]}
      media={
        <>
          <span className="agent-media-thumb placeholder">living</span>
          <span className="agent-media-thumb placeholder">kitchen</span>
          <span className="agent-media-thumb placeholder">balcony</span>
        </>
      }
      status="Missing floor and furnishing. Safe to save as draft."
      subtitle="Auto-drafted from broker message · 6 of 8 fields"
      title="2 BHK Apartment · DHA Phase 6"
      />
  );
}

function ListingUpdateCard() {
  return (
    <ListingUpdateAgentCard
      actions={
        <>
          <button className="primary-button small" type="button">
            <CheckCircle2 size={15} /> Confirm update
          </button>
          <button className="outline-button small" type="button">
            <Pencil size={15} /> Edit fields
          </button>
        </>
      }
      changes={[
        { label: "Price", previousValue: "PKR 4.2 Cr", value: "PKR 4.35 Cr", highlight: true },
        { label: "Status", previousValue: "Draft", value: "Published" },
        { label: "Parking", previousValue: "Not set", value: "2 covered" }
      ]}
      hint="Only these fields will be changed. Media and description stay untouched."
      subtitle="Target resolved from DHA Phase 6 apartment"
      target={{
        initials: "D6",
        meta: "Published · Lahore · 2BHK apartment",
        title: "DHA Phase 6 Apt"
      }}
      title="Update listing facts"
    />
  );
}

function PromotionTargetCard() {
  return (
    <PromotionTargetAgentCard
      channels={[
        { checked: true, id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={14} /> },
        { checked: true, id: "instagram", label: "Instagram", icon: <Send size={14} /> },
        { checked: true, id: "portal", label: "Portal", icon: <Globe2 size={14} /> }
      ]}
      fields={[
        { label: "Channels", value: "WhatsApp · Instagram · Portal" },
        { label: "Output", value: "Copy + trackable links" },
        { label: "Posting", value: "Manual only" }
      ]}
      hint="Campaign links are generated after confirmation. Nothing is posted automatically."
      subtitle="Confirm target and channels before links are generated"
      targetMeta="DHA Phase 6 · 2BHK apartment · PKR 4.2 Cr"
      targetTitle="DHA Phase 6 Apt"
      title="Generate promotion pack"
      actions={
        <>
          <ActionButton icon={<Sparkles size={15} />} kind="primary">
            Generate pack
          </ActionButton>
          <ActionButton icon={<Pencil size={15} />}>Change channels</ActionButton>
        </>
      }
    />
  );
}

function PromotionPackCard() {
  return (
    <PromotionPackAgentCard
      channels={[
        {
          id: "whatsapp",
          icon: <MessageCircle size={14} />,
          label: "WhatsApp",
          meta: "Trackable campaign copy",
          copies: [
            {
              title: "WhatsApp draft",
              body: "Just listed in DHA Phase 6: 2 BHK apartment, 1,450 sqft at PKR 4.2 Cr. Message me for a viewing this week.",
              cta: "CTA: Message agent",
              landingUrl: <code>pslk.co/dha6-2bhk</code>,
              actions: (
                <>
                  <ActionButton icon={<Copy size={14} />} kind="secondary">
                    Copy
                  </ActionButton>
                  <ActionButton ariaLabel="Open landing page" icon={<ExternalLink size={14} />} kind="icon">
                    Open landing
                  </ActionButton>
                  <ActionButton ariaLabel="Share promotion" icon={<Send size={14} />} kind="icon">
                    Share
                  </ActionButton>
                </>
              )
            }
          ]
        },
        {
          id: "instagram",
          icon: <Send size={14} />,
          label: "Instagram",
          meta: "Caption only",
          copies: [
            {
              title: "Instagram caption",
              body: "New in DHA Phase 6: bright 2BHK corner unit, 1,450 sqft, two covered parking spaces.",
              copiedHint: "On your clipboard · not published",
              actions: (
                <ActionButton icon={<Check size={14} />} kind="success">
                  Copied
                </ActionButton>
              )
            }
          ]
        }
      ]}
      subtitle="3 channel drafts · no posting or sending yet"
      title="Promotion pack · DHA Phase 6 Apt"
      status={
        <>
          <span aria-hidden="true" />
          External actions open outside Pislaka. Nothing has been posted.
        </>
      }
    />
  );
}

function LeadCreateCard() {
  return (
    <LeadCreateAgentCard
      actions={
        <>
          <button className="primary-button small" type="button">
            <CheckCircle2 size={15} /> Confirm save
          </button>
          <button className="outline-button small" type="button">
            <Pencil size={15} /> Edit fields
          </button>
        </>
      }
      fields={[
        { label: "Need", value: "2BHK in DHA" },
        { label: "Budget", value: "PKR 4.5 Cr" },
        { label: "Source", value: "WhatsApp campaign" },
        { label: "Status", value: "New lead" }
      ]}
      hint="Creates a CRM record and links it to DHA Phase 6 Apt."
      subtitle="New inquiry from campaign landing page"
      target={{
        initials: "MK",
        meta: "+92 321 8822110 · WhatsApp preferred",
        title: "Mariam Khan"
      }}
      title="Save new lead"
    />
  );
}

function LeadListCard() {
  return (
    <LeadListAgentCard
      footer={
        <button className="agent-card-showcase-link" type="button">
          View all 18 in Leads
        </button>
      }
      items={[
        {
          action: (
            <button className="agent-card-showcase-action icon" type="button" aria-label="Open Ahmed Raza">
              <ChevronRight size={15} />
              <span>Open lead</span>
            </button>
          ),
          badge: <span className="lead-status hot">Hot</span>,
          details: [{ label: "Listing", value: "DHA Phase 6" }, { label: "Time", value: "2h ago" }],
          initials: "AR",
          key: "ahmed",
          summary: "2BHK under PKR 4.5 Cr",
          title: "Ahmed Raza"
        },
        {
          action: (
            <button className="agent-card-showcase-action icon" type="button" aria-label="Open Sara Khan">
              <ChevronRight size={15} />
              <span>Open lead</span>
            </button>
          ),
          badge: <span className="lead-status qualified">Warm</span>,
          details: [{ label: "Listing", value: "Bahria Town" }, { label: "Time", value: "1d ago" }],
          initials: "SK",
          key: "sara",
          summary: "Viewing this week",
          title: "Sara Khan"
        },
        {
          action: (
            <button className="agent-card-showcase-action icon" type="button" aria-label="Open Bilal Ahmed">
              <ChevronRight size={15} />
              <span>Open lead</span>
            </button>
          ),
          badge: <span className="lead-status new">New</span>,
          details: [{ label: "Listing", value: "No listing yet" }, { label: "Time", value: "3d ago" }],
          initials: "BA",
          key: "bilal",
          summary: "Investor, 3-4 units",
          title: "Bilal Ahmed"
        }
      ]}
      recommendation={{
        action: (
          <button className="primary-button small" type="button">
            <Send size={14} /> Draft reply
          </button>
        ),
        eyebrow: "Next best action",
        meta: "Hot lead · asked 2h ago · listing matched",
        title: "Send the price reply first"
      }}
      subtitle="4 leads need a touch · sorted by urgency"
      title="Today's follow-ups"
    />
  );
}

function LeadUpdateCard() {
  return (
    <LeadUpdateAgentCard
      actions={
        <>
          <button className="primary-button small" type="button">
            <CheckCircle2 size={15} /> Confirm update
          </button>
          <button className="outline-button small" type="button">
            <Pencil size={15} /> Edit fields
          </button>
        </>
      }
      changes={[
        { label: "Status", previousValue: "New", value: "Contacted", highlight: true },
        { label: "Primary listing", previousValue: "Not set", value: "DHA Phase 6 Apt" },
        { label: "Next follow-up", previousValue: "Not set", value: "Tomorrow 11:00" }
      ]}
      hint="Writes to your CRM. Review the changes before confirming."
      subtitle="+92 300 1234567 · currently New"
      target={{
        badge: <span className="lead-status contacted">Contacted</span>,
        initials: "AR",
        meta: "Lead profile changes pending confirmation",
        title: "Ahmed Raza"
      }}
      title="Update Ahmed Raza"
    />
  );
}

function LeadReplyCard() {
  return (
    <LeadReplyAgentCard
      actions={
        <>
          <button className="outline-button small" type="button">
            <Copy size={15} />
            Copy reply
          </button>
          <button className="primary-button small" type="button">
            <ExternalLink size={15} />
            Open WhatsApp
          </button>
        </>
      }
      fields={[
        { label: "Channel", value: "WhatsApp" },
        { label: "Lead", value: "Ahmed Raza" },
        { label: "Listing", value: "DHA Phase 6 Apt" },
        { label: "Next step", value: "Offer viewing slots" }
      ]}
      replyText={
        <>
          Salam Ahmed, the DHA Phase 6 apartment is available at PKR 4.2 Cr. It has 2 bedrooms, 2 baths and two covered
          parking spaces. I can arrange a viewing tomorrow after 4pm.
        </>
      }
      subtitle="WhatsApp reply draft · not sent"
      title="Reply to Ahmed Raza"
    />
  );
}

function LeadFollowupCard() {
  return (
    <LeadFollowupAgentCard
      fields={[
        { label: "Budget", value: "PKR 4.5 Cr" },
        { label: "Area", value: "DHA Phase 6" },
        { label: "Intent", value: "Viewing this week" },
        { label: "Suggested status", previousValue: "New", value: "Hot" }
      ]}
      hint="Original chat text is not saved by default."
      record={{
        body: "Ahmed asked for a DHA Phase 6 viewing this week and needs covered parking. He can visit after 4pm.",
        label: "Follow-up record",
        meta: "Today 4:20 PM"
      }}
      steps={["Imported WhatsApp TXT", "Matched by phone", "Needs follow-up"]}
      subtitle="Imported WhatsApp chat · matched to Ahmed Raza"
      target={{
        initials: "AR",
        meta: "+92 300 1234567 · DHA Phase 6",
        title: "Ahmed Raza"
      }}
      title="Save follow-up summary"
      actions={
        <>
          <ActionButton icon={<CheckCircle2 size={15} />} kind="primary">
            Save note
          </ActionButton>
          <ActionButton icon={<CalendarPlus size={15} />}>Set reminder</ActionButton>
        </>
      }
    />
  );
}

function ScheduleEventCard() {
  return (
    <ScheduleEventAgentCard
      description="Viewing with Ahmed Raza for the DHA Phase 6 apartment. Agent should confirm the slot before saving it."
      eventTitle="Tomorrow · 11:00 AM"
      fields={[
        { label: "Event", value: "Property viewing" },
        { label: "Lead", value: "Ahmed Raza" },
        { label: "Listing", value: "DHA Phase 6 Apt" },
        { label: "Reminder", value: "30 min before" }
      ]}
      subtitle="Viewing with lead and listing attached"
      title="Schedule preview"
      actions={
        <>
          <ActionButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm schedule
          </ActionButton>
          <ActionButton icon={<Clock3 size={15} />}>Edit time</ActionButton>
          <ActionButton icon={<Pencil size={15} />}>Edit details</ActionButton>
        </>
      }
    />
  );
}

function ScheduleListCard() {
  return (
    <ScheduleListAgentCard
      items={[
        { id: "sara", meta: "Bahria Town inquiry", time: "10:30", title: "Follow up with Sara Khan" },
        { id: "ahmed", meta: "Ahmed Raza · 2BHK", time: "14:00", title: "Viewing · DHA Phase 6 Apt" },
        { id: "docs", meta: "Collect CNIC copies", time: "17:30", title: "Document reminder" }
      ]}
      subtitle="Today · broker timezone"
      title="3 events scheduled"
      actions={
        <button className="agent-card-showcase-link" type="button">
          Open Schedule
        </button>
      }
    />
  );
}

function EntitySelectionCard() {
  return (
    <CardShell
      domain="Selection"
      icon={<Search size={15} />}
      intent="select"
      subtitle="Several Ahmed leads matched this request"
      title="Choose a lead to continue"
      actions={<ActionButton kind="ghost">Continue without binding</ActionButton>}
    >
      <MiniList
        items={[
          {
            action: (
              <ActionButton ariaLabel="Select Ahmed Raza" icon={<ChevronRight size={15} />} kind="icon">
                Select
              </ActionButton>
            ),
            eyebrow: "Phone match",
            meta: "+92 300 1234567 · DHA Phase 6 · Hot",
            title: "Ahmed Raza"
          },
          {
            action: (
              <ActionButton ariaLabel="Select Ahmed Rafique" icon={<ChevronRight size={15} />} kind="icon">
                Select
              </ActionButton>
            ),
            eyebrow: "Name match",
            meta: "No phone · Gulberg · New",
            title: "Ahmed Rafique"
          }
        ]}
      />
      <Hint tone="warning">No records will be shown or changed until one candidate is selected.</Hint>
    </CardShell>
  );
}

function AttributionSummaryCard() {
  return (
    <AnalyticsInsightAgentCard
      fields={[
        { label: "Leads", value: "28" },
        { label: "Top channel", value: "WhatsApp" },
        { label: "Top listing", value: "DHA Phase 6 Apt" },
        { label: "Conversion", value: "7.8%" }
      ]}
      insights={[
        { title: "DHA apartments convert 2.1x better", meta: "Most clicks happen after 7pm" },
        { title: "Boost WhatsApp follow-up cadence", meta: "Prioritize hot leads within 2 hours" }
      ]}
      subtitle="Last 30 days · campaign attribution"
      title="WhatsApp is driving qualified leads"
      actions={
        <>
          <ActionButton icon={<BarChart3 size={15} />} kind="primary">
            Open analytics
          </ActionButton>
          <ActionButton icon={<MessageCircle size={15} />}>Ask why</ActionButton>
        </>
      }
    />
  );
}

function StatusStateCard() {
  return (
    <SystemStatusAgentCard
      fields={[
        { label: "Record", value: "Saved" },
        { label: "Media", value: "3 of 4 uploaded" },
        { label: "Failed file", value: "balcony-wide.jpg" },
        { label: "Recovery", value: "Retry upload" }
      ]}
      hint="The listing is safe. Only the failed media file needs attention."
      subtitle="Action completed with recoverable issue"
      title="Listing saved · 1 media upload failed"
      actions={
        <>
          <ActionButton icon={<Plus size={15} />} kind="warning">
            Retry media
          </ActionButton>
          <ActionButton icon={<ExternalLink size={15} />}>Open listing</ActionButton>
        </>
      }
    />
  );
}

const catalogSections: CatalogSection[] = [
  {
    id: "listing",
    title: "Listing Cards",
    description: "Draft, update, and save-state patterns for property records.",
    cards: [
      { id: "listing-draft", label: "listing_draft", render: ListingDraftCard },
      { id: "listing-update", label: "listing_update", render: ListingUpdateCard }
    ]
  },
  {
    id: "lead",
    title: "Lead Cards",
    description: "Create, list, update, reply, and follow-up workflows.",
    cards: [
      { id: "lead-create", label: "lead_create", render: LeadCreateCard },
      { id: "lead-list", label: "lead_list", render: LeadListCard },
      { id: "lead-update", label: "lead_update", render: LeadUpdateCard },
      { id: "lead-reply", label: "lead_reply", render: LeadReplyCard },
      { id: "lead-followup", label: "lead_followup", render: LeadFollowupCard }
    ]
  },
  {
    id: "schedule",
    title: "Schedule Cards",
    description: "Confirm new events and read daily schedule results.",
    cards: [
      { id: "schedule-event", label: "schedule_event", render: ScheduleEventCard },
      { id: "schedule-list", label: "schedule_list", render: ScheduleListCard }
    ]
  },
  {
    id: "promotion",
    title: "Promotion Cards",
    description: "Confirm campaign generation and show channel-specific outputs.",
    cards: [
      { id: "promotion-target", label: "promotion_target", render: PromotionTargetCard },
      { id: "promotion-pack", label: "promotion_pack", render: PromotionPackCard }
    ]
  },
  {
    id: "selection-analysis",
    title: "Selection, Analytics, And States",
    description: "Resolve ambiguity, summarize attribution, and show partial success.",
    cards: [
      { id: "entity-selection", label: "entity_selection", render: EntitySelectionCard },
      { id: "attribution-summary", label: "attribution_summary", render: AttributionSummaryCard },
      { id: "status-state", label: "status_state", render: StatusStateCard }
    ]
  }
];

function CatalogBlock({ mode }: { mode: "desktop" | "mobile" }) {
  return (
    <div className={`agent-card-showcase-catalog ${mode}`}>
      {catalogSections.map((section) => (
        <section className="agent-card-showcase-family" key={`${mode}-${section.id}`} aria-labelledby={`${mode}-${section.id}`}>
          <div className="agent-card-showcase-family-heading">
            <div>
              <h3 id={`${mode}-${section.id}`}>{section.title}</h3>
              <p>{section.description}</p>
            </div>
            <span>{section.cards.length} cards</span>
          </div>
          <div className="agent-card-showcase-card-grid">
            {section.cards.map((card) => (
              <div className="agent-card-showcase-card-sample" key={`${mode}-${card.id}`}>
                <div className="agent-card-showcase-sample-label">{card.label}</div>
                {card.render()}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AgentCardsShowcasePage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_AGENT_CARD_SHOWCASE !== "true") {
    return (
      <main className="agent-card-showcase-disabled">
        <h1>Agent card showcase</h1>
        <p>This internal page is disabled in production.</p>
      </main>
    );
  }

  return (
    <main className="agent-card-showcase">
      <header className="agent-card-showcase-hero">
        <div>
          <span className="agent-card-showcase-kicker">
            <span aria-hidden="true" />
            Pislaka Agent · card catalog
          </span>
          <h1>Agent reply cards</h1>
          <p>
            Full internal catalog of structured Agent cards using formal fixture content. Desktop and mobile
            sections share the same card taxonomy so implementation can be checked side by side.
          </p>
        </div>
      </header>

      <section className="agent-card-showcase-rule-panel" aria-labelledby="rules-title">
        <h2 id="rules-title">Display rules</h2>
        <div>
          <p>Each card exposes one clear primary decision.</p>
          <p>Writes, schedule changes, campaign links, and external actions require confirmation.</p>
          <p>Read-only and draft cards show outputs without pretending work is saved or sent.</p>
          <p>Mobile cards use the same content, compressed into a chat-column width.</p>
        </div>
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="desktop-title">
        <div className="agent-card-showcase-section-heading">
          <span>1</span>
          <div>
            <h2 id="desktop-title">Desktop Catalog</h2>
            <p>All card families at workspace width, grouped by workflow domain.</p>
          </div>
        </div>
        <CatalogBlock mode="desktop" />
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="mobile-title">
        <div className="agent-card-showcase-section-heading">
          <span>2</span>
          <div>
            <h2 id="mobile-title">Mobile Catalog</h2>
            <p>The same formal content inside a 360px chat column.</p>
          </div>
        </div>
        <CatalogBlock mode="mobile" />
      </section>
    </main>
  );
}
