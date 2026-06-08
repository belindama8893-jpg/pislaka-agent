import { WorkspaceLoading } from "@/components/workspace/WorkspaceLoading";

export default function Loading() {
  return (
    <WorkspaceLoading
      active="schedule"
      rows={5}
      subtitle="Manage viewings, follow-ups, signing dates, handovers, and reminders."
      title="Schedule"
    />
  );
}
