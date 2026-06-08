import { NextResponse } from "next/server";
import {
  getRecentAgentContextMessages,
  insertAgentChatMessage
} from "@/lib/agent/conversations";
import { routeAgentMessage } from "@/lib/agent/deepseek";
import { resolveAgentActionEntities } from "@/lib/agent/entity-resolution";
import { agentMessageSchema } from "@/lib/agent/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = agentMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid agent message payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      const action = await routeAgentMessage(parsed.data.message, {
        timeZone: parsed.data.time_zone,
        recentMessages: parsed.data.context_messages
      });
      return NextResponse.json({ action });
    }

    const { data: broker } = await supabase
      .from("broker_profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!broker?.id) {
      const action = await routeAgentMessage(parsed.data.message, {
        timeZone: parsed.data.time_zone,
        recentMessages: parsed.data.context_messages
      });
      return NextResponse.json({ action });
    }

    const userMessage = await insertAgentChatMessage(supabase, {
      conversationId: parsed.data.conversationId,
      brokerId: broker.id,
      role: "user",
      content: parsed.data.message
    });
    const recentMessages =
      parsed.data.context_messages && parsed.data.context_messages.length
        ? parsed.data.context_messages
        : await getRecentAgentContextMessages(supabase, broker.id, 20);

    const action = await routeAgentMessage(parsed.data.message, {
      timeZone: parsed.data.time_zone,
      recentMessages
    });
    const resolvedAction = broker?.id
      ? await resolveAgentActionEntities(action, supabase, broker.id, {
          currentListingId: parsed.data.current_listing_id,
          currentLeadId: parsed.data.current_lead_id,
          contextAttachments: parsed.data.context_attachments,
          originalMessage: parsed.data.message
        })
      : action;

    return NextResponse.json({
      action: resolvedAction,
      conversationId: userMessage.conversation_id,
      userMessage
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown agent error"
      },
      { status: 500 }
    );
  }
}
