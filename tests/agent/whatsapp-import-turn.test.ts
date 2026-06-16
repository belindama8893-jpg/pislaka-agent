import { describe, expect, it } from "vitest";
import {
  detectChatImportRequestedAction,
  getWhatsAppImportTurn,
  hasWhatsAppChatFile,
  isWhatsAppChatFileName,
  looksLikeWhatsAppChatText
} from "../../components/agent/agent-whatsapp-import-turn";

describe("agent WhatsApp import turn", () => {
  it("detects pasted WhatsApp chat text without treating selected context as chat", () => {
    expect(looksLikeWhatsAppChatText("[12/6/26, 10:20] Ahmed: Is this still available?")).toBe(true);
    expect(looksLikeWhatsAppChatText("Selected context: Lead Ahmed")).toBe(false);
  });

  it("detects WhatsApp export files", () => {
    expect(isWhatsAppChatFileName("WhatsApp Chat with Ahmed.txt")).toBe(true);
    expect(isWhatsAppChatFileName("whatsapp-export.zip")).toBe(true);
    expect(isWhatsAppChatFileName("brochure.pdf")).toBe(false);
    expect(
      hasWhatsAppChatFile([
        {
          kind: "document",
          file: { name: "brochure.pdf" }
        },
        {
          kind: "whatsapp_chat",
          file: { name: "chat.backup" }
        }
      ])
    ).toBe(true);
  });

  it("detects the requested import follow-up action", () => {
    expect(detectChatImportRequestedAction("reply to this chat")).toBe("reply");
    expect(detectChatImportRequestedAction("set reminder for this buyer")).toBe("set_reminder");
    expect(detectChatImportRequestedAction("保存这次跟进")).toBe("save_followup");
    expect(detectChatImportRequestedAction("分析这段聊天")).toBe("analyze_only");
  });

  it("creates a handled import turn for pasted chat text", () => {
    expect(
      getWhatsAppImportTurn({
        message: "Ahmed: Is this still available?\nBroker: Yes, Sunday 4pm works.",
        files: [],
        hasOutgoingMedia: false,
        isScheduleRequest: false,
        isWhatsAppImportMode: false
      })
    ).toEqual({
      hasWhatsAppChatFile: false,
      requestedAction: "unknown",
      shouldHandle: true
    });
  });

  it("does not treat a single colon-based business command as chat import", () => {
    expect(
      getWhatsAppImportTurn({
        message: "Create listing for sale: 1 kanal house in DHA Phase 6 Lahore, demand 8.5 crore",
        files: [],
        hasOutgoingMedia: false,
        isScheduleRequest: false,
        isWhatsAppImportMode: false
      }).shouldHandle
    ).toBe(false);

    expect(
      getWhatsAppImportTurn({
        message: "Ahmed: Is this still available?",
        files: [],
        hasOutgoingMedia: false,
        isScheduleRequest: false,
        isWhatsAppImportMode: true
      }).shouldHandle
    ).toBe(true);
  });

  it("does not let chat text heuristics intercept schedule requests", () => {
    expect(
      getWhatsAppImportTurn({
        message: "Ahmed: schedule a viewing tomorrow",
        files: [],
        hasOutgoingMedia: false,
        isScheduleRequest: true,
        isWhatsAppImportMode: false
      }).shouldHandle
    ).toBe(false);
  });

  it("handles explicit import mode only when text or a chat file is present", () => {
    expect(
      getWhatsAppImportTurn({
        message: "",
        files: [],
        hasOutgoingMedia: false,
        isScheduleRequest: false,
        isWhatsAppImportMode: true
      }).shouldHandle
    ).toBe(false);
    expect(
      getWhatsAppImportTurn({
        message: "",
        files: [{ file: { name: "chat.txt" } }],
        hasOutgoingMedia: false,
        isScheduleRequest: false,
        isWhatsAppImportMode: true
      }).shouldHandle
    ).toBe(true);
  });
});
