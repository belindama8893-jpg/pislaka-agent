import { describe, expect, it, vi } from "vitest";
import { createAgentAttachComposerActions } from "../../components/agent/agent-composer-attachments";

describe("agent composer attachment actions", () => {
  it("creates the expected attachment actions in menu order", () => {
    const callbacks = {
      chooseLead: vi.fn(),
      chooseListing: vi.fn(),
      importWhatsAppChat: vi.fn(),
      uploadDocument: vi.fn(),
      uploadMedia: vi.fn()
    };

    const actions = createAgentAttachComposerActions(callbacks);

    expect(actions.map((action) => action.label)).toEqual([
      "Import WhatsApp chat",
      "Upload photo/video",
      "Upload file",
      "Choose listing",
      "Choose lead"
    ]);

    actions.forEach((action) => action.onClick());

    expect(callbacks.importWhatsAppChat).toHaveBeenCalledTimes(1);
    expect(callbacks.uploadMedia).toHaveBeenCalledTimes(1);
    expect(callbacks.uploadDocument).toHaveBeenCalledTimes(1);
    expect(callbacks.chooseListing).toHaveBeenCalledTimes(1);
    expect(callbacks.chooseLead).toHaveBeenCalledTimes(1);
  });
});
