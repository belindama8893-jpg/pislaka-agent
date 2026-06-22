import type { ReactNode } from "react";
import { Megaphone } from "lucide-react";
import { AgentCardNotice, AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type PromotionTargetChannel = {
  checked: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  id: string;
  label: ReactNode;
  onToggle?: () => void;
};

export type PromotionTargetCardProps = {
  actions?: ReactNode;
  channels: PromotionTargetChannel[];
  fields: AgentFieldItem[];
  hint?: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
  targetMeta?: ReactNode;
  targetTitle: ReactNode;
  title: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function PromotionTargetCard({
  actions,
  channels,
  fields,
  hint,
  status,
  subtitle,
  targetMeta,
  targetTitle,
  title
}: PromotionTargetCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="promotion-card-shell promotion-target-agent-card"
      domain="Promotion"
      icon={<Megaphone size={16} />}
      intent="confirm"
      status={status}
      summary={subtitle}
      title={title}
      tone="promotion"
    >
      <div className="agent-object-summary-row">
        <span className="agent-object-summary-initials">AD</span>
        <div>
          <strong>{targetTitle}</strong>
          {hasRenderableValue(targetMeta) ? <p>{targetMeta}</p> : null}
        </div>
      </div>
      <AgentFieldList fields={fields} />
      <div className="promotion-channel-selector" aria-label="Promotion channels">
        {channels.map((channel) => (
          <label className={channel.checked ? "selected" : ""} key={channel.id}>
            <input
              checked={channel.checked}
              disabled={channel.disabled}
              onChange={channel.onToggle}
              readOnly={!channel.onToggle}
              type="checkbox"
            />
            {channel.icon}
            <span>{channel.label}</span>
          </label>
        ))}
      </div>
      {hasRenderableValue(hint) ? <AgentCardNotice>{hint}</AgentCardNotice> : null}
    </AgentOutputCard>
  );
}
