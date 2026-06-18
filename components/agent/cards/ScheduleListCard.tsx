import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type ScheduleListItem = {
  id: string;
  meta?: ReactNode;
  time: ReactNode;
  title: ReactNode;
};

export type ScheduleListCardProps = {
  actions?: ReactNode;
  empty?: ReactNode;
  items: ScheduleListItem[];
  status?: ReactNode;
  subtitle?: ReactNode;
  title: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function ScheduleListCard({
  actions,
  empty,
  items,
  status,
  subtitle,
  title
}: ScheduleListCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="schedule-card schedule-list-card"
      domain="Schedule"
      icon={<CalendarClock size={16} />}
      intent="read"
      status={status}
      summary={subtitle}
      title={title}
      tone="schedule"
    >
      {items.length ? (
        <div className="schedule-card-list">
          {items.map((item) => (
            <div className="schedule-card-row" key={item.id}>
              <time>{item.time}</time>
              <div>
                <strong>{item.title}</strong>
                {hasRenderableValue(item.meta) ? <small>{item.meta}</small> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="schedule-card-empty">{empty}</p>
      )}
    </AgentOutputCard>
  );
}
