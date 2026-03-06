'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getConversations, getMessages, sendMessage, markConversationRead, getConversation } from '@/lib/services/chat';
import { useChatMessagesRealtime, useChatConversationsRealtime } from '@/hooks/useChatRealtime';
import { ChatConversation, ChatMessage } from '@/types/models';
import ConversationList from '@/components/chat/conversation-list';
import MessageArea from '@/components/chat/message-area';
import ActionPanel from '@/components/chat/action-panel';
import { ChatSplitView, MobileView } from '@/components/chat/chat-layout';

export default function ChatPage() {
  const router = useRouter();

  // State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');

  // Refs
  const sendingRef = useRef(false);

  // Derived state
  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;

  // Mobile: select conversation → switch to messages view
  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    setMobileView('messages');
  }, []);

  // Mobile: back to conversation list
  const handleBack = useCallback(() => {
    setMobileView('list');
    setSelectedConversationId(null);
  }, []);

  // Mobile: toggle action panel
  const handleTogglePanel = useCallback(() => {
    setMobileView(prev => prev === 'panel' ? 'messages' : 'panel');
  }, []);

  // Load conversations on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingConversations(true);
        const data = await getConversations();
        setConversations(data);
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setLoadingConversations(false);
      }
    };
    load();
  }, []);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await getMessages(selectedConversationId);
        setMessages(data);
        // Mark as read
        await markConversationRead(selectedConversationId);
        // Update unread count in local state
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedConversationId]);

  // Realtime: new messages for active conversation
  const handleNewMessage = useCallback(
    (rawMessage: any) => {
      if (!selectedConversationId) return;

      const message: ChatMessage = {
        id: rawMessage.id,
        conversationId: rawMessage.conversation_id,
        direction: rawMessage.direction,
        senderType: rawMessage.sender_type,
        senderId: rawMessage.sender_id || undefined,
        senderName: rawMessage.sender_name || undefined,
        messageType: rawMessage.message_type,
        content: rawMessage.content || undefined,
        mediaUrl: rawMessage.media_url || undefined,
        mediaMetadata: rawMessage.media_metadata || undefined,
        platformMessageId: rawMessage.platform_message_id || undefined,
        status: rawMessage.status,
        errorMessage: rawMessage.error_message || undefined,
        metadata: rawMessage.metadata || undefined,
        createdAt: new Date(rawMessage.created_at),
      };

      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });

      // Mark as read since user is viewing this conversation
      markConversationRead(selectedConversationId).catch(() => {});
    },
    [selectedConversationId]
  );

  useChatMessagesRealtime(selectedConversationId, handleNewMessage);

  // Realtime: conversation list updates
  const handleConversationUpdate = useCallback(
    async (rawConversation: any, eventType: string) => {
      try {
        // Reload the full conversation with joined contact/channel data
        const updated = await getConversation(rawConversation.id);
        if (!updated) return;

        setConversations(prev => {
          const exists = prev.find(c => c.id === updated.id);
          if (exists) {
            // Update existing conversation
            const newList = prev.map(c => (c.id === updated.id ? updated : c));
            // Re-sort by lastMessageAt descending
            newList.sort((a, b) => {
              const aTime = a.lastMessageAt?.getTime() || 0;
              const bTime = b.lastMessageAt?.getTime() || 0;
              return bTime - aTime;
            });
            return newList;
          } else if (eventType === 'INSERT') {
            // New conversation — prepend
            return [updated, ...prev];
          }
          return prev;
        });

        // If this is the active conversation, reset unread
        if (rawConversation.id === selectedConversationId) {
          setConversations(prev =>
            prev.map(c =>
              c.id === selectedConversationId ? { ...c, unreadCount: 0 } : c
            )
          );
        }
      } catch (error) {
        console.error('Error handling conversation update:', error);
      }
    },
    [selectedConversationId]
  );

  useChatConversationsRealtime(handleConversationUpdate);

  // Send message handler
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedConversationId || !content.trim()) return;
      if (sendingRef.current) return;

      try {
        sendingRef.current = true;
        setSending(true);
        await sendMessage(selectedConversationId, content.trim());
      } catch (error) {
        console.error('Error sending message:', error);
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [selectedConversationId]
  );

  // Action handlers
  const handleTrialBooking = useCallback(() => {
    if (!selectedConversation?.contact) return;
    const contact = selectedConversation.contact;
    const params = new URLSearchParams({
      from: 'chat',
      contactId: contact.id,
      conversationId: selectedConversation.id,
    });
    if (contact.displayName) params.set('name', contact.displayName);
    if (contact.phone) params.set('phone', contact.phone);
    router.push(`/trial/new?${params.toString()}`);
  }, [selectedConversation, router]);

  const handleEnrollment = useCallback(() => {
    if (!selectedConversation?.contact) return;
    const contact = selectedConversation.contact;
    const params = new URLSearchParams({
      from: 'chat',
      contactId: contact.id,
      conversationId: selectedConversation.id,
    });
    router.push(`/enrollments/new?${params.toString()}`);
  }, [selectedConversation, router]);

  return (
    <ChatSplitView
      mobileView={mobileView}
      list={
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          loading={loadingConversations}
        />
      }
      messages={
        <MessageArea
          conversation={selectedConversation}
          messages={messages}
          loading={loadingMessages}
          sending={sending}
          onSend={handleSendMessage}
          onBack={handleBack}
          onTogglePanel={handleTogglePanel}
        />
      }
      panel={
        <ActionPanel
          conversation={selectedConversation}
          onTrialBooking={handleTrialBooking}
          onEnrollment={handleEnrollment}
          onBack={() => setMobileView('messages')}
        />
      }
    />
  );
}
