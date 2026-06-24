import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Home,
  Megaphone,
  MessageCircle,
  Sparkles,
  X
} from "lucide-react";

type SkillTone = "listing" | "promotion" | "lead" | "schedule";

type AgentSkillPreview = {
  id: string;
  name: string;
  shortName: string;
  tone: SkillTone;
  icon: LucideIcon;
  actionTitle: string;
  description: string;
  outcome: string;
  starter: string;
  steps: string[];
};

const skills: AgentSkillPreview[] = [
  {
    id: "listing-builder",
    name: "Listing Builder Skill",
    shortName: "Listing Builder",
    tone: "listing",
    icon: Home,
    actionTitle: "Create a listing",
    description: "Turn photos, links, voice notes, or messy property details into a clean listing draft.",
    outcome: "Details become a draft card ready to review.",
    starter: "Start with property details, photos, a link, or a voice note.",
    steps: ["Read source material", "Extract listing fields", "Show draft card", "Confirm save"]
  },
  {
    id: "promotion",
    name: "Promotion Skill",
    shortName: "Promotion",
    tone: "promotion",
    icon: Megaphone,
    actionTitle: "Promote a listing",
    description: "Create WhatsApp, Facebook, and Instagram content from one selected listing.",
    outcome: "A promotion pack appears in chat before links are confirmed.",
    starter: "Start with a listing, then choose WhatsApp, Facebook, Instagram, or all.",
    steps: ["Resolve listing", "Choose channels", "Preview copy", "Confirm links"]
  },
  {
    id: "lead-follow-up",
    name: "Lead Follow-up Skill",
    shortName: "Lead Follow-up",
    tone: "lead",
    icon: MessageCircle,
    actionTitle: "Follow up leads",
    description: "Read customer context, draft replies, and suggest the next action.",
    outcome: "Replies and lead updates stay reviewable before anything is saved.",
    starter: "Start with a lead, WhatsApp chat, or today’s follow-up list.",
    steps: ["Resolve lead", "Summarize intent", "Draft reply", "Confirm next action"]
  },
  {
    id: "schedule",
    name: "Schedule Skill",
    shortName: "Schedule",
    tone: "schedule",
    icon: CalendarClock,
    actionTitle: "Schedule next steps",
    description: "Create viewings, follow-ups, signing reminders, and broker tasks.",
    outcome: "A schedule preview is shown before it is added.",
    starter: "Start with a lead, listing, time, and what needs to happen.",
    steps: ["Parse task", "Resolve context", "Preview schedule", "Confirm save"]
  }
];

function SkillCard({ skill }: { skill: AgentSkillPreview }) {
  const Icon = skill.icon;

  return (
    <article className={`agent-skill-card ${skill.tone}`} aria-label={skill.name} tabIndex={0}>
      <div className="agent-skill-visual" aria-hidden="true">
        <span className="agent-skill-visual-icon">
          <Icon size={34} />
        </span>
        <div className="agent-skill-visual-scene">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="agent-skill-card-title">
        <span>{skill.name}</span>
        <h3>{skill.actionTitle}</h3>
        <p>{skill.description}</p>
      </div>

      <p className="agent-skill-outcome">{skill.outcome}</p>

      <footer className="agent-skill-card-footer">
        <span>Guided chat skill</span>
        <strong>
          Start in chat
          <ArrowRight size={14} aria-hidden="true" />
        </strong>
      </footer>
    </article>
  );
}

function HomeSkillCard({ skill }: { skill: AgentSkillPreview }) {
  const Icon = skill.icon;
  const compactCopy: Record<AgentSkillPreview["id"], string> = {
    "listing-builder": "Turn property details into a draft.",
    promotion: "Create channel-ready promotion content.",
    "lead-follow-up": "Draft replies and choose next steps.",
    schedule: "Create viewing and follow-up reminders."
  };

  return (
    <article className={`agent-home-skill-card ${skill.tone}`} aria-label={skill.name} tabIndex={0}>
      <span className="agent-home-skill-icon" aria-hidden="true">
        <Icon size={21} />
      </span>
      <div>
        <span>{skill.name}</span>
        <h3>{skill.actionTitle}</h3>
        <p>{compactCopy[skill.id]}</p>
      </div>
      <strong>
        Start
        <ArrowRight size={13} aria-hidden="true" />
      </strong>
    </article>
  );
}

function AgentHomeCompactPreview() {
  return (
    <div className="agent-home-skill-preview" aria-label="Agent empty home compact skills preview">
      <div className="agent-home-skill-hero">
        <h2>What should we handle today?</h2>
        <p>Built for Pakistan&apos;s Property Agents</p>
      </div>

      <div className="agent-home-composer-mock">
        <span>Ask Pislaka Agent, or choose a skill...</span>
        <button aria-label="Send message" type="button">
          <ArrowRight size={17} />
        </button>
      </div>

      <div className="agent-home-skill-heading">
        <span>Recommended Agent Skills</span>
        <p>Start with a guided skill, or type freely above.</p>
      </div>

      <div className="agent-home-skill-grid">
        {skills.map((skill) => (
          <HomeSkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
}

function SkillLauncherPreview() {
  return (
    <div className="agent-skill-launcher-preview" aria-label="Compact skill launcher preview">
      <div className="agent-skill-launcher-bar">
        {skills.map((skill) => {
          const Icon = skill.icon;

          return (
            <button className={`agent-skill-chip ${skill.tone}`} key={skill.id} type="button">
              <Icon size={15} aria-hidden="true" />
              <span>{skill.shortName}</span>
            </button>
          );
        })}
      </div>
      <div className="agent-skill-composer-mock">
        <button aria-label="Add attachment" type="button">
          +
        </button>
        <span>Ask Pislaka Agent, or choose a skill...</span>
        <button aria-label="Send message" type="button">
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ActiveSkillPreview() {
  return (
    <div className="agent-skill-active-preview" aria-label="Active skill chat state preview">
      <div className="agent-skill-active-topline">
        <span className="agent-skill-active-chip">
          <Megaphone size={15} aria-hidden="true" />
          Running: Promotion Skill
        </span>
        <button aria-label="Clear active skill" type="button">
          <X size={14} />
        </button>
      </div>

      <article className="agent-skill-chat-message">
        <span aria-hidden="true">
          <Sparkles size={16} />
        </span>
        <div>
          <strong>Promotion Skill started.</strong>
          <p>Choose a listing and I’ll create promotion content for WhatsApp, Facebook, and Instagram.</p>
        </div>
      </article>

      <div className="agent-skill-progress-card">
        <header>
          <ClipboardCheck size={16} aria-hidden="true" />
          <strong>Skill flow</strong>
        </header>
        <ol>
          <li className="done">
            <CheckCircle2 size={14} aria-hidden="true" />
            Listing selected
          </li>
          <li className="active">
            <span aria-hidden="true" />
            Choose channels
          </li>
          <li>
            <span aria-hidden="true" />
            Preview promotion copy
          </li>
          <li>
            <span aria-hidden="true" />
            Confirm tracking links
          </li>
        </ol>
      </div>
    </div>
  );
}

export default function AgentSkillsPreviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_AGENT_CARD_SHOWCASE !== "true") {
    return (
      <main className="agent-card-showcase-disabled">
        <h1>Agent skills preview</h1>
        <p>This internal page is disabled in production.</p>
      </main>
    );
  }

  return (
    <main className="agent-card-showcase agent-skills-showcase">
      <header className="agent-card-showcase-hero">
        <div>
          <span className="agent-card-showcase-kicker">
            <span aria-hidden="true" />
            Pislaka Agent · skills preview
          </span>
          <h1>Agent Skills</h1>
          <p>
            Preview for the recommended Skills entry point. Skills guide the conversation, while open chat remains
            available as the default power mode.
          </p>
        </div>
      </header>

      <section className="agent-card-showcase-rule-panel" aria-labelledby="skills-rules-title">
        <h2 id="skills-rules-title">Rules</h2>
        <div>
          <p>Skills launch guided chat flows, not separate tools.</p>
          <p>Open text input stays available before, during, and after a Skill.</p>
          <p>Channels stay parameters inside Promotion and Follow-up flows.</p>
          <p>Writes, schedule saves, external opens, and campaign links still require confirmation.</p>
        </div>
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="recommended-skills-title">
        <div className="agent-card-showcase-section-heading">
          <span>1</span>
          <div>
            <h2 id="recommended-skills-title">Empty Chat Recommended Skills</h2>
            <p>Functional guide cards for the empty Agent state. The card launches chat; the workflow appears after selection.</p>
          </div>
        </div>
        <div className="agent-skills-grid">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="launcher-title">
        <div className="agent-card-showcase-section-heading">
          <span>2</span>
          <div>
            <h2 id="launcher-title">Agent Home Compact</h2>
            <p>Smaller visual skill cards placed below the open chat composer on the real empty Agent page.</p>
          </div>
        </div>
        <AgentHomeCompactPreview />
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="compact-launcher-title">
        <div className="agent-card-showcase-section-heading">
          <span>3</span>
          <div>
            <h2 id="compact-launcher-title">Compact Launcher</h2>
            <p>Small Skill chips can sit near the composer without replacing normal chat.</p>
          </div>
        </div>
        <SkillLauncherPreview />
      </section>

      <section className="agent-card-showcase-section" aria-labelledby="active-title">
        <div className="agent-card-showcase-section-heading">
          <span>4</span>
          <div>
            <h2 id="active-title">Active Skill State</h2>
            <p>Once a Skill starts, the conversation carries a visible workflow state and can still accept free text.</p>
          </div>
        </div>
        <ActiveSkillPreview />
      </section>
    </main>
  );
}
