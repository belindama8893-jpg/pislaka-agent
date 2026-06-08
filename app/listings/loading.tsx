import { WorkspaceLoading } from "@/components/workspace/WorkspaceLoading";

export default function Loading() {
  return (
    <WorkspaceLoading
      active="listings"
      rows={6}
      subtitle="Review confirmed drafts, edit property facts, and attach photos or video."
      title="Listings"
    />
  );
}
