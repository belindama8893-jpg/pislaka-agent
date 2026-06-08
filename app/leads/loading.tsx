import { WorkspaceLoading } from "@/components/workspace/WorkspaceLoading";

export default function Loading() {
  return (
    <WorkspaceLoading
      active="leads"
      rows={6}
      subtitle="Review buyer inquiries, source channels, and follow-up status."
      title="Leads"
    />
  );
}
