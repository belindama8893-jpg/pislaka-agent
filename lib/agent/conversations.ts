import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentChatRole = "user" | "assistant";

export type AgentChatMessageRecord = {
  id: string;
  conversation_id: string;
  broker_id: string;
  role: AgentChatRole;
  content: string;
  message_type: string;
  structured_payload: Record<string, unknown> | null;
  created_at: string;
};

type MessageInsertInput = {
  conversationId?: string;
  brokerId: string;
  role: AgentChatRole;
  content: string;
  messageType?: string;
  structuredPayload?: Record<string, unknown>;
};

type MessageListOptions = {
  before?: string;
  limit?: number;
};

const defaultConversationTitle = "Pislaka Agent";

export async function getOrCreateActiveAgentConversation(supabase: SupabaseClient, brokerId: string) {
  const { data: existing, error: readError } = await supabase
    .from("conversations")
    .select("id")
    .eq("broker_id", brokerId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  if (existing?.id) {
    return { id: existing.id as string };
  }

  const { data: created, error: insertError } = await supabase
    .from("conversations")
    .insert({
      broker_id: brokerId,
      title: defaultConversationTitle,
      status: "active"
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    throw new Error(insertError?.message ?? "Unable to create agent conversation");
  }

  return { id: created.id as string };
}

export async function insertAgentChatMessage(supabase: SupabaseClient, input: MessageInsertInput) {
  const conversation = input.conversationId
    ? { id: input.conversationId }
    : await getOrCreateActiveAgentConversation(supabase, input.brokerId);

  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversation.id,
      broker_id: input.brokerId,
      role: input.role,
      content: input.content,
      message_type: input.messageType ?? "text",
      structured_payload: input.structuredPayload ?? null
    })
    .select("id, conversation_id, broker_id, role, content, message_type, structured_payload, created_at")
    .single();

  if (error || !message) {
    throw new Error(error?.message ?? "Unable to save chat message");
  }

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id)
    .eq("broker_id", input.brokerId);

  return message as AgentChatMessageRecord;
}

export async function getAgentChatMessages(
  supabase: SupabaseClient,
  brokerId: string,
  options: MessageListOptions = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const conversation = await getOrCreateActiveAgentConversation(supabase, brokerId);

  let query = supabase
    .from("chat_messages")
    .select("id, conversation_id, broker_id, role, content, message_type, structured_payload, created_at")
    .eq("conversation_id", conversation.id)
    .eq("broker_id", brokerId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as AgentChatMessageRecord[]).slice(0, limit);

  return {
    conversationId: conversation.id,
    messages: rows.reverse(),
    hasMore: (data ?? []).length > limit
  };
}

export async function getRecentAgentContextMessages(
  supabase: SupabaseClient,
  brokerId: string,
  limit = 20
) {
  const { messages } = await getAgentChatMessages(supabase, brokerId, { limit });

  return messages
    .filter((message) => message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}
