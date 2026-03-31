'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SectionLoading } from '@/components/ui/loading';
import { ChatConversation, Branch } from '@/types/models';
import { ConversationItem } from './conversation-item';
import { ConversationFilters, ChatFilters, DEFAULT_FILTERS } from './conversation-filters';

interface ConversationListProps {
  conversations: ChatConversation[];
  selectedId?: string | null;
  activeConversationId?: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  branches: Branch[];
  defaultBranchId?: string | null;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export default function ConversationList({
  conversations,
  selectedId,
  activeConversationId,
  onSelect,
  loading,
  branches,
  defaultBranchId,
  onLoadMore,
  hasMore,
  loadingMore,
}: ConversationListProps) {
  const activeId = selectedId ?? activeConversationId ?? null;
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ChatFilters>({
    ...DEFAULT_FILTERS,
    branchId: defaultBranchId || null,
  });

  // Collect all unique tags from conversations for the filter UI
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    conversations.forEach(c => {
      c.contact?.tags?.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [conversations]);

  const filtered = useMemo(() => {
    let result = conversations;

    // Platform filter
    if (filters.platform === 'line') {
      result = result.filter((c) => c.channel?.type === 'line');
    } else if (filters.platform === 'facebook_instagram') {
      result = result.filter(
        (c) => c.channel?.type === 'facebook' || c.channel?.type === 'instagram'
      );
    }

    // Branch filter
    if (filters.branchId) {
      result = result.filter((c) =>
        c.contact?.branchIds?.includes(filters.branchId!)
      );
    }

    // Tags filter
    if (filters.tags.length > 0) {
      result = result.filter((c) =>
        filters.tags.some(t => c.contact?.tags?.includes(t))
      );
    }

    // Link status filter
    if (filters.linkStatus === 'linked') {
      result = result.filter((c) => !!c.contact?.parentId);
    } else if (filters.linkStatus === 'unlinked') {
      result = result.filter((c) => !c.contact?.parentId);
    }

    // Unread only
    if (filters.unreadOnly) {
      result = result.filter((c) => c.unreadCount > 0);
    }

    // Search filter — match name, phone, tags, last message
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.displayName?.toLowerCase() || '';
        const preview = c.lastMessagePreview?.toLowerCase() || '';
        const phone = c.contact?.phone?.toLowerCase() || '';
        const tags = c.contact?.tags?.join(' ').toLowerCase() || '';
        return name.includes(q) || preview.includes(q) || phone.includes(q) || tags.includes(q);
      });
    }

    // Sort: by last message time descending (newest first)
    result = [...result].sort((a, b) => {
      const aTime = a.lastMessageAt?.getTime() || 0;
      const bTime = b.lastMessageAt?.getTime() || 0;
      return bTime - aTime;
    });

    return result;
  }, [conversations, filters, search]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      {/* Search */}
      <div className="p-3 border-b dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="ค้นหาชื่อ, เบอร์, แท็ก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-base"
          />
        </div>
      </div>

      {/* Filters */}
      <ConversationFilters
        filters={filters}
        onFiltersChange={setFilters}
        branches={branches}
        availableTags={availableTags}
      />

      {/* Conversation list */}
      <div
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          if (!onLoadMore || !hasMore || loadingMore) return;
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
            onLoadMore();
          }
        }}
      >
        {loading ? (
          <SectionLoading />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Search className="w-10 h-10 mb-3" />
            <p className="text-base">
              {search.trim()
                ? 'ไม่พบแชทที่ค้นหา'
                : 'ยังไม่มีแชท'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeId}
                onClick={() => onSelect(conversation.id)}
                branches={branches}
              />
            ))}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
