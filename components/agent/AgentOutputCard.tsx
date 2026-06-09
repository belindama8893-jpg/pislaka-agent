"use client";

import type { ReactNode } from "react";

type AgentOutputCardTone = "default" | "lead" | "listing" | "schedule" | "promotion";

type AgentOutputCardProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  status?: ReactNode;
  summary?: ReactNode;
  title: string;
  tone?: AgentOutputCardTone;
};

export function AgentOutputCard({
  actions,
  children,
  className = "",
  hint,
  icon,
  status,
  summary,
  title,
  tone = "default"
}: AgentOutputCardProps) {
  return (
    <section aria-label={title} className={`agent-output-card ${tone} ${className}`.trim()}>
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
