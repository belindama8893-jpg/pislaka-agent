export type ChatImportRequestedAction =
  | "reply"
  | "save_followup"
  | "set_reminder"
  | "update_status"
  | "analyze_only"
  | "unknown";

type WhatsAppImportFileRef = {
  file: {
    name: string;
  };
  kind?: string;
};

type GetWhatsAppImportTurnOptions<FileRef extends WhatsAppImportFileRef> = {
  files: FileRef[];
  hasOutgoingMedia: boolean;
  isScheduleRequest: boolean;
  isWhatsAppImportMode: boolean;
  message: string;
};

export function looksLikeWhatsAppChatText(message: string) {
  const trimmed = message.trim();

  if (/\bSelected context:\s+(?:Lead|Listing)\b/i.test(trimmed)) {
    return false;
  }

  return (
    /whats\s*app|whatsapp|chat export|messages and calls are end-to-end encrypted/i.test(trimmed) ||
    /^\[?\d{1,2}[/.:-]\d{1,2}[/.:-]\d{2,4},?\s+\d{1,2}:\d{2}/m.test(trimmed) ||
    /^[\p{L}\p{N} ._+\-()]+:\s+.+$/mu.test(trimmed)
  );
}

export function detectChatImportRequestedAction(message: string): ChatImportRequestedAction {
  const normalized = message.toLowerCase();

  if (/回复|回他|回她|reply|respond|draft/i.test(message)) {
    return "reply";
  }
  if (/提醒|remind|reminder|follow up later|跟进时间/i.test(message)) {
    return "set_reminder";
  }
  if (/状态|更新.*客户|更新.*线索|qualified|interested|not interested|lost|status/i.test(message)) {
    return "update_status";
  }
  if (/保存|记录|加入.*跟进|保存.*跟进|save|record|note/i.test(message)) {
    return "save_followup";
  }
  if (/分析|总结|看看|summari[sz]e|analy[sz]e/i.test(message)) {
    return "analyze_only";
  }

  return normalized.trim() ? "unknown" : "unknown";
}

export function isWhatsAppChatFileName(fileName: string) {
  const name = fileName.toLowerCase();

  return name.endsWith(".txt") || name.endsWith(".zip");
}

export function isWhatsAppChatFile(file: { name: string }) {
  return isWhatsAppChatFileName(file.name);
}

export function hasWhatsAppChatFile<FileRef extends WhatsAppImportFileRef>(files: FileRef[]) {
  return files.some((item) => item.kind === "whatsapp_chat" || isWhatsAppChatFile(item.file));
}

export function getWhatsAppImportTurn<FileRef extends WhatsAppImportFileRef>({
  files,
  hasOutgoingMedia,
  isScheduleRequest,
  isWhatsAppImportMode,
  message
}: GetWhatsAppImportTurnOptions<FileRef>) {
  const hasChatFile = hasWhatsAppChatFile(files);
  const hasOutgoingFiles = files.length > 0;
  const shouldImport =
    isWhatsAppImportMode ||
    hasChatFile ||
    (!hasOutgoingMedia && !hasOutgoingFiles && !isScheduleRequest && looksLikeWhatsAppChatText(message));

  return {
    hasWhatsAppChatFile: hasChatFile,
    requestedAction: detectChatImportRequestedAction(message),
    shouldHandle: shouldImport && Boolean(message.trim() || hasChatFile)
  };
}
