import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type LeadListItemCard = {
  action?: ReactNode;
  badge?: ReactNode;
  details?: Array<{
    label: ReactNode;
    value: ReactNode;
  }>;
  initials?: string;
  key: string;
  meta?: ReactNode;
  summary?: ReactNode;
  title: ReactNode;
};

export type LeadListRecommendation = {
  action?: ReactNode;
  eyebrow: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
};

export type LeadListCardProps = {
  footer?: ReactNode;
  intent?: "read" | "select";
  items: LeadListItemCard[];
  recommendation?: LeadListRecommendation;
  subtitle: ReactNode;
  title: string;
  emptyText?: ReactNode;
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

export function LeadListCard({
  emptyText,
  footer,
  intent = "read",
  items,
  recommendation,
  subtitle,
  title
}: LeadListCardProps) {
  return (
    <AgentOutputCard
      actions={footer}
      className="lead-chat-card lead-list-card"
      domain="Lead"
      icon={<UsersRound size={16} />}
      intent={intent}
      summary={subtitle}
      title={title}
      tone="lead"
    >
      {recommendation ? (
        <div className="agent-lead-recommendation">
          <div>
            <small>{recommendation.eyebrow}</small>
            <strong>{recommendation.title}</strong>
            {hasRenderableValue(recommendation.meta) ? <span>{recommendation.meta}</span> : null}
          </div>
          {recommendation.action}
        </div>
      ) : null}
      {items.length ? (
        <div className="lead-chat-list">
          {items.map((item) => (
            <div className="lead-chat-row" key={item.key}>
              <span className="agent-lead-avatar">{item.initials ?? getFallbackInitials(item.title)}</span>
              <div>
                <div className="lead-chat-row-title">
                  <strong>{item.title}</strong>
                  {item.badge}
                </div>
                {hasRenderableValue(item.summary) ? <p>{item.summary}</p> : null}
                {item.details?.length ? (
                  <div className="lead-chat-detail-list">
                    {item.details.map((detail, index) => (
                      <p key={index}>
                        <span>{detail.label}</span>
                        {detail.value}
                      </p>
                    ))}
                  </div>
                ) : null}
                {hasRenderableValue(item.meta) ? <small>{item.meta}</small> : null}
              </div>
              {item.action ? <div className="lead-chat-row-action">{item.action}</div> : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="agent-draft-status">{emptyText}</p>
      )}
    </AgentOutputCard>
  );
}
