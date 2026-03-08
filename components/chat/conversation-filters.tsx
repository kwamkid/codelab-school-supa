'use client';

import { X, Mail, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
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

const TAG_COLORS: Record<string, { active: string; inactive: string }> = {
  'สนใจเรียน': {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-700',
    inactive: 'bg-green-50 text-green-600/70 dark:bg-green-900/20 dark:text-green-400/60',
  },
  'รอติดตาม': {
    active: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 ring-1 ring-yellow-300 dark:ring-yellow-700',
    inactive: 'bg-yellow-50 text-yellow-600/70 dark:bg-yellow-900/20 dark:text-yellow-400/60',
  },
  'ทดลองเรียน': {
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700',
    inactive: 'bg-blue-50 text-blue-600/70 dark:bg-blue-900/20 dark:text-blue-400/60',
  },
  'ลงทะเบียน': {
    active: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700',
    inactive: 'bg-purple-50 text-purple-600/70 dark:bg-purple-900/20 dark:text-purple-400/60',
  },
  'ลูกค้าเก่า': {
    active: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 ring-1 ring-gray-300 dark:ring-gray-600',
    inactive: 'bg-gray-50 text-gray-500/70 dark:bg-gray-800 dark:text-gray-400/60',
  },
  'VIP': {
    active: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700',
    inactive: 'bg-amber-50 text-amber-600/70 dark:bg-amber-900/20 dark:text-amber-400/60',
  },
};

function getTagStyle(tag: string, isActive: boolean): string {
  const colors = TAG_COLORS[tag];
  if (colors) return isActive ? colors.active : colors.inactive;
  return isActive
    ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 ring-1 ring-gray-300 dark:ring-gray-500'
    : 'bg-gray-50 text-gray-500/70 dark:bg-gray-800 dark:text-gray-400/60';
}

// Icon-only filter button
function IconFilter({
  active,
  onClick,
  icon,
  title,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-full transition-colors shrink-0',
        active
          ? (activeClass || 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300')
          : 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-slate-700'
      )}
    >
      {icon}
    </button>
  );
}

export function ConversationFilters({
  filters,
  onFiltersChange,
  branches,
  availableTags,
}: ConversationFiltersProps) {
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
    <div className="border-b dark:border-slate-700 px-3 py-2 space-y-1.5">
      {/* Row 1: Icon filters */}
      <div className="flex items-center gap-0.5">
        {/* LINE */}
        <button
          onClick={() => update({ platform: filters.platform === 'line' ? 'all' : 'line' })}
          title="LINE"
          className={cn(
            'p-1 rounded-full transition-colors shrink-0',
            filters.platform === 'line'
              ? 'bg-green-100 ring-1 ring-green-300 dark:bg-green-900/40 dark:ring-green-700'
              : 'opacity-40 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/social/line_oa.svg" alt="LINE" className="w-5 h-5 rounded-full" />
        </button>

        {/* FB/IG */}
        <button
          onClick={() => update({ platform: filters.platform === 'facebook_instagram' ? 'all' : 'facebook_instagram' })}
          title="Facebook / Instagram"
          className={cn(
            'p-1 rounded-full transition-colors shrink-0',
            filters.platform === 'facebook_instagram'
              ? 'bg-blue-100 ring-1 ring-blue-300 dark:bg-blue-900/40 dark:ring-blue-700'
              : 'opacity-40 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/social/facebook.svg" alt="Facebook" className="w-5 h-5 rounded-full" />
        </button>

        <div className="w-px h-4 bg-gray-200 dark:bg-slate-600 mx-0.5 shrink-0" />

        {/* Unread */}
        <IconFilter
          active={filters.unreadOnly}
          onClick={() => update({ unreadOnly: !filters.unreadOnly })}
          icon={<Mail className="w-4 h-4" />}
          title="ยังไม่อ่าน"
          activeClass="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
        />

        {/* Linked = ลูกค้า */}
        <IconFilter
          active={filters.linkStatus === 'linked'}
          onClick={() => update({ linkStatus: filters.linkStatus === 'linked' ? 'all' : 'linked' })}
          icon={<UserCheck className="w-4 h-4" />}
          title="ลูกค้า"
          activeClass="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        />

        {/* Unlinked = ใหม่ */}
        <IconFilter
          active={filters.linkStatus === 'unlinked'}
          onClick={() => update({ linkStatus: filters.linkStatus === 'unlinked' ? 'all' : 'unlinked' })}
          icon={<UserX className="w-4 h-4" />}
          title="ใหม่"
          activeClass="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
        />

        <div className="flex-1" />

        {/* Clear all */}
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors shrink-0"
            title="ล้างตัวกรอง"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row 2: Branch chips */}
      {branches.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-px">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-0.5 shrink-0">สาขา:</span>
          <button
            onClick={() => update({ branchId: null })}
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors shrink-0',
              !filters.branchId
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'
            )}
          >
            ทั้งหมด
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => update({ branchId: filters.branchId === b.id ? null : b.id })}
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors shrink-0',
                filters.branchId === b.id
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700'
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Tag chips */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-px">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-0.5 shrink-0">แท็ก:</span>
          {availableTags.map((tag) => {
            const isActive = filters.tags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => {
                  const newTags = isActive
                    ? filters.tags.filter(t => t !== tag)
                    : [...filters.tags, tag];
                  update({ tags: newTags });
                }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors shrink-0',
                  getTagStyle(tag, isActive)
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
