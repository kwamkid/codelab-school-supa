'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Phone, Mail, Tag, Link as LinkIcon, BookOpen, GraduationCap, ArrowLeft, X, Plus, MapPin, UserCheck, Unlink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ChatConversation, Branch } from '@/types/models';
import { ChannelIcon } from './channel-icon';

type PanelView = 'info' | 'trial' | 'enrollment';

interface ActionPanelProps {
  conversation: ChatConversation | null;
  branches: Branch[];
  panelView?: PanelView;
  onTrialBooking: () => void;
  onEnrollment: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddBranch: (branchId: string) => void;
  onRemoveBranch: (branchId: string) => void;
  onLinkParent: () => void;
  onUnlinkParent: () => void;
  onRefreshProfile?: () => Promise<void>;
  linkedParent?: { id: string; displayName: string; phone: string; students?: { id: string; name: string }[] } | null;
  onBack?: () => void;
  trialFormNode?: ReactNode;
  enrollFormNode?: ReactNode;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const channelLabels: Record<string, string> = {
  line: 'LINE',
  facebook: 'Facebook Messenger',
  instagram: 'Instagram',
};

const PRESET_TAGS = ['สนใจเรียน', 'รอติดตาม', 'ทดลองเรียน', 'ลงทะเบียน', 'ลูกค้าเก่า', 'VIP'];

const TAG_COLORS: Record<string, string> = {
  'สนใจเรียน': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'รอติดตาม': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'ทดลองเรียน': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'ลงทะเบียน': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'ลูกค้าเก่า': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  'VIP': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

export default function ActionPanel({
  conversation,
  branches,
  panelView = 'info',
  onTrialBooking,
  onEnrollment,
  onAddTag,
  onRemoveTag,
  onAddBranch,
  onRemoveBranch,
  onLinkParent,
  onUnlinkParent,
  onRefreshProfile,
  linkedParent,
  onBack,
  trialFormNode,
  enrollFormNode,
}: ActionPanelProps) {
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showBranchSelect, setShowBranchSelect] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  // Close lightbox on ESC
  useEffect(() => {
    if (!showAvatarPreview) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAvatarPreview(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showAvatarPreview]);

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <p className="text-base">เลือกแชทเพื่อดูข้อมูล</p>
      </div>
    );
  }

  // ── Trial form view ──
  if (panelView === 'trial' && trialFormNode) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2 px-3 py-3 border-b dark:border-slate-700 shrink-0">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <BookOpen className="w-5 h-5 text-orange-500" />
          <span className="text-base font-semibold dark:text-white">จองทดลองเรียน</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {trialFormNode}
        </div>
      </div>
    );
  }

  // ── Enrollment form view ──
  if (panelView === 'enrollment' && enrollFormNode) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-800">
        <div className="flex items-center gap-2 px-3 py-3 border-b dark:border-slate-700 shrink-0">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <span className="text-base font-semibold dark:text-white">ลงทะเบียน</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {enrollFormNode}
        </div>
      </div>
    );
  }

  const contact = conversation.contact;
  const channel = conversation.channel;
  const displayName = contact?.displayName || 'ไม่ทราบชื่อ';
  const contactTags = contact?.tags || [];
  const contactBranchIds = contact?.branchIds || [];
  const contactBranches = branches.filter(b => contactBranchIds.includes(b.id));
  const availableBranches = branches.filter(b => !contactBranchIds.includes(b.id));

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !contactTags.includes(tag)) {
      onAddTag(tag);
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const suggestedTags = PRESET_TAGS.filter(t => !contactTags.includes(t));

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white dark:bg-slate-800">
      {/* Mobile back header */}
      {onBack && (
        <div className="flex items-center gap-2 px-3 py-3 border-b dark:border-slate-700 lg:hidden">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-base font-semibold dark:text-white">ข้อมูลลูกค้า</span>
        </div>
      )}

      {/* Avatar lightbox */}
      {showAvatarPreview && contact?.avatarUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowAvatarPreview(false)}
        >
          <button
            onClick={() => setShowAvatarPreview(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contact.avatarUrl}
            alt={displayName}
            className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Contact profile */}
      <div className="flex flex-col items-center px-6 py-6 border-b dark:border-slate-700">
        <div className="relative">
          <Avatar
            className={cn('w-20 h-20 mb-3', contact?.avatarUrl && 'cursor-pointer hover:ring-2 hover:ring-blue-300 transition-shadow')}
            onClick={() => contact?.avatarUrl && setShowAvatarPreview(true)}
          >
            {contact?.avatarUrl ? (
              <AvatarImage src={contact.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-2xl bg-gray-200 text-gray-600 dark:bg-slate-600 dark:text-gray-300">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          {onRefreshProfile && (
            <button
              onClick={async () => {
                setRefreshing(true);
                try { await onRefreshProfile(); } finally { setRefreshing(false); }
              }}
              disabled={refreshing}
              className="absolute -bottom-0.5 -right-0.5 p-1 rounded-full bg-white dark:bg-slate-700 border dark:border-slate-600 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50"
              title="รีเฟรชโปรไฟล์"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-gray-500', refreshing && 'animate-spin')} />
            </button>
          )}
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white text-center">
          {displayName}
        </h3>
        {channel && (
          <div className="flex items-center gap-1.5 mt-2">
            <ChannelIcon type={channel.type} size="sm" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {channelLabels[channel.type] || channel.type}
            </span>
          </div>
        )}
      </div>

      {/* Contact details */}
      <div className="px-6 py-4 border-b dark:border-slate-700 space-y-3">
        {contact?.phone && (
          <div className="flex items-center gap-3 text-base">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-700 dark:text-gray-300">{contact.phone}</span>
          </div>
        )}
        {contact?.email && (
          <div className="flex items-center gap-3 text-base">
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-700 dark:text-gray-300 break-all">{contact.email}</span>
          </div>
        )}
        {!contact?.phone && !contact?.email && (
          <p className="text-sm text-gray-400">ยังไม่มีข้อมูลติดต่อ</p>
        )}
      </div>

      {/* Tags section */}
      <div className="px-6 py-4 border-b dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">แท็ก</span>
          </div>
          <button
            onClick={() => setShowTagInput(!showTagInput)}
            className="text-blue-500 hover:text-blue-600 text-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {contactTags.map((tag) => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                getTagColor(tag)
              )}
            >
              {tag}
              <button onClick={() => onRemoveTag(tag)} className="hover:opacity-70 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {contactTags.length === 0 && !showTagInput && (
            <p className="text-xs text-gray-400">ยังไม่มีแท็ก</p>
          )}
        </div>

        {showTagInput && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-1.5">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="พิมพ์แท็กใหม่..."
                className="text-sm h-8"
              />
              <Button size="sm" onClick={handleAddTag} className="h-8 px-3" disabled={!newTag.trim()}>
                เพิ่ม
              </Button>
            </div>
            {suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onAddTag(tag)}
                    className="px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-solid hover:text-gray-700 cursor-pointer dark:border-slate-600 dark:text-gray-400"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Branches section */}
      <div className="px-6 py-4 border-b dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">สาขา</span>
          </div>
          {availableBranches.length > 0 && (
            <button
              onClick={() => setShowBranchSelect(!showBranchSelect)}
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {contactBranches.map((branch) => (
            <span
              key={branch.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
            >
              {branch.name}
              <button onClick={() => onRemoveBranch(branch.id)} className="hover:opacity-70 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {contactBranches.length === 0 && !showBranchSelect && (
            <p className="text-xs text-gray-400">ยังไม่ได้ระบุสาขา</p>
          )}
        </div>

        {showBranchSelect && availableBranches.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {availableBranches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => {
                  onAddBranch(branch.id);
                  if (availableBranches.length === 1) setShowBranchSelect(false);
                }}
                className="px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 text-gray-500 hover:border-solid hover:text-gray-700 cursor-pointer dark:border-slate-600 dark:text-gray-400"
              >
                + {branch.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Parent link section */}
      <div className="px-6 py-4 border-b dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">ผู้ปกครอง</span>
        </div>

        {linkedParent ? (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">{linkedParent.displayName}</p>
              <p className="text-xs text-green-600 dark:text-green-400">{linkedParent.phone}</p>
              {linkedParent.students && linkedParent.students.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {linkedParent.students.map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-xs">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnlinkParent}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full text-xs"
            >
              <Unlink className="w-3 h-3" />
              ยกเลิกการผูก
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={onLinkParent}
            className="w-full text-base dark:border-slate-600"
          >
            <LinkIcon className="w-4 h-4" />
            เชื่อมกับผู้ปกครอง
          </Button>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-6 py-4 border-b dark:border-slate-700 space-y-2">
        <Button
          onClick={onTrialBooking}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          <BookOpen className="w-4 h-4" />
          จองทดลองเรียน
        </Button>
        <Button
          onClick={onEnrollment}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          <GraduationCap className="w-4 h-4" />
          ลงทะเบียน
        </Button>
      </div>

      {/* Linked records */}
      <div className="px-6 py-4 space-y-2">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">ข้อมูลที่เชื่อมโยง</span>

        {conversation.trialBookingId && (
          <div className="flex items-center gap-2 text-base text-blue-600 dark:text-blue-400">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>การจองทดลองเรียน: {conversation.trialBookingId.slice(0, 8)}...</span>
          </div>
        )}

        {conversation.enrollmentId && (
          <div className="flex items-center gap-2 text-base text-green-600 dark:text-green-400">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>การลงทะเบียน: {conversation.enrollmentId.slice(0, 8)}...</span>
          </div>
        )}

        {!conversation.trialBookingId && !conversation.enrollmentId && (
          <p className="text-sm text-gray-400">ยังไม่มีข้อมูลที่เชื่อมโยง</p>
        )}
      </div>
    </div>
  );
}
