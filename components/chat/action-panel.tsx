'use client';

import { User, Phone, Mail, Tag, Link, BookOpen, GraduationCap, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChatConversation } from '@/types/models';
import { ChannelIcon } from './channel-icon';

interface ActionPanelProps {
  conversation: ChatConversation | null;
  onTrialBooking: () => void;
  onEnrollment: () => void;
  /** Mobile: go back to messages view */
  onBack?: () => void;
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

export default function ActionPanel({
  conversation,
  onTrialBooking,
  onEnrollment,
  onBack,
}: ActionPanelProps) {
  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p className="text-base">{'\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e0a\u0e17\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e14\u0e39\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25'}</p>
      </div>
    );
  }

  const contact = conversation.contact;
  const channel = conversation.channel;
  const displayName = contact?.displayName || '\u0e44\u0e21\u0e48\u0e17\u0e23\u0e32\u0e1a\u0e0a\u0e37\u0e48\u0e2d';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Mobile back header */}
      {onBack && (
        <div className="flex items-center gap-2 px-3 py-3 border-b lg:hidden">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-base font-semibold">ข้อมูลลูกค้า</span>
        </div>
      )}

      {/* Contact profile */}
      <div className="flex flex-col items-center px-6 py-6 border-b">
        <Avatar className="w-20 h-20 mb-3">
          {contact?.avatarUrl ? (
            <AvatarImage src={contact.avatarUrl} alt={displayName} />
          ) : null}
          <AvatarFallback className="text-2xl bg-gray-200 text-gray-600">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <h3 className="text-base font-semibold text-gray-900 text-center">
          {displayName}
        </h3>

        {/* Channel label */}
        {channel && (
          <div className="flex items-center gap-1.5 mt-2">
            <ChannelIcon type={channel.type} size="sm" />
            <span className="text-sm text-gray-500">
              {channelLabels[channel.type] || channel.type}
            </span>
          </div>
        )}
      </div>

      {/* Contact details */}
      <div className="px-6 py-4 border-b space-y-3">
        {contact?.phone && (
          <div className="flex items-center gap-3 text-base">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-700">{contact.phone}</span>
          </div>
        )}
        {contact?.email && (
          <div className="flex items-center gap-3 text-base">
            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-700 break-all">{contact.email}</span>
          </div>
        )}
        {!contact?.phone && !contact?.email && (
          <p className="text-sm text-gray-400">{'\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d'}</p>
        )}
      </div>

      {/* Tags */}
      {contact?.tags && contact.tags.length > 0 && (
        <div className="px-6 py-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">{'\u0e41\u0e17\u0e47\u0e01'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-6 py-4 border-b space-y-2">
        <Button
          onClick={onTrialBooking}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          <BookOpen className="w-4 h-4" />
          {'\u0e08\u0e2d\u0e07\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19'}
        </Button>
        <Button
          onClick={onEnrollment}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          <GraduationCap className="w-4 h-4" />
          {'\u0e25\u0e07\u0e17\u0e30\u0e40\u0e1a\u0e35\u0e22\u0e19'}
        </Button>
      </div>

      {/* Linked records */}
      <div className="px-6 py-4 space-y-2">
        <span className="text-sm font-medium text-gray-500">{'\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e42\u0e22\u0e07'}</span>

        {conversation.trialBookingId && (
          <div className="flex items-center gap-2 text-base text-blue-600">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>{'\u0e01\u0e32\u0e23\u0e08\u0e2d\u0e07\u0e17\u0e14\u0e25\u0e2d\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19'}: {conversation.trialBookingId.slice(0, 8)}...</span>
          </div>
        )}

        {conversation.enrollmentId && (
          <div className="flex items-center gap-2 text-base text-green-600">
            <GraduationCap className="w-4 h-4 shrink-0" />
            <span>{'\u0e01\u0e32\u0e23\u0e25\u0e07\u0e17\u0e30\u0e40\u0e1a\u0e35\u0e22\u0e19'}: {conversation.enrollmentId.slice(0, 8)}...</span>
          </div>
        )}

        {!conversation.trialBookingId && !conversation.enrollmentId && (
          <p className="text-sm text-gray-400">{'\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e42\u0e22\u0e07'}</p>
        )}

        {/* Link to parent */}
        {!contact?.parentId && (
          <Button variant="outline" className="w-full mt-3 text-base">
            <Link className="w-4 h-4" />
            {'\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e01\u0e31\u0e1a\u0e1c\u0e39\u0e49\u0e1b\u0e01\u0e04\u0e23\u0e2d\u0e07'}
          </Button>
        )}
      </div>
    </div>
  );
}
