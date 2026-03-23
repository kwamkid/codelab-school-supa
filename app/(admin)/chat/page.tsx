'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getConversations, getMessages, sendMessage, markConversationRead, getConversation, addContactTag, removeContactTag, addContactBranch, updateContactInfo, unlinkContactFromParent } from '@/lib/services/chat';
import { useChatMessagesRealtime, useChatConversationsRealtime } from '@/hooks/useChatRealtime';
import { ChatConversation, ChatMessage, Branch } from '@/types/models';
import { getBranches } from '@/lib/services/branches';
import { getParent, getStudentsByParent } from '@/lib/services/parents';
import { useBranch } from '@/contexts/BranchContext';
import { toast } from 'sonner';
import ConversationList from '@/components/chat/conversation-list';
import MessageArea from '@/components/chat/message-area';
import ActionPanel from '@/components/chat/action-panel';
import { LinkParentModal } from '@/components/chat/link-parent-modal';
import { ChatSplitView, MobileView } from '@/components/chat/chat-layout';
import { TrialBookingForm } from '@/components/shared/trial-booking-form';
import { CompactEnrollmentForm } from '@/components/shared/compact-enrollment-form';
import { adminMutation } from '@/lib/admin-mutation';

type PanelView = 'info' | 'trial' | 'enrollment';

const MESSAGES_PER_PAGE = 50;

export default function ChatPage() {
  const { selectedBranchId } = useBranch();

  // State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedParent, setLinkedParent] = useState<{ id: string; displayName: string; phone: string; students?: { id: string; name: string }[] } | null>(null);
  const [panelView, setPanelView] = useState<PanelView>('info');

  // Counter for generating unique optimistic message IDs
  const optimisticIdRef = useRef(0);

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

  // Load branches on mount
  useEffect(() => {
    getBranches().then(setBranches).catch(() => {});
  }, []);

  // Load conversations on mount
  const CONVERSATIONS_PER_PAGE = 30;
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingConversations(true);
        const data = await getConversations({ limit: CONVERSATIONS_PER_PAGE });
        setConversations(data);
        setHasMoreConversations(data.length === CONVERSATIONS_PER_PAGE);
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setLoadingConversations(false);
      }
    };
    load();
  }, []);

  // Load more conversations (infinite scroll)
  const handleLoadMoreConversations = useCallback(async () => {
    if (loadingMoreConversations || !hasMoreConversations) return;
    try {
      setLoadingMoreConversations(true);
      const data = await getConversations({
        limit: CONVERSATIONS_PER_PAGE,
        offset: conversations.length,
      });
      setConversations(prev => [...prev, ...data]);
      setHasMoreConversations(data.length === CONVERSATIONS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more conversations:', error);
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [loadingMoreConversations, hasMoreConversations, conversations.length]);

  // Reset panel view when conversation changes
  useEffect(() => {
    setPanelView('info');
  }, [selectedConversationId]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      setHasMoreMessages(false);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const data = await getMessages(selectedConversationId, MESSAGES_PER_PAGE);
        setMessages(data);
        setHasMoreMessages(data.length === MESSAGES_PER_PAGE);
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

  // Load more (older) messages
  const handleLoadMoreMessages = useCallback(async () => {
    if (!selectedConversationId || loadingMoreMessages || !hasMoreMessages) return;
    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    try {
      setLoadingMoreMessages(true);
      const olderMessages = await getMessages(
        selectedConversationId,
        MESSAGES_PER_PAGE,
        oldestMessage.createdAt.toISOString()
      );
      setMessages(prev => [...olderMessages, ...prev]);
      setHasMoreMessages(olderMessages.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMoreMessages(false);
    }
  }, [selectedConversationId, loadingMoreMessages, hasMoreMessages, messages]);

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
        senderAvatarUrl: rawMessage.sender_avatar_url || undefined,
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
        // Replace optimistic message with real one (match by content + direction for outbound)
        if (message.direction === 'outbound') {
          const optimisticIdx = prev.findIndex(
            m => m.id.startsWith('optimistic-') && m.content === message.content && m.direction === 'outbound'
          );
          if (optimisticIdx !== -1) {
            const updated = [...prev];
            updated[optimisticIdx] = message;
            return updated;
          }
        }
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

  // Optimistic send message handler
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!selectedConversationId || !content.trim()) return;
      const trimmed = content.trim();

      // 1. Create optimistic message and add to local state immediately
      const tempId = `optimistic-${++optimisticIdRef.current}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        conversationId: selectedConversationId,
        direction: 'outbound',
        senderType: 'admin',
        messageType: 'text',
        content: trimmed,
        status: 'pending',
        createdAt: new Date(),
      };

      setMessages(prev => [...prev, optimisticMessage]);

      // Update conversation preview locally
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConversationId
            ? { ...c, lastMessagePreview: trimmed, lastMessageAt: new Date() }
            : c
        )
      );

      // 2. Send via API in background — don't block UI
      sendMessage(selectedConversationId, trimmed).catch((error) => {
        console.error('Error sending message:', error);
        // Mark optimistic message as failed
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId ? { ...m, status: 'failed' as const } : m
          )
        );
        toast.error('ส่งข้อความไม่สำเร็จ');
      });
    },
    [selectedConversationId]
  );

  // Refresh profile from platform API
  const handleRefreshProfile = useCallback(async () => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;

    try {
      const res = await fetch('/api/admin/chat/refresh-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Refresh profile error:', data);
        toast.error(`${data.error || 'ไม่สามารถรีเฟรชโปรไฟล์ได้'}${data.details ? ': ' + data.details : ''}`);
        return;
      }
      // Update local state
      updateLocalContact(contactId, {
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      });
      toast.success('รีเฟรชโปรไฟล์สำเร็จ');
    } catch {
      toast.error('ไม่สามารถรีเฟรชโปรไฟล์ได้');
    }
  }, [selectedConversation]);

  // Load linked parent when conversation changes
  useEffect(() => {
    if (!selectedConversation?.contact?.parentId) {
      setLinkedParent(null);
      return;
    }
    const loadParent = async () => {
      try {
        const parent = await getParent(selectedConversation.contact!.parentId!);
        if (!parent) { setLinkedParent(null); return; }
        const students = await getStudentsByParent(parent.id);
        setLinkedParent({
          id: parent.id,
          displayName: parent.displayName || '',
          phone: parent.phone || '',
          students: students.map(s => ({ id: s.id, name: s.name })),
        });
      } catch {
        setLinkedParent(null);
      }
    };
    loadParent();
  }, [selectedConversation?.contact?.parentId]);

  // Helper to update contact in local conversations state
  const updateLocalContact = useCallback((contactId: string, patch: Record<string, any>) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.contact?.id !== contactId) return c;
        return { ...c, contact: { ...c.contact, ...patch } };
      })
    );
  }, []);

  // Tag handlers
  const handleAddTag = useCallback(async (tag: string) => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;
    try {
      await addContactTag(contactId, tag);
      const currentTags = selectedConversation.contact?.tags || [];
      if (!currentTags.includes(tag)) {
        updateLocalContact(contactId, { tags: [...currentTags, tag] });
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  }, [selectedConversation, updateLocalContact]);

  const handleRemoveTag = useCallback(async (tag: string) => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;
    try {
      await removeContactTag(contactId, tag);
      const currentTags = selectedConversation.contact?.tags || [];
      updateLocalContact(contactId, { tags: currentTags.filter(t => t !== tag) });
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  }, [selectedConversation, updateLocalContact]);

  // Branch handlers
  const handleAddBranch = useCallback(async (branchId: string) => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;
    try {
      await addContactBranch(contactId, branchId);
      const currentBranches = selectedConversation.contact?.branchIds || [];
      if (!currentBranches.includes(branchId)) {
        updateLocalContact(contactId, { branchIds: [...currentBranches, branchId] });
      }
    } catch (error) {
      console.error('Error adding branch:', error);
    }
  }, [selectedConversation, updateLocalContact]);

  const handleRemoveBranch = useCallback(async (branchId: string) => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;
    try {
      const currentBranches = selectedConversation.contact?.branchIds || [];
      await updateContactInfo(contactId, { branchIds: currentBranches.filter(b => b !== branchId) });
      updateLocalContact(contactId, { branchIds: currentBranches.filter(b => b !== branchId) });
    } catch (error) {
      console.error('Error removing branch:', error);
    }
  }, [selectedConversation, updateLocalContact]);

  // Link/unlink parent
  const handleParentLinked = useCallback(async (parentId: string) => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;
    updateLocalContact(contactId, { parentId });
    // Load parent details
    try {
      const parent = await getParent(parentId);
      if (parent) {
        const students = await getStudentsByParent(parent.id);
        setLinkedParent({
          id: parent.id,
          displayName: parent.displayName || '',
          phone: parent.phone || '',
          students: students.map(s => ({ id: s.id, name: s.name })),
        });
      }
    } catch {}
  }, [selectedConversation, updateLocalContact]);

  const handleUnlinkParent = useCallback(async () => {
    const contactId = selectedConversation?.contact?.id;
    if (!contactId) return;
    try {
      await unlinkContactFromParent(contactId);
      updateLocalContact(contactId, { parentId: undefined });
      setLinkedParent(null);
    } catch (error) {
      console.error('Error unlinking parent:', error);
    }
  }, [selectedConversation, updateLocalContact]);

  // Action handlers — show inline forms in action panel
  const handleTrialBooking = useCallback(() => {
    setPanelView('trial');
    setMobileView('panel');
  }, []);

  const handleEnrollment = useCallback(() => {
    setPanelView('enrollment');
    setMobileView('panel');
  }, []);

  const handleFormCancel = useCallback(() => {
    setPanelView('info');
  }, []);

  // After successful trial booking from chat
  const handleTrialSuccess = useCallback(async (bookingId: string) => {
    setPanelView('info');
    const contact = selectedConversation?.contact;
    if (!contact) return;

    try {
      // Auto-tag "ทดลองเรียน"
      await addContactTag(contact.id, 'ทดลองเรียน');
      const currentTags = contact.tags || [];
      if (!currentTags.includes('ทดลองเรียน')) {
        updateLocalContact(contact.id, { tags: [...currentTags, 'ทดลองเรียน'] });
      }
      // Update conversation with trialBookingId
      await adminMutation({
        table: 'chat_conversations',
        operation: 'update',
        data: { trial_booking_id: bookingId },
        match: { id: selectedConversation!.id },
      });
    } catch {}

    toast.success('สร้างการจองทดลองเรียนสำเร็จ');
  }, [selectedConversation, updateLocalContact]);

  // After successful enrollment from chat
  const handleEnrollSuccess = useCallback(async (result: { enrollmentId: string; invoiceId?: string }) => {
    setPanelView('info');
    const contact = selectedConversation?.contact;
    if (!contact) return;

    try {
      // Auto-tag "ลงทะเบียน"
      await addContactTag(contact.id, 'ลงทะเบียน');
      const currentTags = contact.tags || [];
      if (!currentTags.includes('ลงทะเบียน')) {
        updateLocalContact(contact.id, { tags: [...currentTags, 'ลงทะเบียน'] });
      }
      // Update conversation with enrollmentId
      await adminMutation({
        table: 'chat_conversations',
        operation: 'update',
        data: { enrollment_id: result.enrollmentId },
        match: { id: selectedConversation!.id },
      });
    } catch {}

    toast.success('ลงทะเบียนสำเร็จ');
  }, [selectedConversation, updateLocalContact]);

  return (
    <>
      <ChatSplitView
        mobileView={mobileView}
        list={
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
            loading={loadingConversations}
            branches={branches}
            defaultBranchId={null}
            onLoadMore={handleLoadMoreConversations}
            hasMore={hasMoreConversations}
            loadingMore={loadingMoreConversations}
          />
        }
        messages={
          <MessageArea
            key={selectedConversationId || 'none'}
            conversation={selectedConversation}
            messages={messages}
            loading={loadingMessages}
            onSend={handleSendMessage}
            branches={branches}
            onBack={handleBack}
            onTogglePanel={handleTogglePanel}
            onTrialBooking={handleTrialBooking}
            onEnrollment={handleEnrollment}
            hasMore={hasMoreMessages}
            loadingMore={loadingMoreMessages}
            onLoadMore={handleLoadMoreMessages}
          />
        }
        panel={
          <ActionPanel
            conversation={selectedConversation}
            branches={branches}
            panelView={panelView}
            onTrialBooking={handleTrialBooking}
            onEnrollment={handleEnrollment}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onAddBranch={handleAddBranch}
            onRemoveBranch={handleRemoveBranch}
            onLinkParent={() => setShowLinkModal(true)}
            onUnlinkParent={handleUnlinkParent}
            onRefreshProfile={handleRefreshProfile}
            linkedParent={linkedParent}
            onBack={() => {
              if (panelView !== 'info') {
                setPanelView('info');
              } else {
                setMobileView('messages');
              }
            }}
            trialFormNode={
              panelView === 'trial' ? (
                <TrialBookingForm
                  context="chat"
                  prefill={{
                    parentName: selectedConversation?.contact?.displayName,
                    parentPhone: selectedConversation?.contact?.phone,
                    parentId: selectedConversation?.contact?.parentId,
                    contactId: selectedConversation?.contact?.id,
                    conversationId: selectedConversation?.id,
                    branchId: selectedBranchId || undefined,
                  }}
                  onSuccess={handleTrialSuccess}
                  onCancel={handleFormCancel}
                />
              ) : null
            }
            enrollFormNode={
              panelView === 'enrollment' ? (
                <CompactEnrollmentForm
                  context="chat"
                  prefill={{
                    parentId: selectedConversation?.contact?.parentId,
                    parentName: selectedConversation?.contact?.displayName,
                    parentPhone: selectedConversation?.contact?.phone,
                    contactId: selectedConversation?.contact?.id,
                    conversationId: selectedConversation?.id,
                    branchId: selectedBranchId || undefined,
                  }}
                  onSuccess={handleEnrollSuccess}
                  onCancel={handleFormCancel}
                />
              ) : null
            }
          />
        }
      />

      {/* Link Parent Modal */}
      {selectedConversation?.contact && (
        <LinkParentModal
          open={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          contactId={selectedConversation.contact.id}
          contactName={selectedConversation.contact.displayName}
          contactPhone={selectedConversation.contact.phone}
          onLinked={handleParentLinked}
        />
      )}

    </>
  );
}
