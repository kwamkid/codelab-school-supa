// hooks/useChatRealtime.ts — Supabase Realtime subscriptions for chat

import { useEffect, useRef } from 'react';
import { getClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to new messages for a specific conversation.
 * Fires `onNewMessage` when a new row is inserted in `chat_messages`.
 */
export function useChatMessagesRealtime(
  conversationId: string | null,
  onNewMessage: (message: any) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    if (!conversationId) return;

    const supabase = getClient();

    channelRef.current = supabase
      .channel(`chat-msgs-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callbackRef.current(payload.new);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId]);
}

/**
 * Subscribe to conversation list updates (new conversations, unread count changes).
 * Fires on INSERT and UPDATE of `chat_conversations`.
 */
export function useChatConversationsRealtime(
  onConversationUpdate: (conversation: any, eventType: string) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onConversationUpdate);
  callbackRef.current = onConversationUpdate;

  useEffect(() => {
    const supabase = getClient();

    channelRef.current = supabase
      .channel('chat-convs-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
        },
        (payload) => {
          callbackRef.current(payload.new, payload.eventType);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);
}
