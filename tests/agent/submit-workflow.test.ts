import { describe, expect, it } from "vitest";
import {
  canHandlePendingActionConfirmation,
  findLatestPendingPromotionAction,
  findLatestPendingSocialCopyAction,
  getBulkLeadWriteGuard,
  isAgentConfirmationMessage
} from "../../components/agent/agent-submit-workflow";

type TestChannel = "whatsapp" | "facebook";

type TestPromotion = {
  cards: Array<{
    channel: TestChannel;
    landing_url?: string | null;
  }>;
};

type TestMessage = {
  content: string;
  draft?: unknown;
  id: string;
  isProgress?: boolean;
  listingSaved?: unknown;
  promotion?: TestPromotion;
  promotionChannels?: TestChannel[];
  promotionInstruction?: string;
  promotionTarget?: { id: string; title: string };
  role: "user" | "assistant";
  sourceMessage?: string;
};

describe("agent submit workflow", () => {
  it("recognizes confirmation turns only when no new inputs are attached", () => {
    expect(isAgentConfirmationMessage("确认")).toBe(true);
    expect(isAgentConfirmationMessage("please confirm with Ahmed")).toBe(false);
    expect(
      canHandlePendingActionConfirmation({
        message: "ok",
        hasOutgoingContext: false,
        hasOutgoingFiles: false,
        hasOutgoingMedia: false
      })
    ).toBe(true);
    expect(
      canHandlePendingActionConfirmation({
        message: "ok",
        hasOutgoingContext: true,
        hasOutgoingFiles: false,
        hasOutgoingMedia: false
      })
    ).toBe(false);
  });

  it("finds the latest unconsumed pending promotion action", () => {
    const messages: TestMessage[] = [
      {
        id: "old",
        role: "assistant",
        content: "Old pending",
        promotionTarget: { id: "listing-old", title: "Old" },
        promotionChannels: ["facebook"]
      },
      {
        id: "progress",
        role: "assistant",
        content: "Still working",
        isProgress: true
      },
      {
        id: "new",
        role: "assistant",
        content: "Ready to promote?",
        promotionTarget: { id: "listing-new", title: "New" },
        promotionInstruction: "Promote the new listing"
      }
    ];

    expect(findLatestPendingPromotionAction(messages, [], ["whatsapp"])).toEqual({
      messageId: "new",
      listing: { id: "listing-new", title: "New" },
      instruction: "Promote the new listing",
      channels: ["whatsapp"]
    });
  });

  it("stops looking for pending promotion once a promotion already exists", () => {
    const messages: TestMessage[] = [
      {
        id: "pending",
        role: "assistant",
        content: "Ready?",
        promotionTarget: { id: "listing-1", title: "Listing" }
      },
      {
        id: "done",
        role: "assistant",
        content: "Generated",
        promotion: {
          cards: [{ channel: "whatsapp", landing_url: "https://example.test" }]
        }
      }
    ];

    expect(findLatestPendingPromotionAction(messages, [], ["whatsapp"])).toBeNull();
  });

  it("finds social copy promotions that still need saving as a draft", () => {
    const messages: TestMessage[] = [
      {
        id: "copy",
        role: "assistant",
        content: "Social copy",
        sourceMessage: "Create copy",
        promotion: {
          cards: [
            { channel: "whatsapp", landing_url: null },
            { channel: "facebook" }
          ]
        }
      }
    ];

    expect(findLatestPendingSocialCopyAction(messages, [])).toEqual({
      messageId: "copy",
      promotion: {
        cards: [
          { channel: "whatsapp", landing_url: null },
          { channel: "facebook" }
        ]
      },
      instruction: "Create copy",
      channels: ["whatsapp", "facebook"]
    });
  });

  it("classifies multi-lead write guards", () => {
    const leads = [{ entity_id: "lead-1" }, { entity_id: "lead-2" }];

    expect(getBulkLeadWriteGuard("mark them hot", leads)).toEqual({
      kind: "status_update",
      leadContexts: leads
    });
    expect(getBulkLeadWriteGuard("schedule follow up", leads)).toEqual({
      kind: "unsupported_bulk_write",
      leadContexts: leads
    });
    expect(getBulkLeadWriteGuard("show details", leads)).toEqual({
      kind: "none",
      leadContexts: leads
    });
  });
});
