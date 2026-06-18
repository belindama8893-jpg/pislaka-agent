import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
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

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

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
            <article key={index}>
              <span>{index === 0 ? "Insight" : "Action"}</span>
              <strong>{insight.title}</strong>
              {hasRenderableValue(insight.meta) ? <p>{insight.meta}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
    </AgentOutputCard>
  );
}
