import type { ReactNode } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type LeadUpdateChangeItem = {
  hidden?: boolean;
  highlight?: boolean;
  label: ReactNode;
  previousValue?: ReactNode;
  value: ReactNode;
};

export type LeadUpdateTarget = {
  badge?: ReactNode;
  initials?: string;
  meta?: ReactNode;
  title: ReactNode;
};

export type LeadUpdateCardProps = {
  actions?: ReactNode;
  changes: LeadUpdateChangeItem[];
  editForm?: ReactNode;
  hint?: ReactNode;
  isEditing?: boolean;
  status?: ReactNode;
  subtitle?: ReactNode;
  target: LeadUpdateTarget;
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

export function LeadUpdateCard({
  actions,
  changes,
  editForm,
  hint,
  isEditing = false,
  status,
  subtitle,
  target,
  title
}: LeadUpdateCardProps) {
  const visibleChanges = changes.filter((change) => !change.hidden && hasRenderableValue(change.value));
  const initials = target.initials ?? getFallbackInitials(target.title);

  return (
    <AgentOutputCard
      actions={actions}
      className="lead-chat-card lead-update-card"
      domain="Lead · Update"
      icon={<UserRound size={16} />}
      intent="confirm"
      status={status}
      summary={subtitle}
      title={title}
      tone="lead"
    >
      <div className="agent-object-summary-row">
        <span className="agent-object-summary-initials">{initials}</span>
        <div>
          <strong>{target.title}</strong>
          {hasRenderableValue(target.meta) ? <p>{target.meta}</p> : null}
        </div>
        {target.badge ? <div className="agent-object-summary-badge">{target.badge}</div> : null}
      </div>
      {isEditing ? (
        editForm
      ) : (
        <>
          {visibleChanges.length ? (
            <div className="listing-update-list">
              {visibleChanges.map((change, index) => (
                <div className={`listing-update-row listing-change-row ${change.highlight ? "highlight" : ""}`.trim()} key={index}>
                  <span>{change.label}</span>
                  <div className="listing-change-value">
                    {hasRenderableValue(change.previousValue) ? <small>{change.previousValue}</small> : null}
                    {hasRenderableValue(change.previousValue) ? <ArrowRight size={13} aria-hidden="true" /> : null}
                    <strong>{change.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {hasRenderableValue(hint) ? (
            <div className="agent-card-inline-hint">
              <span aria-hidden="true" />
              {hint}
            </div>
          ) : null}
        </>
      )}
    </AgentOutputCard>
  );
}
