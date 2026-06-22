import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";
import { AgentCandidateList, AgentCardNotice } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type LeadListItemCard = {
  action?: ReactNode;
  badge?: ReactNode;
  context?: ReactNode;
  description?: ReactNode;
  details?: Array<{
    label: ReactNode;
    value: ReactNode;
  }>;
  initials?: string;
  key: string;
  meta?: ReactNode;
  pills?: ReactNode[];
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

function renderDetailMeta(details?: LeadListItemCard["details"]) {
  const visibleDetails = details?.filter((detail) => hasRenderableValue(detail.value)) ?? [];

  if (!visibleDetails.length) {
    return null;
  }

  return visibleDetails.map((detail, index) => (
    <span key={index}>
      {index > 0 ? " · " : null}
      {detail.value}
    </span>
  ));
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
          <AgentCardNotice tone="success">
            {recommendation.eyebrow}: {recommendation.title}
            {hasRenderableValue(recommendation.meta) ? <> · {recommendation.meta}</> : null}
          </AgentCardNotice>
          {recommendation.action ? <div className="agent-lead-recommendation-action">{recommendation.action}</div> : null}
        </div>
      ) : null}
      {items.length ? (
        <AgentCandidateList
          className="lead-list-candidate-list"
          label="Leads"
          items={items.map((item) => ({
            action: item.action,
            badge: item.badge,
            description: item.description ?? item.summary ?? item.context,
            key: item.key,
            meta: item.meta ?? renderDetailMeta(item.details),
            title: item.title
          }))}
        />
      ) : (
        <p className="agent-draft-status">{emptyText}</p>
      )}
    </AgentOutputCard>
  );
}
