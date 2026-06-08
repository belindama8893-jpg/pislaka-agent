import { CalendarClock, List, Users } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

type WorkspaceLoadingProps = {
  active: "listings" | "leads" | "schedule";
  title?: string;
  subtitle?: string;
  rows?: number;
};

const loadingBroker = {
  full_name: "Pislaka Broker",
  email: null,
  city: null,
  agency_name: null
};

function getIcon(active: WorkspaceLoadingProps["active"]) {
  if (active === "listings") {
    return List;
  }

  if (active === "leads") {
    return Users;
  }

  if (active === "schedule") {
    return CalendarClock;
  }
  return List;
}

export function WorkspaceLoading({ active, rows = 5, subtitle, title }: WorkspaceLoadingProps) {
  const Icon = getIcon(active);

  return (
    <WorkspaceShell
      active={active}
      broker={loadingBroker}
      initials="P"
      subtitle={subtitle}
      title={title}
    >
      <section className="listing-library glass-panel library-page-panel workspace-loading-panel" aria-busy="true">
        <div className="widget-header">
          <h3>
            <Icon size={18} /> {title}
          </h3>
          <span className="count-pill loading-pill" />
        </div>

        <div className="workspace-loading-list">
          <div className="loading-filter-row">
            <span />
            <span />
            <span />
          </div>
          {Array.from({ length: rows }).map((_, index) => (
            <div className="loading-row" key={index}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      </section>
    </WorkspaceShell>
  );
}
