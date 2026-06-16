import { describe, expect, it } from "vitest";
import {
  compileAgentMemoryContext,
  formatAgentMemoryForPrompt,
  getAgentMemoryRecentMessages
} from "../../lib/agent/memory";

describe("agent memory runtime", () => {
  it("classifies short-term chat as reference-only memory", () => {
    const memory = compileAgentMemoryContext({
      recentMessages: [
        { role: "user", content: "   " },
        { role: "user", content: "Ahmed wants a viewing" },
        { role: "assistant", content: "I can help schedule that." }
      ]
    });

    expect(memory.shortTerm.messages).toEqual([
      expect.objectContaining({
        role: "user",
        content: "Ahmed wants a viewing",
        source: "chat",
        trustLevel: "reference_only",
        allowedUse: ["routing", "guidance", "prompt"],
        expires: "conversation"
      }),
      expect.objectContaining({
        role: "assistant",
        source: "chat",
        trustLevel: "reference_only"
      })
    ]);
  });

  it("classifies selected entities and attachments as confirmed workspace memory", () => {
    const memory = compileAgentMemoryContext({
      currentLeadId: "11111111-1111-1111-1111-111111111111",
      currentListingId: "22222222-2222-2222-2222-222222222222",
      contextAttachments: [
        {
          id: "lead:33333333-3333-3333-3333-333333333333",
          type: "lead",
          entity_id: "33333333-3333-3333-3333-333333333333",
          label: "Ahmed",
          summary: "qualified"
        }
      ]
    });

    expect(memory.workspace.currentLead).toMatchObject({
      entityId: "11111111-1111-1111-1111-111111111111",
      type: "lead",
      source: "explicit_selection",
      trustLevel: "confirmed",
      allowedUse: ["routing", "guidance", "prompt", "entity_resolution"],
      expires: "session"
    });
    expect(memory.workspace.currentListing).toMatchObject({
      entityId: "22222222-2222-2222-2222-222222222222",
      type: "listing",
      source: "explicit_selection",
      trustLevel: "confirmed"
    });
    expect(memory.workspace.attachments[0]).toMatchObject({
      label: "Ahmed",
      source: "context_attachment",
      trustLevel: "confirmed",
      expires: "turn"
    });
  });

  it("formats memory with database source-of-truth boundaries for the router prompt", () => {
    const memory = compileAgentMemoryContext({
      recentMessages: [{ role: "user", content: "Promote the listing we just discussed" }],
      currentListingId: "22222222-2222-2222-2222-222222222222"
    });
    const prompt = formatAgentMemoryForPrompt(memory);

    expect(prompt).toContain("Chat memory is reference_only");
    expect(prompt).toContain("Database records remain the source of truth");
    expect(prompt).toContain("Current listing selected: 22222222-2222-2222-2222-222222222222");
    expect(prompt).toContain("Broker: Promote the listing we just discussed");
  });

  it("returns recent messages from compiled memory for local routing helpers", () => {
    const memory = compileAgentMemoryContext({
      recentMessages: [{ role: "assistant", content: "I can see: Location: DHA Phase 5." }]
    });

    expect(getAgentMemoryRecentMessages(memory)).toEqual([
      { role: "assistant", content: "I can see: Location: DHA Phase 5." }
    ]);
  });
});
