import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAgentChatMessages,
  insertAgentChatMessage
} from "@/lib/agent/conversations";
import { requireCurrentBroker } from "@/lib/auth/current-user";

const getMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const appendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  message_type: z.string().min(1).optional(),
  structured_payload: z.record(z.unknown()).optional()
}).superRefine((value, context) => {
  if (!value.content.trim() && !value.structured_payload) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Content or structured payload is required",
      path: ["content"]
    });
  }
});

export async function GET(request: Request) {
  try {
    const { supabase, broker } = await requireCurrentBroker();
    const { searchParams } = new URL(request.url);
    const parsed = getMessagesSchema.safeParse({
      before: searchParams.get("before") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid message query", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await getAgentChatMessages(supabase, broker.id, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = appendMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid message payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    const message = await insertAgentChatMessage(supabase, {
      conversationId: parsed.data.conversationId,
      brokerId: broker.id,
      role: parsed.data.role,
      content: parsed.data.content,
      messageType: parsed.data.message_type,
      structuredPayload: parsed.data.structured_payload
    });

    return NextResponse.json({
      conversationId: message.conversation_id,
      message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
