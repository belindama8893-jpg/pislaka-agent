import type { ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { AgentCardNotice, AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type LeadCreateTarget = {
  initials?: string;
  meta?: ReactNode;
  title: ReactNode;
};

export type LeadCreateCardProps = {
  actions?: ReactNode;
  editForm?: ReactNode;
  fields: AgentFieldItem[];
  followUp?: ReactNode;
  followUpLabel?: ReactNode;
  hint?: ReactNode;
  isEditing?: boolean;
  status?: ReactNode;
  subtitle: ReactNode;
  target: LeadCreateTarget;
  title?: string;
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

export function LeadCreateCard({
  actions,
  editForm,
  fields,
  followUp,
  followUpLabel = "Follow-up",
  hint,
  isEditing = false,
  status,
  subtitle,
  target,
  title = "Save new lead"
}: LeadCreateCardProps) {
  const initials = target.initials ?? getFallbackInitials(target.title);

  return (
    <AgentOutputCard
      actions={actions}
      className="lead-chat-card lead-create-card"
      domain="Lead · Create"
      icon={<UserPlus size={16} />}
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
      </div>
      {isEditing ? editForm : <AgentFieldList fields={fields} />}
      {hasRenderableValue(followUp) ? <AgentFieldList compact fields={[{ label: followUpLabel, value: followUp }]} /> : null}
      {!isEditing && hasRenderableValue(hint) ? <AgentCardNotice>{hint}</AgentCardNotice> : null}
    </AgentOutputCard>
  );
}
