// lib/services/chat.ts — Client-side chat service

import {
  ChatChannel,
  ChatContact,
  ChatConversation,
  ChatMessage,
  ChatQuickReply,
} from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

// === Row mappers ===

function mapChannel(row: any): ChatChannel {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    platformId: row.platform_id || undefined,
    platformName: row.platform_name || undefined,
    platformAvatarUrl: row.platform_avatar_url || undefined,
    credentials: row.credentials || {},
    webhookSecret: row.webhook_secret || undefined,
    webhookVerified: row.webhook_verified || false,
    isActive: row.is_active ?? true,
    branchId: row.branch_id || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

function mapContact(row: any): ChatContact {
  return {
    id: row.id,
    channelId: row.channel_id,
    platformUserId: row.platform_user_id,
    displayName: row.display_name || undefined,
    avatarUrl: row.avatar_url || undefined,
    parentId: row.parent_id || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    tags: row.tags || [],
    branchIds: row.branch_ids || [],
    isGroup: row.is_group || false,
    groupId: row.group_id || undefined,
    memberCount: row.member_count || undefined,
    customData: row.custom_data || undefined,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

function mapConversation(row: any): ChatConversation {
  return {
    id: row.id,
    channelId: row.channel_id,
    contactId: row.contact_id,
    status: row.status,
    assignedTo: row.assigned_to || undefined,
    unreadCount: row.unread_count || 0,
    lastMessagePreview: row.last_message_preview || undefined,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
    trialBookingId: row.trial_booking_id || undefined,
    enrollmentId: row.enrollment_id || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    contact: row.chat_contacts ? mapContact(row.chat_contacts) : undefined,
    channel: row.chat_channels ? mapChannel(row.chat_channels) : undefined,
  };
}

function mapMessage(row: any): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    senderType: row.sender_type,
    senderId: row.sender_id || undefined,
    senderName: row.sender_name || undefined,
    senderAvatarUrl: row.sender_avatar_url || undefined,
    messageType: row.message_type,
    content: row.content || undefined,
    mediaUrl: row.media_url || undefined,
    mediaMetadata: row.media_metadata || undefined,
    platformMessageId: row.platform_message_id || undefined,
    status: row.status,
    errorMessage: row.error_message || undefined,
    metadata: row.metadata || undefined,
    createdAt: new Date(row.created_at),
  };
}

function mapQuickReply(row: any): ChatQuickReply {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category || 'general',
    sortOrder: row.sort_order || 0,
    isActive: row.is_active ?? true,
    createdBy: row.created_by || undefined,
    createdAt: new Date(row.created_at),
  };
}

// === Channels ===

export async function getChannels(): Promise<ChatChannel[]> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('chat_channels')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapChannel);
}

export async function getChannel(id: string): Promise<ChatChannel | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('chat_channels')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapChannel(data) : null;
}

export async function createChannel(data: {
  type: ChatChannel['type'];
  name: string;
  platformId?: string;
  platformName?: string;
  credentials: Record<string, string>;
  branchId?: string;
  createdBy?: string;
}): Promise<string> {
  const result = await adminMutation<{ id: string }[]>({
    table: 'chat_channels',
    operation: 'insert',
    data: {
      type: data.type,
      name: data.name,
      platform_id: data.platformId || null,
      platform_name: data.platformName || null,
      credentials: data.credentials,
      is_active: true,
      branch_id: data.branchId || null,
      created_by: data.createdBy || null,
    },
    options: { select: 'id', single: true },
  });
  return (result as any).id;
}

export async function updateChannel(id: string, data: Partial<{
  name: string;
  credentials: Record<string, string>;
  isActive: boolean;
  platformId: string;
  platformName: string;
  webhookVerified: boolean;
}>): Promise<void> {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.credentials !== undefined) updateData.credentials = data.credentials;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;
  if (data.platformId !== undefined) updateData.platform_id = data.platformId;
  if (data.platformName !== undefined) updateData.platform_name = data.platformName;
  if (data.webhookVerified !== undefined) updateData.webhook_verified = data.webhookVerified;

  await adminMutation({
    table: 'chat_channels',
    operation: 'update',
    data: updateData,
    match: { id },
  });
}

export async function deleteChannel(id: string): Promise<void> {
  await adminMutation({
    table: 'chat_channels',
    operation: 'delete',
    data: {},
    match: { id },
  });
}

// === Conversations ===

export async function getConversations(filters?: {
  channelId?: string;
  channelType?: string;
  status?: string;
  assignedTo?: string;
  search?: string;
}): Promise<ChatConversation[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('chat_conversations')
    .select('*, chat_contacts(*), chat_channels(id, type, name)')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (filters?.channelId) query = query.eq('channel_id', filters.channelId);
  if (filters?.channelType) query = query.eq('chat_channels.type', filters.channelType);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

  const { data, error } = await query;
  if (error) throw error;

  let conversations = (data || []).map(mapConversation);

  // Client-side search by contact name/phone
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    conversations = conversations.filter(c =>
      c.contact?.displayName?.toLowerCase().includes(q) ||
      c.contact?.phone?.includes(q) ||
      c.lastMessagePreview?.toLowerCase().includes(q)
    );
  }

  return conversations;
}

export async function getConversation(id: string): Promise<ChatConversation | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('chat_conversations')
    .select('*, chat_contacts(*), chat_channels(id, type, name)')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapConversation(data) : null;
}

export async function assignConversation(conversationId: string, adminUserId: string): Promise<void> {
  await adminMutation({
    table: 'chat_conversations',
    operation: 'update',
    data: {
      assigned_to: adminUserId,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    },
    match: { id: conversationId },
  });
}

export async function resolveConversation(conversationId: string): Promise<void> {
  await adminMutation({
    table: 'chat_conversations',
    operation: 'update',
    data: {
      status: 'resolved',
      unread_count: 0,
      updated_at: new Date().toISOString(),
    },
    match: { id: conversationId },
  });
}

export async function reopenConversation(conversationId: string): Promise<void> {
  await adminMutation({
    table: 'chat_conversations',
    operation: 'update',
    data: {
      status: 'open',
      updated_at: new Date().toISOString(),
    },
    match: { id: conversationId },
  });
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await adminMutation({
    table: 'chat_conversations',
    operation: 'update',
    data: {
      unread_count: 0,
      updated_at: new Date().toISOString(),
    },
    match: { id: conversationId },
  });
}

export async function updateConversationAction(conversationId: string, data: {
  trialBookingId?: string;
  enrollmentId?: string;
}): Promise<void> {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.trialBookingId !== undefined) updateData.trial_booking_id = data.trialBookingId;
  if (data.enrollmentId !== undefined) updateData.enrollment_id = data.enrollmentId;

  await adminMutation({
    table: 'chat_conversations',
    operation: 'update',
    data: updateData,
    match: { id: conversationId },
  });
}

// === Messages ===

export async function getMessages(conversationId: string, limit = 50, before?: string): Promise<ChatMessage[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapMessage).reverse(); // reverse to show oldest first
}

export async function sendMessage(conversationId: string, content: string, messageType = 'text', mediaUrl?: string): Promise<void> {
  const res = await fetch('/api/admin/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, content, messageType, mediaUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send message');
  }
}

// === Contacts ===

export async function getContact(id: string): Promise<ChatContact | null> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('chat_contacts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapContact(data) : null;
}

export async function linkContactToParent(contactId: string, parentId: string): Promise<void> {
  await adminMutation({
    table: 'chat_contacts',
    operation: 'update',
    data: {
      parent_id: parentId,
      updated_at: new Date().toISOString(),
    },
    match: { id: contactId },
  });
}

export async function updateContactInfo(contactId: string, data: {
  phone?: string;
  email?: string;
  tags?: string[];
  branchIds?: string[];
}): Promise<void> {
  const updateData: any = { updated_at: new Date().toISOString() };
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.branchIds !== undefined) updateData.branch_ids = data.branchIds;

  await adminMutation({
    table: 'chat_contacts',
    operation: 'update',
    data: updateData,
    match: { id: contactId },
  });
}

export async function addContactBranch(contactId: string, branchId: string): Promise<void> {
  const contact = await getContact(contactId);
  if (!contact) return;
  const branchIds = contact.branchIds || [];
  if (!branchIds.includes(branchId)) {
    await updateContactInfo(contactId, { branchIds: [...branchIds, branchId] });
  }
}

export async function addContactTag(contactId: string, tag: string): Promise<void> {
  const contact = await getContact(contactId);
  if (!contact) return;
  const tags = contact.tags || [];
  if (!tags.includes(tag)) {
    await updateContactInfo(contactId, { tags: [...tags, tag] });
  }
}

export async function removeContactTag(contactId: string, tag: string): Promise<void> {
  const contact = await getContact(contactId);
  if (!contact) return;
  await updateContactInfo(contactId, { tags: (contact.tags || []).filter(t => t !== tag) });
}

export async function unlinkContactFromParent(contactId: string): Promise<void> {
  await adminMutation({
    table: 'chat_contacts',
    operation: 'update',
    data: {
      parent_id: null,
      updated_at: new Date().toISOString(),
    },
    match: { id: contactId },
  });
}

// === Quick Replies ===

export async function getQuickReplies(category?: string): Promise<ChatQuickReply[]> {
  const supabase = getClient();
  let query = (supabase as any)
    .from('chat_quick_replies')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapQuickReply);
}

export async function createQuickReply(data: {
  title: string;
  content: string;
  category?: string;
  createdBy?: string;
}): Promise<string> {
  const result = await adminMutation<{ id: string }[]>({
    table: 'chat_quick_replies',
    operation: 'insert',
    data: {
      title: data.title,
      content: data.content,
      category: data.category || 'general',
      created_by: data.createdBy || null,
    },
    options: { select: 'id', single: true },
  });
  return (result as any).id;
}

export async function deleteQuickReply(id: string): Promise<void> {
  await adminMutation({
    table: 'chat_quick_replies',
    operation: 'update',
    data: { is_active: false },
    match: { id },
  });
}

// === Unread Count (for sidebar badge) ===

export async function getTotalUnreadCount(): Promise<number> {
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('chat_conversations')
    .select('unread_count')
    .gt('unread_count', 0);
  if (error) return 0;
  return (data || []).reduce((sum: number, row: any) => sum + (row.unread_count || 0), 0);
}
