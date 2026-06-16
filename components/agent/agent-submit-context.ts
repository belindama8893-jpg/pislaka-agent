import { summarizeAgentFileAttachments } from "@/components/agent/agent-composer-files";

type ChatContextAttachmentRef = {
  entity_id: string;
  type: "listing" | "lead";
};

type ChatMessageRef = {
  content: string;
  role: "user" | "assistant";
};

type BuildAgentTurnContentOptions<FileAttachment> = {
  fileAttachments: FileAttachment[];
  mediaCount: number;
  message: string;
};

export function getSelectedAgentContextEntityId(
  contextAttachments: ChatContextAttachmentRef[],
  type: ChatContextAttachmentRef["type"]
) {
  return [...contextAttachments].reverse().find((item) => item.type === type)?.entity_id;
}

export function createRecentAgentContextMessages(messages: ChatMessageRef[], limit = 20): ChatMessageRef[] {
  return messages
    .filter((message) => message.content.trim())
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

export function buildAgentTurnContent<FileAttachment extends { file: { name: string } }>({
  fileAttachments,
  mediaCount,
  message
}: BuildAgentTurnContentOptions<FileAttachment>) {
  const mediaSummary = mediaCount
    ? `Attached ${mediaCount} listing media file${mediaCount === 1 ? "" : "s"}.`
    : "";
  const fileSummary = summarizeAgentFileAttachments(fileAttachments);
  const userMessageContent = message || mediaSummary;
  const visibleUserMessageContent = [userMessageContent, fileSummary].filter(Boolean).join("\n\n");
  const agentMessageContent = [message, mediaSummary, fileSummary].filter(Boolean).join("\n\n");

  return {
    agentMessageContent,
    fileSummary,
    mediaSummary,
    userMessageContent,
    visibleUserMessageContent
  };
}
