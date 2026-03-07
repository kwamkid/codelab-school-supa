'use client';

import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Branch } from '@/types/models';

export interface ChatFilters {
  platform: 'all' | 'line' | 'facebook_instagram';
  branchId: string | null;
  tags: string[];
  linkStatus: 'all' | 'linked' | 'unlinked';
  unreadOnly: boolean;
}

export const DEFAULT_FILTERS: ChatFilters = {
  platform: 'all',
  branchId: null,
  tags: [],
  linkStatus: 'all',
  unreadOnly: false,
};

interface ConversationFiltersProps {
  filters: ChatFilters;
  onFiltersChange: (filters: ChatFilters) => void;
  branches: Branch[];
  availableTags: string[];
}

export function ConversationFilters({
  filters,
  onFiltersChange,
  branches,
  availableTags,
}: ConversationFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<ChatFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const activeCount =
    (filters.platform !== 'all' ? 1 : 0) +
    (filters.branchId ? 1 : 0) +
    filters.tags.length +
    (filters.linkStatus !== 'all' ? 1 : 0) +
    (filters.unreadOnly ? 1 : 0);

  const clearAll = () => onFiltersChange(DEFAULT_FILTERS);

  return (
    <div className="border-b dark:border-slate-700">
      {/* Platform filter tabs + expand button */}
      <div className="flex items-center gap-1 px-3 py-2">
        {/* Platform tabs */}
        {(['all', 'line', 'facebook_instagram'] as const).map((key) => (
          <button
            key={key}
            onClick={() => update({ platform: key })}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              filters.platform === key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'
            )}
          >
            {key === 'all' ? 'ทั้งหมด' : key === 'line' ? 'LINE' : 'FB/IG'}
          </button>
        ))}

        <div className="flex-1" />

        {/* Filter toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 rounded-full text-sm transition-colors',
            activeCount > 0
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          {activeCount > 0 && <span className="text-xs font-medium">{activeCount}</span>}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded filter panel */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Branch filter */}
          {branches.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">สาขา</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => update({ branchId: null })}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    !filters.branchId
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-700 dark:text-gray-400'
                  )}
                >
                  ทุกสาขา
                </button>
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => update({ branchId: b.id })}
                    className={cn(
                      'px-2 py-1 rounded text-xs transition-colors',
                      filters.branchId === b.id
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-700 dark:text-gray-400'
                    )}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags filter */}
          {availableTags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">แท็ก</label>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTags = filters.tags.includes(tag)
                        ? filters.tags.filter(t => t !== tag)
                        : [...filters.tags, tag];
                      update({ tags: newTags });
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-xs transition-colors',
                      filters.tags.includes(tag)
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-700 dark:text-gray-400'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Link status + Unread */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">สถานะผูก</label>
              <div className="flex gap-1">
                {(['all', 'linked', 'unlinked'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ linkStatus: s })}
                    className={cn(
                      'px-2 py-1 rounded text-xs flex-1 transition-colors',
                      filters.linkStatus === s
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-slate-700 dark:text-gray-400'
                    )}
                  >
                    {s === 'all' ? 'ทั้งหมด' : s === 'linked' ? 'ผูกแล้ว' : 'ยังไม่ผูก'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Unread toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => update({ unreadOnly: e.target.checked })}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">แสดงเฉพาะยังไม่อ่าน</span>
          </label>

          {/* Clear all */}
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-gray-400 w-full">
              <X className="w-3 h-3" />
              ล้างตัวกรองทั้งหมด
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
