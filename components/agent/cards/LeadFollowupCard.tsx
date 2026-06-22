import type { ReactNode } from "react";
import { ListChecks } from "lucide-react";
import {
  AgentCardNotice,
  AgentCardTextBlock,
  AgentFieldList,
  AgentStepList,
  type AgentFieldItem
} from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type LeadFollowupTarget = {
  badge?: ReactNode;
  initials?: string;
  meta?: ReactNode;
  title: ReactNode;
};

export type LeadFollowupRecord = {
  body: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
};

export type LeadFollowupCardProps = {
  actions?: ReactNode;
  children?: ReactNode;
  fields?: AgentFieldItem[];
  hint?: ReactNode;
  record: LeadFollowupRecord;
  status?: ReactNode;
  steps?: ReactNode[];
  subtitle?: ReactNode;
  target: LeadFollowupTarget;
  title: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

function getFallbackInitials(title: ReactNode) {
  const text = typeof title === "string" ? title : "";
  const initials = (text.match(/[A-Za-z0-9]+/g) ?? [])
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (initials || "L").toUpperCase();
}

export function LeadFollowupCard({
  actions,
  children,
  fields = [],
  hint,
  record,
  status,
  steps = [],
  subtitle,
  target,
  title
}: LeadFollowupCardProps) {
  const initials = target.initials ?? getFallbackInitials(target.title);

  return (
    <AgentOutputCard
      actions={actions}
      className="lead-chat-card lead-followup-card"
      domain="Lead · Follow-up"
      icon={<ListChecks size={16} />}
      intent="confirm"
      status={status}
      summary={subtitle}
      title={title}
      tone="lead"
    >
      <div className="agent-object-summary-row">
        <span className="agent-object-summary-initials">{initials}</span>
        <div>
          <div className="agent-object-summary-title-row">
            <strong>{target.title}</strong>
            {target.badge}
          </div>
          {hasRenderableValue(target.meta) ? <p>{target.meta}</p> : null}
        </div>
      </div>
      <AgentStepList label="Follow-up steps" steps={steps} />
      <AgentCardTextBlock label={record.label} meta={record.meta}>
        {record.body}
      </AgentCardTextBlock>
      {children}
      <AgentFieldList fields={fields} />
      {hasRenderableValue(hint) ? <AgentCardNotice>{hint}</AgentCardNotice> : null}
    </AgentOutputCard>
  );
}
