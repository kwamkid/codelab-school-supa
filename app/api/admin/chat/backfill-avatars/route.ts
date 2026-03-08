// app/api/admin/chat/backfill-avatars/route.ts
// Backfill sender_avatar_url for old group chat messages from LINE API

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const debug: any = {};

    // 1. Find all LINE channels
    const { data: channels } = await (supabase as any)
      .from('chat_channels')
      .select('id, type, credentials, platform_id')
      .eq('type', 'line')
      .eq('is_active', true);

    debug.channels = channels?.length || 0;
    if (!channels || channels.length === 0) {
      return NextResponse.json({ message: 'No LINE channels found', updated: 0, debug });
    }

    const channelMap = new Map(channels.map((c: any) => [c.id, c]));

    // 2. Find inbound messages in GROUP conversations that need avatar backfill
    const { data: messages } = await (supabase as any)
      .from('chat_messages')
      .select('id, conversation_id, sender_id, chat_conversations!inner(id, channel_id, chat_contacts!inner(id, platform_user_id, is_group))')
      .eq('direction', 'inbound')
      .eq('chat_conversations.chat_contacts.is_group', true)
      .is('sender_avatar_url', null)
      .not('sender_id', 'is', null)
      .limit(500);

    debug.groupMessagesWithoutAvatar = messages?.length || 0;

    if (!messages || messages.length === 0) {
      // Check if is_group is actually set
      const { data: contactCheck } = await (supabase as any)
        .from('chat_contacts')
        .select('id, display_name, is_group, platform_user_id')
        .limit(20);

      debug.contactsSample = contactCheck?.map((c: any) => ({
        name: c.display_name?.slice(0, 15),
        isGroup: c.is_group,
        pid: c.platform_user_id?.slice(0, 10),
      }));

      return NextResponse.json({ message: 'No group messages need backfill', updated: 0, debug });
    }

    // Build work map: groupId -> { accessToken, senderIds, conversationIds }
    const groupWork = new Map<string, {
      accessToken: string;
      senderIds: Set<string>;
      conversationIds: Set<string>;
    }>();

    for (const msg of messages) {
      const conv = msg.chat_conversations;
      const contact = conv?.chat_contacts;
      const channel = channelMap.get(conv?.channel_id);
      if (!channel || !contact?.platform_user_id || !msg.sender_id) continue;

      // sender_id should differ from groupId (it's the individual user)
      if (msg.sender_id === contact.platform_user_id) continue;

      const groupId = contact.platform_user_id;
      const accessToken = channel.credentials?.accessToken;
      if (!accessToken) continue;

      if (!groupWork.has(groupId)) {
        groupWork.set(groupId, { accessToken, senderIds: new Set(), conversationIds: new Set() });
      }
      const work = groupWork.get(groupId)!;
      work.senderIds.add(msg.sender_id);
      work.conversationIds.add(msg.conversation_id);
    }

    debug.groupsToProcess = groupWork.size;
    debug.uniqueSenders = [...groupWork.values()].reduce((sum, w) => sum + w.senderIds.size, 0);

    let totalUpdated = 0;
    const errors: string[] = [];

    // 3. For each group, fetch member profiles and update messages
    for (const [groupId, work] of groupWork) {
      for (const senderId of work.senderIds) {
        try {
          const profileRes = await fetch(
            `https://api.line.me/v2/bot/group/${groupId}/member/${senderId}`,
            { headers: { Authorization: `Bearer ${work.accessToken}` } }
          );

          if (!profileRes.ok) {
            // Try direct profile API as fallback (in case bot left the group)
            const fallbackRes = await fetch(
              `https://api.line.me/v2/bot/profile/${senderId}`,
              { headers: { Authorization: `Bearer ${work.accessToken}` } }
            );
            if (fallbackRes.ok) {
              const profile = await fallbackRes.json();
              if (profile.pictureUrl) {
                const { count } = await (supabase as any)
                  .from('chat_messages')
                  .update({ sender_avatar_url: profile.pictureUrl, sender_name: profile.displayName || undefined })
                  .in('conversation_id', [...work.conversationIds])
                  .eq('sender_id', senderId)
                  .eq('direction', 'inbound')
                  .is('sender_avatar_url', null);
                totalUpdated += (count || 0);
                continue;
              }
            }
            errors.push(`group ${groupId.slice(0, 8)}../sender ${senderId.slice(0, 8)}..: HTTP ${profileRes.status}`);
            continue;
          }

          const profile = await profileRes.json();
          if (!profile.pictureUrl) continue;

          const updateData: any = { sender_avatar_url: profile.pictureUrl };
          if (profile.displayName) updateData.sender_name = profile.displayName;

          const { count } = await (supabase as any)
            .from('chat_messages')
            .update(updateData)
            .in('conversation_id', [...work.conversationIds])
            .eq('sender_id', senderId)
            .eq('direction', 'inbound')
            .is('sender_avatar_url', null);

          totalUpdated += (count || 0);
        } catch (err: any) {
          errors.push(`sender ${senderId.slice(0, 8)}..: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      debug,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Backfill avatars error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
