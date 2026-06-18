import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type SystemStatusCardProps = {
  actions?: ReactNode;
  fields: AgentFieldItem[];
  hint?: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
  title: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function SystemStatusCard({
  actions,
  fields,
  hint,
  status,
  subtitle,
  title
}: SystemStatusCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="system-status-agent-card"
      domain="System"
      icon={<AlertTriangle size={16} />}
      intent="partial"
      status={status}
      summary={subtitle}
      title={title}
      tone="default"
    >
      <AgentFieldList fields={fields} />
      {hasRenderableValue(hint) ? (
        <div className="agent-card-inline-hint warning">
          <span aria-hidden="true" />
          {hint}
        </div>
      ) : null}
    </AgentOutputCard>
  );
}
