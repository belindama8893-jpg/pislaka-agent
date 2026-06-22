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
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";
import {
  AgentCardBadge,
  AgentCardButton,
  AgentCardNotice,
  AgentCardTextBlock,
  AgentCandidateList,
  AgentInfoGrid,
  AgentStepList
} from "@/components/agent/AgentCardPrimitives";

type Intent = "draft" | "read" | "confirm" | "external" | "select" | "partial";

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

const foundationTokens = [
  {
    group: "Card",
    tokens: [
      { name: "--agent-card-width", value: "620px", usage: "Max card width" },
      { name: "--agent-card-radius", value: "16px", usage: "Outer card radius" },
      { name: "--agent-card-header-x", value: "18px", usage: "Header horizontal padding" },
      { name: "--agent-card-body-x", value: "18px", usage: "Body horizontal padding" },
      { name: "--agent-card-body-gap", value: "13px", usage: "Stack spacing inside body" }
    ]
  },
  {
    group: "Typography",
    tokens: [
      { name: "--agent-card-title-size", value: "1.04rem", usage: "Card title" },
      { name: "--agent-card-title-weight", value: "650", usage: "Card title weight" },
      { name: "--agent-card-summary-size", value: "0.79rem", usage: "Subtitle and summary copy" },
      { name: "--agent-card-label-size", value: "0.66rem", usage: "Field labels" },
      { name: "--agent-card-value-size", value: "0.85rem", usage: "Field values" }
    ]
  },
  {
    group: "Actions",
    tokens: [
      { name: "--agent-card-button-height", value: "32px", usage: "Default card action height" },
      { name: "--agent-card-button-radius", value: "8px", usage: "Action radius" },
      { name: "--agent-card-button-size", value: "0.82rem", usage: "Action label size" },
      { name: "--agent-card-button-weight", value: "500", usage: "Action label weight" },
      { name: "--agent-card-button-primary-bg", value: "#1b332e", usage: "Primary action surface" }
    ]
  },
  {
    group: "Badges",
    tokens: [
      { name: "--agent-card-badge-height", value: "22px", usage: "Badge minimum height" },
      { name: "--agent-card-badge-radius", value: "999px", usage: "Pill shape" },
      { name: "--agent-card-badge-size", value: "0.625rem", usage: "Badge label size" },
      { name: "--agent-card-badge-weight", value: "560", usage: "Badge label weight" },
      { name: "--agent-card-accent", value: "oklch(0.42 0.09 168)", usage: "Listing/card accent" }
    ]
  }
];

function Badge({ intent }: { intent: Intent }) {
  return (
    <span className={`agent-card-showcase-badge ${intent}`}>
      <span aria-hidden="true" />
      {intentCopy[intent]}
    </span>
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

function FoundationBlock() {
  return (
    <section className="agent-card-showcase-foundation" aria-labelledby="foundation-title">
      <div className="agent-card-showcase-foundation-heading">
        <span>Foundation</span>
        <div>
          <h2 id="foundation-title">Base Components And Design Tokens</h2>
          <p>These are the smallest card primitives. Full cards below should be composed from these instead of inventing local styles.</p>
        </div>
      </div>

      <div className="agent-card-showcase-foundation-grid">
        <div className="agent-card-showcase-foundation-panel">
          <h3>Components</h3>
          <div className="agent-card-showcase-foundation-stack">
            <div className="agent-card-showcase-foundation-row">
              <span>Buttons</span>
              <div className="agent-card-showcase-foundation-controls">
                <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
                  Confirm & save
                </AgentCardButton>
                <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
                  Edit fields
                </AgentCardButton>
                <AgentCardButton ariaLabel="Open" icon={<ExternalLink size={15} />} kind="icon">
                  Open
                </AgentCardButton>
              </div>
            </div>

            <div className="agent-card-showcase-foundation-row">
              <span>Badges</span>
              <div className="agent-card-showcase-foundation-controls">
                <AgentCardBadge tone="neutral">Draft</AgentCardBadge>
                <AgentCardBadge tone="success">Saved</AgentCardBadge>
                <AgentCardBadge tone="info">Select</AgentCardBadge>
                <AgentCardBadge tone="warning">Partial</AgentCardBadge>
                <AgentCardBadge tone="danger">Failed</AgentCardBadge>
              </div>
            </div>

            <div className="agent-card-showcase-foundation-row">
              <span>Notice</span>
              <div className="agent-card-showcase-foundation-notices">
                <AgentCardNotice tone="neutral">This card writes only the reviewed fields.</AgentCardNotice>
                <AgentCardNotice tone="warning">No record changes until a candidate is selected.</AgentCardNotice>
              </div>
            </div>

            <div className="agent-card-showcase-foundation-row">
              <span>Text Block</span>
              <AgentCardTextBlock label="Reply draft" meta="Not sent">
                Salam Ahmed, the viewing slot is available tomorrow after 4pm.
              </AgentCardTextBlock>
            </div>

            <div className="agent-card-showcase-foundation-row">
              <span>Steps</span>
              <AgentStepList label="Workflow steps" steps={["Matched by phone", "Needs follow-up", "Reminder ready"]} />
            </div>

            <div className="agent-card-showcase-foundation-row">
              <span>Field Row</span>
              <div className="listing-update-list agent-card-showcase-foundation-fields">
                <div className="listing-update-row">
                  <span>Price</span>
                  <div>
                    <strong>PKR 4.2 Cr</strong>
                  </div>
                </div>
                <div className="listing-update-row">
                  <span>Location</span>
                  <div>
                    <strong>DHA Phase 6, Lahore</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="agent-card-showcase-foundation-panel">
          <h3>Design Tokens</h3>
          <div className="agent-card-showcase-token-groups">
            {foundationTokens.map((group) => (
              <section className="agent-card-showcase-token-group" key={group.group} aria-label={`${group.group} tokens`}>
                <h4>{group.group}</h4>
                <dl>
                  {group.tokens.map((token) => (
                    <div key={token.name}>
                      <dt>
                        <code>{token.name}</code>
                        <span>{token.usage}</span>
                      </dt>
                      <dd>{token.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ListingDraftCard() {
  return (
    <ListingDraftAgentCard
      actions={
        <>
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm & save
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
            Edit fields
          </AgentCardButton>
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
      mediaItems={[
        { id: "living", label: "living", mediaType: "placeholder" },
        { id: "kitchen", label: "kitchen", mediaType: "placeholder" },
        { id: "balcony", label: "balcony", mediaType: "placeholder" },
        { id: "bedroom", label: "bedroom", mediaType: "placeholder" },
        { id: "bath", label: "bath", mediaType: "placeholder" },
        { id: "parking", label: "parking", mediaType: "placeholder" }
      ]}
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
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm update
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
            Edit fields
          </AgentCardButton>
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

function ListingSelectionCard() {
  return (
    <AgentOutputCard
      actions={
        <AgentCardButton kind="secondary">
          Continue without selecting
        </AgentCardButton>
      }
      className="listing-update-card"
      domain="Listing · Select"
      icon={<Home size={16} />}
      intent="select"
      summary="I found multiple matching listings. Choose the exact property before I update anything."
      title="Choose listing to update"
      tone="listing"
    >
      <AgentCandidateList
        label="Matching listings"
        items={[
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="primary">
                Select
              </AgentCardButton>
            ),
            description: "8 marla · 5, Lahore",
            key: "10-marla",
            meta: "PKR 3.2 Crore · 4 beds / 5 baths · draft",
            title: "10 marla House"
          },
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="secondary">
                Select
              </AgentCardButton>
            ),
            description: "DHA, Lahore",
            key: "dha-apartment",
            meta: "PKR 1,000,000 · 3 beds / - baths · draft",
            title: "3-Bedroom Apartment in DHA"
          },
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="secondary">
                Select
              </AgentCardButton>
            ),
            description: "DHA Phase 5, Lahore",
            key: "phase-5",
            meta: "PKR 1.5 Crore · 3 beds / - baths · draft",
            title: "5 Marla House in DHA Phase 5"
          }
        ]}
      />
      <AgentCardNotice tone="warning">
        No listing will be changed until one candidate is selected.
      </AgentCardNotice>
    </AgentOutputCard>
  );
}

function ListingSavedCard() {
  return (
    <AgentOutputCard
      actions={
        <>
          <AgentCardButton icon={<Home size={14} />} kind="primary">
            Open listing
          </AgentCardButton>
          <AgentCardButton icon={<Sparkles size={14} />} kind="secondary">
            Promote
          </AgentCardButton>
          <AgentCardButton icon={<MessageCircle size={14} />} kind="secondary">
            Ask agent
          </AgentCardButton>
        </>
      }
      className="listing-saved-card"
      domain="Listing"
      icon={<CheckCircle2 size={16} />}
      intent="saved"
      summary="3 media files saved"
      title="Listing saved"
      tone="listing"
    >
      <div className="listing-saved-summary">
        <div>
          <strong>2 BHK Apartment · DHA Phase 6</strong>
          <span>DHA Phase 6, Lahore · PKR 4.2 Cr</span>
        </div>
        <div className="listing-saved-media" aria-label="Saved listing media">
          <div className="listing-saved-thumbs">
            <span className="listing-saved-thumb" />
            <span className="listing-saved-thumb" />
            <span className="listing-saved-thumb" />
          </div>
          <span>3 media files</span>
        </div>
      </div>
    </AgentOutputCard>
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
          <AgentCardButton icon={<Sparkles size={15} />} kind="primary">
            Generate pack
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
            Change channels
          </AgentCardButton>
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
                <AgentCardButton ariaLabel="Copy draft" icon={<Copy size={14} />} iconOnly kind="secondary" title="Copy draft">
                  Copy draft
                </AgentCardButton>
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
              actions: (
                <AgentCardButton ariaLabel="Copied" icon={<Check size={14} />} iconOnly kind="success" title="Copied">
                  Copied
                </AgentCardButton>
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
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm save
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
            Edit fields
          </AgentCardButton>
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
        <AgentCardButton kind="secondary">
          View all 18 in Leads
        </AgentCardButton>
      }
      items={[
        {
          action: (
            <AgentCardButton ariaLabel="Open Ahmed Raza" icon={<ChevronRight size={15} />} kind="secondary">
              Open
            </AgentCardButton>
          ),
          badge: <AgentCardBadge tone="danger">Hot</AgentCardBadge>,
          key: "ahmed",
          meta: "DHA Phase 6 · 2h ago",
          summary: "2BHK under PKR 4.5 Cr",
          title: "Ahmed Raza"
        },
        {
          action: (
            <AgentCardButton ariaLabel="Open Sara Khan" icon={<ChevronRight size={15} />} kind="secondary">
              Open
            </AgentCardButton>
          ),
          badge: <AgentCardBadge tone="warning">Warm</AgentCardBadge>,
          key: "sara",
          meta: "Bahria Town · 1d ago",
          summary: "Viewing this week",
          title: "Sara Khan"
        },
        {
          action: (
            <AgentCardButton ariaLabel="Open Bilal Ahmed" icon={<ChevronRight size={15} />} kind="secondary">
              Open
            </AgentCardButton>
          ),
          badge: <AgentCardBadge tone="neutral">New</AgentCardBadge>,
          key: "bilal",
          meta: "No listing yet · 3d ago",
          summary: "Investor, 3-4 units",
          title: "Bilal Ahmed"
        }
      ]}
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
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm update
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
            Edit fields
          </AgentCardButton>
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
        badge: <AgentCardBadge tone="info">Contacted</AgentCardBadge>,
        initials: "AR",
        meta: "Lead profile changes pending confirmation",
        title: "Ahmed Raza"
      }}
      title="Update Ahmed Raza"
    />
  );
}

function LeadSelectionCard() {
  return (
    <AgentOutputCard
      actions={<AgentCardButton kind="secondary">Create a new lead instead</AgentCardButton>}
      className="lead-chat-card"
      domain="Lead · Select"
      icon={<UserRound size={16} />}
      intent="select"
      summary="I found 4 possible leads. Select the right record before linking it to a listing."
      title="Choose lead"
      tone="lead"
    >
      <AgentCandidateList
        label="Matching leads"
        items={[
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="primary">
                Select
              </AgentCardButton>
            ),
            badge: <AgentCardBadge tone="neutral">New</AgentCardBadge>,
            description: "NEW MODERN DESIGN HOUSE FOR SALE IN DHA PHASE 8 EX AIR AVENUE, DHA Phase 8, Lahore",
            key: "belinda-1",
            meta: "+9818511832222 · belinda.ma8893@gmail.com",
            title: "belinda ma"
          },
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="secondary">
                Select
              </AgentCardButton>
            ),
            badge: <AgentCardBadge tone="neutral">New</AgentCardBadge>,
            description: "Listing not set",
            key: "belinda-2",
            meta: "030013001123 · belinda.ma8893@gmail.com",
            title: "belinda ma"
          },
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="secondary">
                Select
              </AgentCardButton>
            ),
            badge: <AgentCardBadge tone="info">Contacted</AgentCardBadge>,
            description: "Villa in DHA Phase 5, DHA Phase 5, Lahore",
            key: "belinda-3",
            meta: "185111119999 · belinda.ma8893@gmail.com",
            title: "belinda ma"
          }
        ]}
      />
      <AgentCardNotice tone="warning">
        No CRM record will be shown or changed until one candidate is selected.
      </AgentCardNotice>
    </AgentOutputCard>
  );
}

function LeadBatchUpdateCard() {
  return (
    <AgentOutputCard
      actions={
        <>
          <AgentCardButton icon={<CheckCircle2 size={14} />} kind="primary">
            Confirm 3 updates
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={14} />} kind="secondary">
            Edit selection
          </AgentCardButton>
        </>
      }
      className="lead-chat-card lead-update-card"
      domain="Lead · Batch update"
      icon={<UsersRound size={16} />}
      intent="confirm"
      summary="Apply the same status change to selected leads."
      title="Mark 3 leads as contacted"
      tone="lead"
    >
      <AgentCandidateList
        label="Leads to update"
        items={[
          {
            badge: <AgentCardBadge tone="neutral">New</AgentCardBadge>,
            description: "Primary listing · DHA Phase 6 Apt",
            key: "ahmed",
            meta: "Status will change from New to Contacted",
            title: "Ahmed Raza"
          },
          {
            badge: <AgentCardBadge tone="warning">Warm</AgentCardBadge>,
            description: "Primary listing · Bahria Town 10 Marla",
            key: "sara",
            meta: "Status will change from Warm to Contacted",
            title: "Sara Khan"
          },
          {
            badge: <AgentCardBadge tone="neutral">New</AgentCardBadge>,
            description: "Primary listing not set",
            key: "bilal",
            meta: "Status will change from New to Contacted",
            title: "Bilal Ahmed"
          }
        ]}
      />
      <AgentCardNotice>
        This batch writes only the status field. Notes, listing links, and reminders stay untouched.
      </AgentCardNotice>
    </AgentOutputCard>
  );
}

function LeadListingBindingCard() {
  return (
    <LeadUpdateAgentCard
      actions={
        <>
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm link
          </AgentCardButton>
          <AgentCardButton icon={<Search size={15} />} kind="secondary">
            Choose another listing
          </AgentCardButton>
        </>
      }
      changes={[
        { label: "Primary listing", previousValue: "Not set", value: "DHA Phase 6 Apt", highlight: true },
        { label: "Lead source", previousValue: "Manual", value: "WhatsApp campaign" },
        { label: "Next action", previousValue: "Not set", value: "Draft WhatsApp reply" }
      ]}
      hint="Linking the listing does not message the lead automatically."
      subtitle="+92 300 1234567 · possible DHA buyer"
      target={{
        badge: <AgentCardBadge tone="neutral">New</AgentCardBadge>,
        initials: "AR",
        meta: "Lead record needs one confirmed listing",
        title: "Ahmed Raza"
      }}
      title="Link lead to listing"
    />
  );
}

function WhatsAppImportSummaryCard() {
  return (
    <AgentOutputCard
      actions={
        <>
          <AgentCardButton icon={<CheckCircle2 size={14} />} kind="primary">
            Save summary
          </AgentCardButton>
          <AgentCardButton icon={<CalendarPlus size={14} />} kind="secondary">
            Set reminder
          </AgentCardButton>
        </>
      }
      className="lead-chat-card lead-followup-card"
      domain="Lead · WhatsApp"
      icon={<MessageCircle size={16} />}
      intent="confirm"
      summary="Imported chat matched to Ahmed Raza by phone number."
      title="Save WhatsApp follow-up"
      tone="lead"
    >
      <AgentInfoGrid
        fields={[
          { label: "Matched lead", value: "Ahmed Raza" },
          { label: "Need", value: "2BHK in DHA Phase 6" },
          { label: "Budget", value: "PKR 4.5 Cr" },
          { label: "Suggested status", previousValue: "New", value: "Hot" }
        ]}
      />
      <AgentCardTextBlock label="Follow-up record" meta="Today 4:20 PM">
        Ahmed asked for a DHA Phase 6 viewing this week and needs covered parking. He can visit after 4pm.
      </AgentCardTextBlock>
      <AgentCardNotice>
        The original chat text is not saved by default.
      </AgentCardNotice>
    </AgentOutputCard>
  );
}

function LeadReplyCard() {
  return (
    <LeadReplyAgentCard
      actions={
        <>
          <AgentCardButton ariaLabel="Copy reply" icon={<Copy size={15} />} iconOnly kind="secondary" title="Copy reply">
            Copy reply
          </AgentCardButton>
          <AgentCardButton icon={<ExternalLink size={15} />} kind="primary">
            Open WhatsApp
          </AgentCardButton>
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
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Save note
          </AgentCardButton>
          <AgentCardButton icon={<CalendarPlus size={15} />} kind="secondary">
            Set reminder
          </AgentCardButton>
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
          <AgentCardButton icon={<CheckCircle2 size={15} />} kind="primary">
            Confirm schedule
          </AgentCardButton>
          <AgentCardButton icon={<Clock3 size={15} />} kind="secondary">
            Edit time
          </AgentCardButton>
          <AgentCardButton icon={<Pencil size={15} />} kind="secondary">
            Edit details
          </AgentCardButton>
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
        <AgentCardButton kind="secondary">
          Open Schedule
        </AgentCardButton>
      }
    />
  );
}

function EntitySelectionCard() {
  return (
    <AgentOutputCard
      actions={<AgentCardButton kind="secondary">Continue without binding</AgentCardButton>}
      className="lead-chat-card"
      domain="Entity · Select"
      icon={<Search size={16} />}
      intent="select"
      summary="Several Ahmed records matched this request. Choose one entity before continuing."
      title="Choose a lead to continue"
      tone="lead"
    >
      <AgentCandidateList
        label="Matching entities"
        items={[
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="primary">
                Select
              </AgentCardButton>
            ),
            badge: <AgentCardBadge tone="info">Phone match</AgentCardBadge>,
            description: "DHA Phase 6 · Hot lead",
            key: "ahmed-raza",
            meta: "+92 300 1234567",
            title: "Ahmed Raza"
          },
          {
            action: (
              <AgentCardButton icon={<CheckCircle2 size={14} />} kind="secondary">
                Select
              </AgentCardButton>
            ),
            badge: <AgentCardBadge tone="neutral">Name match</AgentCardBadge>,
            description: "Gulberg · New lead",
            key: "ahmed-rafique",
            meta: "No phone on record",
            title: "Ahmed Rafique"
          }
        ]}
      />
      <AgentCardNotice tone="warning">
        No records will be shown or changed until one candidate is selected.
      </AgentCardNotice>
    </AgentOutputCard>
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
          <AgentCardButton icon={<BarChart3 size={15} />} kind="primary">
            Open analytics
          </AgentCardButton>
          <AgentCardButton icon={<MessageCircle size={15} />} kind="secondary">
            Ask why
          </AgentCardButton>
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
          <AgentCardButton icon={<Plus size={15} />} kind="warning">
            Retry media
          </AgentCardButton>
          <AgentCardButton icon={<ExternalLink size={15} />} kind="secondary">
            Open listing
          </AgentCardButton>
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
      { id: "listing-update", label: "listing_update", render: ListingUpdateCard },
      { id: "listing-selection", label: "listing_selection", render: ListingSelectionCard },
      { id: "listing-saved", label: "listing_saved", render: ListingSavedCard }
    ]
  },
  {
    id: "lead",
    title: "Lead Cards",
    description: "Create, list, update, reply, and follow-up workflows.",
    cards: [
      { id: "lead-create", label: "lead_create", render: LeadCreateCard },
      { id: "lead-list", label: "lead_list", render: LeadListCard },
      { id: "lead-selection", label: "lead_selection", render: LeadSelectionCard },
      { id: "lead-update", label: "lead_update", render: LeadUpdateCard },
      { id: "lead-batch-update", label: "lead_batch_update", render: LeadBatchUpdateCard },
      { id: "lead-listing-binding", label: "lead_listing_binding", render: LeadListingBindingCard },
      { id: "lead-reply", label: "lead_reply", render: LeadReplyCard },
      { id: "lead-followup", label: "lead_followup", render: LeadFollowupCard },
      { id: "whatsapp-import-summary", label: "whatsapp_import_summary", render: WhatsAppImportSummaryCard }
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

      <FoundationBlock />

      <section className="agent-card-showcase-section" aria-labelledby="desktop-title">
        <div className="agent-card-showcase-section-heading">
          <span>2</span>
          <div>
            <h2 id="desktop-title">Desktop Catalog</h2>
            <p>All card families at workspace width, grouped by workflow domain.</p>
          </div>
        </div>
        <CatalogBlock mode="desktop" />
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="mobile-title">
        <div className="agent-card-showcase-section-heading">
          <span>3</span>
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
