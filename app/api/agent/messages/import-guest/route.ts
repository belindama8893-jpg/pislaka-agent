import { NextResponse } from "next/server";
import { z } from "zod";
import { insertAgentChatMessage } from "@/lib/agent/conversations";
import { requireCurrentBroker } from "@/lib/auth/current-user";

const guestMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12000),
  message_type: z.string().min(1).max(64).optional(),
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

const importGuestMessagesSchema = z.object({
  messages: z.array(guestMessageSchema).min(1).max(100)
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = importGuestMessagesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid guest transcript payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { supabase, broker } = await requireCurrentBroker();
    let conversationId: string | undefined;

    for (const message of parsed.data.messages) {
      const inserted = await insertAgentChatMessage(supabase, {
        conversationId,
        brokerId: broker.id,
        role: message.role,
        content: message.content,
        messageType: message.message_type,
        structuredPayload: message.structured_payload
      });
      conversationId = inserted.conversation_id;
    }

    return NextResponse.json({
      conversationId,
      imported: parsed.data.messages.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
