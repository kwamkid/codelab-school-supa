'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Loader2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SectionLoading } from '@/components/ui/loading';
import { ChatConversation, Branch } from '@/types/models';
import { searchConversations, getConversationsByTags } from '@/lib/services/chat';
import { ConversationItem } from './conversation-item';
import { ConversationFilters, ChatFilters, DEFAULT_FILTERS } from './conversation-filters';

// Apply all non-text filters + free-text search + sort (newest first).
function filterAndSort(
  list: ChatConversation[],
  filters: ChatFilters,
  search: string,
): ChatConversation[] {
  let result = list;

  if (filters.platform === 'line') {
    result = result.filter((c) => c.channel?.type === 'line');
  } else if (filters.platform === 'facebook_instagram') {
    result = result.filter(
      (c) => c.channel?.type === 'facebook' || c.channel?.type === 'instagram'
    );
  }

  if (filters.branchId) {
    result = result.filter((c) => c.contact?.branchIds?.includes(filters.branchId!));
  }

  if (filters.tags.length > 0) {
    result = result.filter((c) => filters.tags.some((t) => c.contact?.tags?.includes(t)));
  }

  if (filters.linkStatus === 'linked') {
    result = result.filter((c) => !!c.contact?.parentId);
  } else if (filters.linkStatus === 'unlinked') {
    result = result.filter((c) => !c.contact?.parentId);
  }

  if (filters.unreadOnly) {
    result = result.filter((c) => c.unreadCount > 0);
  }

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

  return [...result].sort((a, b) => {
    const aTime = a.lastMessageAt?.getTime() || 0;
    const bTime = b.lastMessageAt?.getTime() || 0;
    return bTime - aTime;
  });
}

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

  // DB augmentation pools (merged with the loaded conversations for display)
  const [tagResults, setTagResults] = useState<ChatConversation[]>([]);   // tag filter → auto from DB
  const [textResults, setTextResults] = useState<ChatConversation[]>([]); // name/phone → on-demand button
  const [tagLoading, setTagLoading] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [textSearched, setTextSearched] = useState(false);

  // Loaded rows + DB rows, de-duplicated by id
  const pool = useMemo(() => {
    if (tagResults.length === 0 && textResults.length === 0) return conversations;
    const seen = new Set(conversations.map((c) => c.id));
    const extra: ChatConversation[] = [];
    for (const c of [...tagResults, ...textResults]) {
      if (!seen.has(c.id)) { seen.add(c.id); extra.push(c); }
    }
    return [...conversations, ...extra];
  }, [conversations, tagResults, textResults]);

  // Collect all unique tags for the filter UI (from everything we know about)
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    pool.forEach((c) => c.contact?.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [pool]);

  // Final list = pool through all filters + search + sort
  const filtered = useMemo(
    () => filterAndSort(pool, filters, search),
    [pool, filters, search]
  );

  // Tag filter → fetch matching conversations from the whole DB automatically
  const tagKey = filters.tags.join('|');
  useEffect(() => {
    if (!tagKey) { setTagResults([]); return; }
    let cancelled = false;
    setTagLoading(true);
    getConversationsByTags(tagKey.split('|'), 200)
      .then((res) => { if (!cancelled) setTagResults(res); })
      .catch(() => { if (!cancelled) setTagResults([]); })
      .finally(() => { if (!cancelled) setTagLoading(false); });
    return () => { cancelled = true; };
  }, [tagKey]);

  // Reset on-demand text results whenever the query changes
  useEffect(() => {
    setTextResults([]);
    setTextSearched(false);
  }, [search]);

  const handleSearchDb = async () => {
    if (!search.trim() || textLoading) return;
    setTextLoading(true);
    try {
      const results = await searchConversations(search.trim(), 50);
      setTextResults(results);
    } catch {
      setTextResults([]);
    } finally {
      setTextLoading(false);
      setTextSearched(true);
    }
  };

  const dbLoading = tagLoading || textLoading;
  // The text-DB button only makes sense for free-text queries that haven't been run yet
  const showDbButton = !!search.trim() && !textSearched && !textLoading;

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
        ) : filtered.length === 0 && !dbLoading ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-gray-400">
            <Search className="w-10 h-10 mb-3" />
            <p className="text-base text-center">
              {search.trim()
                ? (textSearched ? 'ไม่พบแชทที่ค้นหา' : 'ไม่พบในแชทที่โหลดมา')
                : filters.tags.length > 0
                  ? 'ไม่พบแชทที่มีแท็กนี้'
                  : 'ยังไม่มีแชท'}
            </p>
            {showDbButton && <DbSearchButton onClick={handleSearchDb} className="mt-4" />}
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

            {dbLoading && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังค้นหาในฐานข้อมูล...
              </div>
            )}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}

            {/* Free-text: button to search the whole database (tags search the DB automatically) */}
            {showDbButton && !loadingMore && (
              <div className="px-3 py-3 border-t dark:border-slate-700">
                <DbSearchButton onClick={handleSearchDb} className="w-full" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DbSearchButton({
  onClick,
  loading,
  className,
}: {
  onClick: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
        'border border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300',
        'hover:border-solid hover:border-orange-400 hover:text-orange-600 transition-colors disabled:opacity-50',
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
      ค้นหาเพิ่มเติมในฐานข้อมูล
    </button>
  );
}
