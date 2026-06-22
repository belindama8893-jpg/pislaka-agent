import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { AgentCardTextBlock, AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type AnalyticsInsightItem = {
  meta?: ReactNode;
  title: ReactNode;
};

export type AnalyticsInsightCardProps = {
  actions?: ReactNode;
  fields: AgentFieldItem[];
  insights?: AnalyticsInsightItem[];
  status?: ReactNode;
  subtitle?: ReactNode;
  title: string;
};

export function AnalyticsInsightCard({
  actions,
  fields,
  insights = [],
  status,
  subtitle,
  title
}: AnalyticsInsightCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="analytics-agent-card"
      domain="Analytics"
      icon={<BarChart3 size={16} />}
      intent="read"
      status={status}
      summary={subtitle}
      title={title}
      tone="default"
    >
      <AgentFieldList fields={fields} />
      {insights.length ? (
        <div className="agent-insight-list">
          {insights.map((insight, index) => (
            <AgentCardTextBlock key={index} label={index === 0 ? "Insight" : "Action"} title={insight.title}>
              {insight.meta}
            </AgentCardTextBlock>
          ))}
        </div>
      ) : null}
    </AgentOutputCard>
  );
}
