"use client";

import type { ReactNode } from "react";

type AgentOutputCardTone = "default" | "lead" | "listing" | "schedule" | "promotion";
type AgentOutputCardIntent = "draft" | "read" | "confirm" | "external" | "select" | "partial" | "saved";

type AgentOutputCardProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  domain?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  intent?: AgentOutputCardIntent;
  status?: ReactNode;
  summary?: ReactNode;
  title: string;
  tone?: AgentOutputCardTone;
};

const toneDomain: Record<AgentOutputCardTone, string> = {
  default: "Agent",
  lead: "Lead",
  listing: "Listing",
  promotion: "Promotion",
  schedule: "Schedule"
};

const intentCopy: Record<AgentOutputCardIntent, string> = {
  confirm: "Confirm",
  draft: "Draft",
  external: "External",
  partial: "Partial",
  read: "Read",
  saved: "Saved",
  select: "Select"
};

export function AgentOutputCard({
  actions,
  children,
  className = "",
  domain,
  hint,
  icon,
  intent = "read",
  status,
  summary,
  title,
  tone = "default"
}: AgentOutputCardProps) {
  const domainLabel = domain ?? toneDomain[tone];

  return (
    <section aria-label={title} className={`agent-output-card ${tone} ${className}`.trim()}>
      <header className="agent-output-card-header">
        <div className="agent-output-card-meta">
          {icon ? (
            <span className="agent-output-card-icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span>{domainLabel}</span>
        </div>
        <span className={`agent-output-card-badge ${intent}`}>
          <span aria-hidden="true" />
          {intentCopy[intent]}
        </span>
      </header>
      <div className="agent-output-card-title">
        <h3>{title}</h3>
        {summary ? <p>{summary}</p> : null}
      </div>
      {hint ? <p className="agent-output-card-hint">{hint}</p> : null}
      {children ? <div className="agent-output-card-body">{children}</div> : null}
      {actions ? <div className="agent-output-card-actions card-actions">{actions}</div> : null}
      {status ? (
        <div className="agent-output-card-status agent-draft-status">
          <p>{status}</p>
        </div>
      ) : null}
    </section>
  );
}
