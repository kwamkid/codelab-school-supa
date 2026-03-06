// lib/services/chat-webhook.ts — Server-side webhook handler (uses createServiceClient)

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Find or create a chat contact by platform user ID.
 */
export async function findOrCreateContact(
  channelId: string,
  platformUserId: string,
  displayName?: string,
  avatarUrl?: string
): Promise<string> {
  const supabase = createServiceClient();

  // Try to find existing contact
  const { data: existing } = await (supabase as any)
    .from('chat_contacts')
    .select('id')
    .eq('channel_id', channelId)
    .eq('platform_user_id', platformUserId)
    .single();

  if (existing) {
    // Update display name / avatar if changed
    if (displayName || avatarUrl) {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (displayName) updateData.display_name = displayName;
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      await (supabase as any)
        .from('chat_contacts')
        .update(updateData)
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new contact
  const { data: newContact, error } = await (supabase as any)
    .from('chat_contacts')
    .insert({
      channel_id: channelId,
      platform_user_id: platformUserId,
      display_name: displayName || platformUserId,
      avatar_url: avatarUrl || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newContact.id;
}

/**
 * Find or create a conversation for a contact.
 */
export async function findOrCreateConversation(
  channelId: string,
  contactId: string
): Promise<string> {
  const supabase = createServiceClient();

  const { data: existing } = await (supabase as any)
    .from('chat_conversations')
    .select('id')
    .eq('contact_id', contactId)
    .single();

  if (existing) return existing.id;

  const { data: newConv, error } = await (supabase as any)
    .from('chat_conversations')
    .insert({
      channel_id: channelId,
      contact_id: contactId,
      status: 'open',
      unread_count: 0,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newConv.id;
}

/**
 * Process an inbound message from any channel (LINE, FB, IG).
 * Called by webhook handlers.
 */
export async function processInboundMessage(params: {
  channelId: string;
  platformUserId: string;
  senderName?: string;
  senderAvatar?: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  platformMessageId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // 1. Find or create contact
  const contactId = await findOrCreateContact(
    params.channelId,
    params.platformUserId,
    params.senderName,
    params.senderAvatar
  );

  // 2. Find or create conversation
  const conversationId = await findOrCreateConversation(params.channelId, contactId);

  // 3. Insert message
  const preview = params.content
    ? params.content.substring(0, 100)
    : params.messageType === 'image' ? '[รูปภาพ]'
    : params.messageType === 'sticker' ? '[สติกเกอร์]'
    : params.messageType === 'audio' ? '[เสียง]'
    : params.messageType === 'video' ? '[วิดีโอ]'
    : params.messageType === 'location' ? '[ตำแหน่ง]'
    : params.messageType === 'file' ? '[ไฟล์]'
    : `[${params.messageType}]`;

  await (supabase as any)
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      direction: 'inbound',
      sender_type: 'contact',
      sender_id: params.platformUserId,
      sender_name: params.senderName || null,
      message_type: params.messageType,
      content: params.content || null,
      media_url: params.mediaUrl || null,
      platform_message_id: params.platformMessageId || null,
      metadata: params.metadata || {},
      status: 'delivered',
    });

  // 4. Update conversation counters
  // Use raw SQL via rpc or just update with increment
  const { data: conv } = await (supabase as any)
    .from('chat_conversations')
    .select('unread_count')
    .eq('id', conversationId)
    .single();

  await (supabase as any)
    .from('chat_conversations')
    .update({
      unread_count: (conv?.unread_count || 0) + 1,
      last_message_preview: preview,
      last_message_at: now,
      status: 'open', // reopen if resolved
      updated_at: now,
    })
    .eq('id', conversationId);

  // 5. Update contact last_message_at
  await (supabase as any)
    .from('chat_contacts')
    .update({ last_message_at: now, updated_at: now })
    .eq('id', contactId);
}

/**
 * Get a chat channel by type and platform ID.
 */
export async function getChannelByPlatform(
  type: string,
  platformId?: string
): Promise<{ id: string; credentials: any } | null> {
  const supabase = createServiceClient();
  let query = (supabase as any)
    .from('chat_channels')
    .select('id, credentials')
    .eq('type', type)
    .eq('is_active', true);

  if (platformId) {
    query = query.eq('platform_id', platformId);
  }

  const { data } = await query.limit(1).single();
  return data || null;
}

/**
 * Get a chat channel by ID with full data.
 */
export async function getChannelById(
  channelId: string
): Promise<{ id: string; type: string; credentials: any; platform_id: string } | null> {
  const supabase = createServiceClient();
  const { data } = await (supabase as any)
    .from('chat_channels')
    .select('id, type, credentials, platform_id')
    .eq('id', channelId)
    .single();
  return data || null;
}

/**
 * Get conversation with contact info (server-side).
 */
export async function getConversationWithContact(
  conversationId: string
): Promise<{ conversation: any; contact: any; channel: any } | null> {
  const supabase = createServiceClient();
  const { data } = await (supabase as any)
    .from('chat_conversations')
    .select('*, chat_contacts(*), chat_channels(id, type, credentials, platform_id)')
    .eq('id', conversationId)
    .single();

  if (!data) return null;

  return {
    conversation: data,
    contact: data.chat_contacts,
    channel: data.chat_channels,
  };
}

/**
 * Insert an outbound message and update conversation.
 */
export async function insertOutboundMessage(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  platformMessageId?: string;
  status?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const preview = params.content
    ? params.content.substring(0, 100)
    : `[${params.messageType}]`;

  await (supabase as any)
    .from('chat_messages')
    .insert({
      conversation_id: params.conversationId,
      direction: 'outbound',
      sender_type: 'admin',
      sender_id: params.senderId,
      sender_name: params.senderName,
      message_type: params.messageType,
      content: params.content || null,
      media_url: params.mediaUrl || null,
      platform_message_id: params.platformMessageId || null,
      status: params.status || 'sent',
    });

  await (supabase as any)
    .from('chat_conversations')
    .update({
      last_message_preview: preview,
      last_message_at: now,
      updated_at: now,
    })
    .eq('id', params.conversationId);
}
