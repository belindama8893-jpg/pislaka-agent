import { describe, expect, it } from "vitest";
import {
  formatAgentComposerFileSize,
  summarizeAgentFileAttachments
} from "../../components/agent/agent-composer-files";

describe("agent composer file helpers", () => {
  it("formats file sizes for composer previews", () => {
    expect(formatAgentComposerFileSize(512)).toBe("512 B");
    expect(formatAgentComposerFileSize(1536)).toBe("1.5 KB");
    expect(formatAgentComposerFileSize(1536 * 1024)).toBe("1.5 MB");
  });

  it("summarizes attached files for the agent turn", () => {
    expect(summarizeAgentFileAttachments([])).toBe("");
    expect(
      summarizeAgentFileAttachments([
        {
          file: {
            name: "chat.txt"
          }
        }
      ])
    ).toBe("Attached 1 file: chat.txt.");
    expect(
      summarizeAgentFileAttachments([
        {
          file: {
            name: "chat.txt"
          }
        },
        {
          file: {
            name: "brochure.pdf"
          }
        }
      ])
    ).toBe("Attached 2 files: chat.txt, brochure.pdf.");
  });
});
