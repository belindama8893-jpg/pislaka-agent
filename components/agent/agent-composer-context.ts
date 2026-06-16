import type { AgentComposerContextPreview } from "@/components/agent/AgentComposer";
import type { AgentContextAttachment } from "@/lib/agent/types";

export type AgentComposerContextAttachment = AgentContextAttachment & {
  label: string;
  summary: string;
  media?: AgentComposerContextPreview["media"];
};

export function createAgentComposerContextPreviews(
  contextAttachments: AgentComposerContextAttachment[]
): AgentComposerContextPreview[] {
  return contextAttachments.map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    summary: item.summary,
    media: item.media
  }));
}
