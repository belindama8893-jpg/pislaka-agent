import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
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
      <p className="lead-chat-reply">{replyText}</p>
      {hasRenderableValue(hint) ? (
        <div className="agent-card-inline-hint">
          <span aria-hidden="true" />
          {hint}
        </div>
      ) : null}
    </AgentOutputCard>
  );
}
