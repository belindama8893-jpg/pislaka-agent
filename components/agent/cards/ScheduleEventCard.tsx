import type { ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { AgentCardTextBlock, AgentFieldList, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
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
          <AgentCardTextBlock label="Event preview" title={eventTitle}>
            {description}
          </AgentCardTextBlock>
          <AgentFieldList fields={fields} />
        </>
      )}
    </AgentOutputCard>
  );
}
