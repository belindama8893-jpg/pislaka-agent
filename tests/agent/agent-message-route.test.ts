import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/message/route";
import {
  getRecentAgentContextMessages,
  insertAgentChatMessage
} from "@/lib/agent/conversations";
import { routeAgentMessage } from "@/lib/agent/deepseek";
import { resolveAgentActionEntities } from "@/lib/agent/entity-resolution";
import { normalizePakistanLocationTerms } from "@/lib/agent/location-normalization";
import type { AgentAction } from "@/lib/agent/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/agent/conversations", () => ({
  getRecentAgentContextMessages: vi.fn(),
  insertAgentChatMessage: vi.fn()
}));

vi.mock("@/lib/agent/deepseek", () => ({
  routeAgentMessage: vi.fn()
}));

vi.mock("@/lib/agent/entity-resolution", () => ({
  resolveAgentActionEntities: vi.fn()
}));

vi.mock("@/lib/agent/location-normalization", () => ({
  normalizePakistanLocationTerms: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

const brokerId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const listingId = "33333333-3333-4333-8333-333333333333";
const leadId = "44444444-4444-4444-8444-444444444444";

const routedAction: AgentAction = {
  intent: "list_leads",
  requires_confirmation: false,
  response: "Here are the matching leads.",
  payload: { status_filter: "new" }
};

const resolvedAction: AgentAction = {
  ...routedAction,
  resolution: {
    status: "matched",
    target_type: "lead",
    target_id: leadId
  }
};

const locationContext = {
  original: "Show new leads",
  normalized: "Show new leads",
  matches: []
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/agent/message", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

function makeSupabase({ user, broker }: { user?: { id: string } | null; broker?: { id: string } | null }) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: user ?? null },
        error: null
      }))
    },
    from: vi.fn((table: string) => {
      if (table === "broker_profiles") {
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          maybeSingle: vi.fn(async () => ({
            data: broker ?? null,
            error: null
          }))
        };
        return chain;
      }

      throw new Error(`Unexpected table: ${table}`);
    })
  };
}

const mockedCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockedNormalizePakistanLocationTerms = vi.mocked(normalizePakistanLocationTerms);
const mockedRouteAgentMessage = vi.mocked(routeAgentMessage);
const mockedInsertAgentChatMessage = vi.mocked(insertAgentChatMessage);
const mockedGetRecentAgentContextMessages = vi.mocked(getRecentAgentContextMessages);
const mockedResolveAgentActionEntities = vi.mocked(resolveAgentActionEntities);

describe("agent message route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNormalizePakistanLocationTerms.mockResolvedValue(locationContext as never);
    mockedRouteAgentMessage.mockResolvedValue(routedAction);
    mockedResolveAgentActionEntities.mockResolvedValue(resolvedAction);
    mockedInsertAgentChatMessage.mockResolvedValue({
      id: "message-1",
      conversation_id: conversationId,
      broker_id: brokerId,
      role: "user",
      content: "Show new leads",
      message_type: "text",
      structured_payload: null,
      created_at: "2026-06-13T12:00:00.000Z"
    } as never);
    mockedGetRecentAgentContextMessages.mockResolvedValue([
      { role: "user", content: "Previous question" },
      { role: "assistant", content: "Previous answer" }
    ]);
  });

  it("returns 400 for invalid message payloads before normalization", async () => {
    const response = await POST(makeRequest({ message: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid agent message payload" });
    expect(mockedNormalizePakistanLocationTerms).not.toHaveBeenCalled();
  });

  it("routes anonymous messages without writing conversation history", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue(makeSupabase({ user: null }) as never);

    const response = await POST(
      makeRequest({
        message: "Show new leads",
        time_zone: "Asia/Karachi",
        context_messages: [{ role: "user", content: "Recent context" }]
      })
    );

    expect(response.status).toBe(200);
    expect(mockedRouteAgentMessage).toHaveBeenCalledWith("Show new leads", {
      timeZone: "Asia/Karachi",
      locationContext,
      memory: expect.objectContaining({
        shortTerm: {
          messages: [
            expect.objectContaining({
              role: "user",
              content: "Recent context",
              source: "chat",
              trustLevel: "reference_only"
            })
          ]
        },
        workspace: expect.objectContaining({
          attachments: []
        })
      }),
      recentMessages: [{ role: "user", content: "Recent context" }]
    });
    expect(mockedInsertAgentChatMessage).not.toHaveBeenCalled();
    expect(mockedResolveAgentActionEntities).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      action: routedAction,
      location_context: locationContext
    });
  });

  it("routes signed-in users without a broker profile without writing conversation history", async () => {
    mockedCreateSupabaseServerClient.mockResolvedValue(makeSupabase({ user: { id: "user-1" }, broker: null }) as never);

    const response = await POST(makeRequest({ message: "Show new leads" }));

    expect(response.status).toBe(200);
    expect(mockedRouteAgentMessage).toHaveBeenCalledWith("Show new leads", {
      timeZone: undefined,
      locationContext,
      memory: expect.objectContaining({
        shortTerm: { messages: [] },
        workspace: expect.objectContaining({
          attachments: []
        })
      }),
      recentMessages: undefined
    });
    expect(mockedInsertAgentChatMessage).not.toHaveBeenCalled();
    expect(mockedResolveAgentActionEntities).not.toHaveBeenCalled();
  });

  it("stores broker messages, uses recent context, and resolves entities", async () => {
    const supabase = makeSupabase({ user: { id: "user-1" }, broker: { id: brokerId } });
    mockedCreateSupabaseServerClient.mockResolvedValue(supabase as never);

    const response = await POST(
      makeRequest({
        conversationId,
        message: "Reply to Ahmed on WhatsApp",
        current_listing_id: listingId,
        current_lead_id: leadId,
        context_attachments: [
          {
            id: "current-lead",
            type: "lead",
            entity_id: leadId,
            label: "Ahmed Raza"
          }
        ]
      })
    );

    expect(response.status).toBe(200);
    expect(mockedInsertAgentChatMessage).toHaveBeenCalledWith(supabase, {
      conversationId,
      brokerId,
      role: "user",
      content: "Reply to Ahmed on WhatsApp"
    });
    expect(mockedGetRecentAgentContextMessages).toHaveBeenCalledWith(supabase, brokerId, 20);
    expect(mockedRouteAgentMessage).toHaveBeenCalledWith("Reply to Ahmed on WhatsApp", {
      timeZone: undefined,
      locationContext,
      memory: expect.objectContaining({
        shortTerm: {
          messages: [
            expect.objectContaining({
              role: "user",
              content: "Previous question",
              trustLevel: "reference_only"
            }),
            expect.objectContaining({
              role: "assistant",
              content: "Previous answer",
              trustLevel: "reference_only"
            })
          ]
        },
        workspace: expect.objectContaining({
          currentLead: expect.objectContaining({
            entityId: leadId,
            source: "explicit_selection",
            trustLevel: "confirmed"
          }),
          currentListing: expect.objectContaining({
            entityId: listingId,
            source: "explicit_selection",
            trustLevel: "confirmed"
          }),
          attachments: [
            expect.objectContaining({
              entity_id: leadId,
              source: "context_attachment",
              trustLevel: "confirmed"
            })
          ]
        })
      }),
      recentMessages: [
        { role: "user", content: "Previous question" },
        { role: "assistant", content: "Previous answer" }
      ]
    });
    expect(mockedResolveAgentActionEntities).toHaveBeenCalledWith(routedAction, supabase, brokerId, {
      currentListingId: listingId,
      currentLeadId: leadId,
      contextAttachments: [
        {
          id: "current-lead",
          type: "lead",
          entity_id: leadId,
          label: "Ahmed Raza"
        }
      ],
      originalMessage: "Reply to Ahmed on WhatsApp"
    });

    expect(await response.json()).toMatchObject({
      action: resolvedAction,
      location_context: locationContext,
      conversationId,
      userMessage: {
        id: "message-1",
        conversation_id: conversationId,
        broker_id: brokerId,
        role: "user",
        content: "Show new leads"
      }
    });
  });

  it("uses provided context messages instead of fetching recent broker context", async () => {
    const supabase = makeSupabase({ user: { id: "user-1" }, broker: { id: brokerId } });
    mockedCreateSupabaseServerClient.mockResolvedValue(supabase as never);

    await POST(
      makeRequest({
        message: "Show hot leads",
        context_messages: [{ role: "assistant", content: "Known context" }]
      })
    );

    expect(mockedGetRecentAgentContextMessages).not.toHaveBeenCalled();
    expect(mockedRouteAgentMessage).toHaveBeenCalledWith("Show hot leads", {
      timeZone: undefined,
      locationContext,
      memory: expect.objectContaining({
        shortTerm: {
          messages: [
            expect.objectContaining({
              role: "assistant",
              content: "Known context",
              trustLevel: "reference_only"
            })
          ]
        }
      }),
      recentMessages: [{ role: "assistant", content: "Known context" }]
    });
  });
});
