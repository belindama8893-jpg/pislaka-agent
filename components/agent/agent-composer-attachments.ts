import { FileText, House, ImageIcon, MessageCircle } from "lucide-react";
import type { AgentComposerAction } from "@/components/agent/AgentComposer";

type CreateAgentAttachComposerActionsOptions = {
  chooseLead: () => void;
  chooseListing: () => void;
  importWhatsAppChat: () => void;
  uploadDocument: () => void;
  uploadMedia: () => void;
};

export function createAgentAttachComposerActions({
  chooseLead,
  chooseListing,
  importWhatsAppChat,
  uploadDocument,
  uploadMedia
}: CreateAgentAttachComposerActionsOptions): AgentComposerAction[] {
  return [
    {
      icon: MessageCircle,
      label: "Import WhatsApp chat",
      onClick: importWhatsAppChat
    },
    {
      icon: ImageIcon,
      label: "Upload photo/video",
      onClick: uploadMedia
    },
    {
      icon: FileText,
      label: "Upload file",
      onClick: uploadDocument
    },
    {
      icon: House,
      label: "Choose listing",
      onClick: chooseListing
    },
    {
      icon: MessageCircle,
      label: "Choose lead",
      onClick: chooseLead
    }
  ];
}
