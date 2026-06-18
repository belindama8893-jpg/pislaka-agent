import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { AgentFieldList, AgentObjectSummary, type AgentFieldItem } from "@/components/agent/AgentCardPrimitives";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type ListingDraftCardProps = {
  actions?: ReactNode;
  addMediaButton?: ReactNode;
  description?: ReactNode;
  editForm?: ReactNode;
  fields: AgentFieldItem[];
  isEditing?: boolean;
  media?: ReactNode;
  status?: ReactNode;
  subtitle: ReactNode;
  title: string;
};

export function ListingDraftCard({
  actions,
  addMediaButton,
  description,
  editForm,
  fields,
  isEditing = false,
  media,
  status,
  subtitle,
  title
}: ListingDraftCardProps) {
  return (
    <AgentOutputCard
      actions={actions}
      className="agent-draft-card"
      domain="Listing"
      icon={<Sparkles size={16} />}
      intent="draft"
      status={status}
      summary={subtitle}
      title="Listing preview"
      tone="listing"
    >
      {isEditing ? (
        editForm
      ) : (
        <div className="agent-draft-preview">
          <AgentObjectSummary description={description} title={title} variant="block" />
          <AgentFieldList fields={fields} />
        </div>
      )}
      <div className="agent-media-panel" aria-label="Listing photos and video">
        <div className="agent-media-preview draft-grid">
          {media}
          {addMediaButton}
        </div>
      </div>
    </AgentOutputCard>
  );
}
