import { describe, expect, it } from "vitest";
import {
  buildAgentTurnContent,
  createRecentAgentContextMessages,
  getSelectedAgentContextEntityId,
  inferAgentWorkflowState
} from "../../components/agent/agent-submit-context";

describe("agent submit context", () => {
  it("selects the latest attached entity by type", () => {
    expect(
      getSelectedAgentContextEntityId(
        [
          { type: "lead", entity_id: "lead-1" },
          { type: "listing", entity_id: "listing-1" },
          { type: "lead", entity_id: "lead-2" }
        ],
        "lead"
      )
    ).toBe("lead-2");
  });

  it("builds visible and agent turn content from text, media, and files", () => {
    expect(
      buildAgentTurnContent({
        message: "Promote this listing",
        mediaCount: 2,
        fileAttachments: [
          {
            file: {
              name: "brochure.pdf"
            }
          }
        ]
      })
    ).toEqual({
      agentMessageContent: "Promote this listing\n\nAttached 2 listing media files.\n\nAttached 1 file: brochure.pdf.",
      fileSummary: "Attached 1 file: brochure.pdf.",
      mediaSummary: "Attached 2 listing media files.",
      userMessageContent: "Promote this listing",
      visibleUserMessageContent: "Promote this listing\n\nAttached 1 file: brochure.pdf."
    });
  });

  it("uses media summary as visible content when the user only attaches media", () => {
    expect(
      buildAgentTurnContent({
        message: "",
        mediaCount: 1,
        fileAttachments: []
      }).visibleUserMessageContent
    ).toBe("Attached 1 listing media file.");
  });

  it("keeps the last non-empty messages as agent context", () => {
    const messages = Array.from({ length: 22 }, (_, index) => ({
      role: (index % 2 ? "assistant" : "user") as "assistant" | "user",
      content: index === 3 ? "   " : `message ${index}`
    }));

    const recent = createRecentAgentContextMessages(messages, 3);

    expect(recent).toEqual([
      { role: "assistant", content: "message 19" },
      { role: "user", content: "message 20" },
      { role: "assistant", content: "message 21" }
    ]);
  });

  it("infers awaiting confirmation workflow state from the latest assistant card", () => {
    expect(
      inferAgentWorkflowState([
        { role: "assistant", content: "Older result", promotion: { id: "promo-1" } },
        {
          role: "assistant",
          content: "Please confirm before I save this lead.",
          leadCreate: { payload: {} },
          sourceMessage: "Add Ahmed"
        }
      ])
    ).toEqual({
      stage: "awaiting_confirmation",
      active_intent: "create_lead",
      awaiting: "confirmation",
      pending_slots: [],
      source_message: "Add Ahmed",
      summary: "Waiting for broker confirmation: lead creation confirmation."
    });
  });

  it("infers needs-selection and collecting-info workflow states", () => {
    expect(
      inferAgentWorkflowState([
        {
          role: "assistant",
          content: "I found several Ahmed leads.",
          entitySelection: { candidates: [] }
        }
      ])
    ).toMatchObject({
      stage: "needs_selection",
      awaiting: "selection",
      pending_slots: ["target_entity"]
    });

    expect(
      inferAgentWorkflowState([
        {
          role: "assistant",
          content: "Which property should I promote?"
        }
      ])
    ).toMatchObject({
      stage: "collecting_info",
      awaiting: "details",
      pending_slots: ["next_detail"]
    });
  });
});
