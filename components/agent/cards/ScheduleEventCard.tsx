import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type ScheduleEventCardProps = {
  actions?: ReactNode;
  description?: ReactNode;
  editForm?: ReactNode;
  fields: AgentFieldItem[];
  isEditing?: boolean;
  status?: ReactNode;
  subtitle?: ReactNode;
  title: string;
  eventTitle: ReactNode;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function ScheduleEventCard({
  actions,
  description,
  editForm,
  fields,
  isEditing = false,
  status,
  subtitle,
  title,
  eventTitle
}: ScheduleEventCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="schedule-card schedule-event-card"
      domain="Schedule"
      icon={<CalendarClock size={16} />}
      intent="confirm"
      status={status}
      summary={subtitle}
      title={title}
      tone="schedule"
    >
      {isEditing ? (
        editForm
      ) : (
        <>
          <div className="schedule-event-summary">
            <h3>{eventTitle}</h3>
            {hasRenderableValue(description) ? <p>{description}</p> : null}
          </div>
          <AgentFieldList fields={fields} />
        </>
      )}
    </AgentOutputCard>
  );
}
