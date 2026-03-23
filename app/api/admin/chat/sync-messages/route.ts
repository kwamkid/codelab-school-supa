// app/api/admin/chat/sync-messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { channelId } = await request.json().catch(() => ({}));

    // Get Facebook channels
    let channelQuery = (supabase as any)
      .from('chat_channels')
      .select('id, type, credentials, platform_id, platform_name, name')
      .in('type', ['facebook', 'instagram'])
      .eq('is_active', true);

    if (channelId) channelQuery = channelQuery.eq('id', channelId);

    const { data: channels } = await channelQuery;
    if (!channels?.length) {
      return NextResponse.json({ error: 'No active Facebook channels' }, { status: 404 });
    }

    let totalSynced = 0;
    let totalConversations = 0;

    for (const channel of channels) {
      const token = channel.credentials?.pageAccessToken;
      const pageId = channel.credentials?.pageId || channel.platform_id;
      if (!token || !pageId) continue;

      // Fetch conversations from Facebook (last 30 days by default)
      const convRes = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=participants,messages.limit(25){message,from,created_time,attachments{mime_type,name,size,image_data,video_data,file_url}}&limit=50&access_token=${token}`
      );

      if (!convRes.ok) {
        console.error(`FB sync: conversations fetch failed for page ${pageId}:`, await convRes.text());
        continue;
      }

      const convData = await convRes.json();
      const fbConversations = convData.data || [];

      for (const fbConv of fbConversations) {
        const participants = fbConv.participants?.data || [];
        // Find the non-page participant (the customer)
        const customer = participants.find((p: any) => p.id !== pageId);
        if (!customer) continue;

        totalConversations++;
        const psid = customer.id;
        const customerName = customer.name;

        // Find or create contact
        const { data: existingContact } = await (supabase as any)
          .from('chat_contacts')
          .select('id')
          .eq('channel_id', channel.id)
          .eq('platform_user_id', psid)
          .single();

        let contactId: string;
        if (existingContact) {
          contactId = existingContact.id;
          // Update name if still PSID
          if (customerName) {
            const { data: contactData } = await (supabase as any)
              .from('chat_contacts')
              .select('display_name')
              .eq('id', existingContact.id)
              .single();
            if (contactData?.display_name && /^\d+$/.test(contactData.display_name)) {
              await (supabase as any)
                .from('chat_contacts')
                .update({ display_name: customerName, updated_at: new Date().toISOString() })
                .eq('id', existingContact.id);
            }
          }
        } else {
          const { data: newContact, error: insertErr } = await (supabase as any)
            .from('chat_contacts')
            .upsert({
              channel_id: channel.id,
              platform_user_id: psid,
              display_name: customerName || psid,
              avatar_url: null,
            })
            .select('id')
            .single();
          if (insertErr) { console.error('Contact insert error:', insertErr); continue; }
          contactId = newContact.id;
        }

        // Find or create conversation
        const { data: existingConv } = await (supabase as any)
          .from('chat_conversations')
          .select('id')
          .eq('channel_id', channel.id)
          .eq('contact_id', contactId)
          .single();

        let conversationId: string;
        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv, error: convErr } = await (supabase as any)
            .from('chat_conversations')
            .insert({
              channel_id: channel.id,
              contact_id: contactId,
              status: 'open',
              unread_count: 0,
            })
            .select('id')
            .single();
          if (convErr) { console.error('Conv insert error:', convErr); continue; }
          conversationId = newConv.id;
        }

        // Process messages
        const fbMessages = fbConv.messages?.data || [];
        let lastMessagePreview = '';
        let lastMessageAt = '';
        let newMsgCount = 0;

        for (const fbMsg of fbMessages) {
          if (!fbMsg.message && !fbMsg.attachments) continue;

          // Check if already exists by looking for similar timestamp + sender
          const msgTime = new Date(fbMsg.created_time).toISOString();
          const senderId = fbMsg.from?.id;
          const isFromPage = senderId === pageId;
          const direction = isFromPage ? 'outbound' : 'inbound';

          // Check for duplicate (by platform_message_id or by content+time)
          const { data: existingMsg } = await (supabase as any)
            .from('chat_messages')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('content', fbMsg.message || '')
            .eq('direction', direction)
            .gte('created_at', new Date(new Date(fbMsg.created_time).getTime() - 1000).toISOString())
            .lte('created_at', new Date(new Date(fbMsg.created_time).getTime() + 1000).toISOString())
            .limit(1);

          if (existingMsg && existingMsg.length > 0) continue;

          // Determine message type
          let messageType = 'text';
          let content = fbMsg.message || '';
          let mediaUrl: string | undefined;

          if (fbMsg.attachments?.data?.length > 0) {
            const att = fbMsg.attachments.data[0];
            if (att.image_data) {
              messageType = 'image';
              mediaUrl = att.image_data.url;
              if (!content) content = '[รูปภาพ]';
            } else if (att.video_data) {
              messageType = 'video';
              mediaUrl = att.video_data.url;
              if (!content) content = '[วิดีโอ]';
            } else if (att.file_url) {
              messageType = 'file';
              mediaUrl = att.file_url;
              if (!content) content = '[ไฟล์]';
            }
          }

          await (supabase as any)
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              direction,
              sender_type: isFromPage ? 'admin' : 'contact',
              sender_id: senderId,
              sender_name: fbMsg.from?.name || null,
              message_type: messageType,
              content: content || null,
              media_url: mediaUrl || null,
              status: 'delivered',
              created_at: msgTime,
            });

          newMsgCount++;
          totalSynced++;

          if (!lastMessageAt || msgTime > lastMessageAt) {
            lastMessageAt = msgTime;
            lastMessagePreview = (content || '').substring(0, 100);
          }
        }

        // Update conversation last message
        if (lastMessageAt) {
          await (supabase as any)
            .from('chat_conversations')
            .update({
              last_message_at: lastMessageAt,
              last_message_preview: lastMessagePreview,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
        }

        console.log(`FB sync: ${customerName || psid} — ${newMsgCount} new messages`);

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: true,
      conversations: totalConversations,
      messagesSynced: totalSynced,
    });
  } catch (error: any) {
    console.error('FB sync error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
