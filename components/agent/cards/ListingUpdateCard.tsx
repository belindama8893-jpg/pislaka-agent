import type { ReactNode } from "react";
import { ArrowRight, House } from "lucide-react";
import { AgentCardNotice } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type ListingUpdateChangeItem = {
  hidden?: boolean;
  highlight?: boolean;
  label: ReactNode;
  previousValue?: ReactNode;
  value: ReactNode;
};

export type ListingUpdateTarget = {
  initials?: string;
  meta?: ReactNode;
  title: ReactNode;
};

export type ListingUpdateCardProps = {
  actions?: ReactNode;
  changes: ListingUpdateChangeItem[];
  editForm?: ReactNode;
  hint?: ReactNode;
  isEditing?: boolean;
  status?: ReactNode;
  subtitle: ReactNode;
  target: ListingUpdateTarget;
  title?: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

function getFallbackInitials(title: ReactNode) {
  const text = typeof title === "string" ? title : "";
  const digit = text.match(/\d/);
  const words = text.match(/[A-Za-z]+/g) ?? [];

  if (words[0] && digit) {
    return `${words[0][0]}${digit[0]}`.toUpperCase();
  }

  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (initials || "L").toUpperCase();
}

export function ListingUpdateCard({
  actions,
  changes,
  editForm,
  hint,
  isEditing = false,
  status,
  subtitle,
  target,
  title = "Update listing facts"
}: ListingUpdateCardProps) {
  const visibleChanges = changes.filter((change) => !change.hidden && hasRenderableValue(change.value));
  const initials = target.initials ?? getFallbackInitials(target.title);

  return (
    <AgentOutputCard
      actions={actions}
      className="listing-update-card"
      domain="Listing · Update"
      icon={<House size={16} />}
      intent="confirm"
      status={status}
      summary={subtitle}
      title={title}
      tone="listing"
    >
      <div className="agent-object-summary-row">
        <span className="agent-object-summary-initials">{initials}</span>
        <div>
          <strong>{target.title}</strong>
          {hasRenderableValue(target.meta) ? <p>{target.meta}</p> : null}
        </div>
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
          {hasRenderableValue(hint) ? <AgentCardNotice>{hint}</AgentCardNotice> : null}
        </>
      )}
    </AgentOutputCard>
  );
}
