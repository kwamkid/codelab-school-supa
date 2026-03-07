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
import { ResponsiveFormDialog } from '@/components/shared/responsive-form-dialog';
import { TrialBookingForm } from '@/components/shared/trial-booking-form';
import { CompactEnrollmentForm } from '@/components/shared/compact-enrollment-form';
import { adminMutation } from '@/lib/admin-mutation';

export default function ChatPage() {
  const { selectedBranchId } = useBranch();

  // State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkedParent, setLinkedParent] = useState<{ id: string; displayName: string; phone: string; students?: { id: string; name: string }[] } | null>(null);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);

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

  // Load branches on mount
  useEffect(() => {
    getBranches().then(setBranches).catch(() => {});
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

  // Action handlers — open dialogs instead of navigating
  const handleTrialBooking = useCallback(() => {
    setShowTrialDialog(true);
  }, []);

  const handleEnrollment = useCallback(() => {
    setShowEnrollDialog(true);
  }, []);

  // After successful trial booking from chat
  const handleTrialSuccess = useCallback(async (bookingId: string) => {
    setShowTrialDialog(false);
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
    setShowEnrollDialog(false);
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
            defaultBranchId={selectedBranchId}
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
            branches={branches}
            onTrialBooking={handleTrialBooking}
            onEnrollment={handleEnrollment}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onAddBranch={handleAddBranch}
            onRemoveBranch={handleRemoveBranch}
            onLinkParent={() => setShowLinkModal(true)}
            onUnlinkParent={handleUnlinkParent}
            linkedParent={linkedParent}
            onBack={() => setMobileView('messages')}
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

      {/* Trial Booking Dialog */}
      <ResponsiveFormDialog
        open={showTrialDialog}
        onOpenChange={setShowTrialDialog}
        title="จองทดลองเรียน"
      >
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
          onCancel={() => setShowTrialDialog(false)}
        />
      </ResponsiveFormDialog>

      {/* Enrollment Dialog */}
      <ResponsiveFormDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
        title="ลงทะเบียน"
      >
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
          onCancel={() => setShowEnrollDialog(false)}
        />
      </ResponsiveFormDialog>
    </>
  );
}
