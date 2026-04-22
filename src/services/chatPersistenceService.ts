import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from '@/types';

type ChatMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent_id: string | null;
  thinking: string | null;
  thinking_duration: number | null;
  is_streaming: boolean | null;
  created_at: string;
};

type ChatConversationRow = {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  conversation_type: string | null;
  chat_messages?: ChatMessageRow[];
};

function toDate(value: string | null | undefined): Date {
  return value ? new Date(value) : new Date();
}

function toMessage(row: ChatMessageRow): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content || '',
    timestamp: toDate(row.created_at),
    agentId: row.agent_id || undefined,
    thinking: row.thinking || undefined,
    thinkingDuration: row.thinking_duration ?? undefined,
    isStreaming: Boolean(row.is_streaming),
  };
}

function toConversation(row: ChatConversationRow): Conversation {
  const messages = [...(row.chat_messages || [])]
    .sort((a, b) => toDate(a.created_at).getTime() - toDate(b.created_at).getTime())
    .map(toMessage);

  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title || 'Nova conversa',
    messages,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    conversationType: row.conversation_type || 'regular',
  };
}

export async function loadPersistedConversations(params: {
  userId: string;
  tenantId: string;
  conversationType?: string;
}): Promise<Conversation[]> {
  const { userId, tenantId, conversationType } = params;

  let query = (supabase as any)
    .from('chat_conversations')
    .select(`
      id,
      agent_id,
      title,
      created_at,
      updated_at,
      conversation_type,
      chat_messages (
        id,
        role,
        content,
        agent_id,
        thinking,
        thinking_duration,
        is_streaming,
        created_at
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: true, foreignTable: 'chat_messages' });

  if (conversationType) {
    query = query.eq('conversation_type', conversationType);
  } else {
    query = query.neq('conversation_type', 'gemz');
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || 'Falha ao carregar histórico de conversas.');
  }

  return ((data || []) as ChatConversationRow[]).map(toConversation);
}

export async function loadGemzConversations(params: {
  userId: string;
  tenantId: string;
}): Promise<Conversation[]> {
  return loadPersistedConversations({ ...params, conversationType: 'gemz' });
}

export async function persistConversation(params: {
  conversation: Conversation;
  userId: string;
  tenantId: string;
  conversationType?: string;
}): Promise<void> {
  const { conversation, userId, tenantId, conversationType } = params;

  const payload = {
    id: conversation.id,
    tenant_id: tenantId,
    user_id: userId,
    agent_id: conversation.agentId,
    title: conversation.title || 'Nova conversa',
    created_at: conversation.createdAt.toISOString(),
    updated_at: conversation.updatedAt.toISOString(),
    conversation_type: conversationType || conversation.conversationType || 'regular',
  };

  const { error } = await (supabase as any)
    .from('chat_conversations')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message || 'Falha ao salvar conversa.');
  }
}

export async function persistMessage(params: {
  conversationId: string;
  message: Message;
  userId: string;
  tenantId: string;
}): Promise<void> {
  const { conversationId, message, userId, tenantId } = params;

  const payload = {
    id: message.id,
    conversation_id: conversationId,
    tenant_id: tenantId,
    user_id: userId,
    agent_id: message.agentId ?? null,
    role: message.role,
    content: message.content || '',
    thinking: message.thinking ?? null,
    thinking_duration: message.thinkingDuration ?? null,
    is_streaming: Boolean(message.isStreaming),
    created_at: message.timestamp.toISOString(),
  };

  const { error } = await (supabase as any)
    .from('chat_messages')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(error.message || 'Falha ao salvar mensagem.');
  }
}

export async function deletePersistedMessage(params: {
  messageId: string;
  userId: string;
  tenantId: string;
}): Promise<void> {
  const { messageId, userId, tenantId } = params;
  const { error } = await (supabase as any)
    .from('chat_messages')
    .delete()
    .eq('id', messageId)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(error.message || 'Falha ao excluir mensagem.');
  }
}

export async function deletePersistedConversation(params: {
  conversationId: string;
  userId: string;
  tenantId: string;
}): Promise<void> {
  const { conversationId, userId, tenantId } = params;
  const { error } = await (supabase as any)
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(error.message || 'Falha ao excluir conversa.');
  }
}

export async function updateConversationTitle(params: {
  conversationId: string;
  title: string;
  userId: string;
  tenantId: string;
}): Promise<void> {
  const { conversationId, title, userId, tenantId } = params;
  const { error } = await (supabase as any)
    .from('chat_conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(error.message || 'Falha ao atualizar título da conversa.');
  }
}
