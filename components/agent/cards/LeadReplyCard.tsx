import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { AgentCardNotice, AgentCardTextBlock, AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type LeadReplyCardProps = {
  actions?: ReactNode;
  fields?: AgentFieldItem[];
  hint?: ReactNode;
  replyText: ReactNode;
  status?: ReactNode;
  subtitle: ReactNode;
  title: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function LeadReplyCard({
  actions,
  fields = [],
  hint,
  replyText,
  status,
  subtitle,
  title
}: LeadReplyCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="lead-chat-card lead-reply-card"
      domain="Lead · Reply"
      icon={<MessageCircle size={16} />}
      intent="external"
      status={status}
      summary={subtitle}
      title={title}
      tone="lead"
    >
      <AgentFieldList fields={fields} />
      <AgentCardTextBlock label="Reply draft">{replyText}</AgentCardTextBlock>
      {hasRenderableValue(hint) ? <AgentCardNotice>{hint}</AgentCardNotice> : null}
    </AgentOutputCard>
  );
}
