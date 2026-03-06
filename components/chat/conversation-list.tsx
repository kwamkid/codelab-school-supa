'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatConversation, ChatChannelType } from '@/types/models';
import { ConversationItem } from './conversation-item';

interface ConversationListProps {
  conversations: ChatConversation[];
  selectedId?: string | null;
  activeConversationId?: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

type ChannelFilter = 'all' | 'line' | 'facebook_instagram';

const filterButtons: { key: ChannelFilter; label: string }[] = [
  { key: 'all', label: '\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14' },
  { key: 'line', label: 'LINE' },
  { key: 'facebook_instagram', label: 'FB/IG' },
];

export default function ConversationList({
  conversations,
  selectedId,
  activeConversationId,
  onSelect,
  loading,
}: ConversationListProps) {
  const activeId = selectedId ?? activeConversationId ?? null;
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');

  const filtered = useMemo(() => {
    let result = conversations;

    // Channel filter
    if (channelFilter === 'line') {
      result = result.filter((c) => c.channel?.type === 'line');
    } else if (channelFilter === 'facebook_instagram') {
      result = result.filter(
        (c) => c.channel?.type === 'facebook' || c.channel?.type === 'instagram'
      );
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.displayName?.toLowerCase() || '';
        const preview = c.lastMessagePreview?.toLowerCase() || '';
        const phone = c.contact?.phone?.toLowerCase() || '';
        return name.includes(q) || preview.includes(q) || phone.includes(q);
      });
    }

    return result;
  }, [conversations, channelFilter, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e41\u0e0a\u0e17..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-base"
          />
        </div>
      </div>

      {/* Channel filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b">
        {filterButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setChannelFilter(btn.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              channelFilter === btn.key
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Search className="w-10 h-10 mb-3" />
            <p className="text-base">
              {search.trim()
                ? '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e41\u0e0a\u0e17\u0e17\u0e35\u0e48\u0e04\u0e49\u0e19\u0e2b\u0e32'
                : '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e41\u0e0a\u0e17'}
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
