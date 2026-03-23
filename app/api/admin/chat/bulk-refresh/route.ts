// app/api/admin/chat/bulk-refresh/route.ts
// Bulk refresh all Facebook contacts that still show PSID as name

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get all Facebook/Instagram channels
    const { data: channels } = await (supabase as any)
      .from('chat_channels')
      .select('id, type, credentials, platform_id')
      .in('type', ['facebook', 'instagram'])
      .eq('is_active', true);

    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: 'No active Facebook channels' }, { status: 404 });
    }

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const channel of channels) {
      const pageAccessToken = channel.credentials?.pageAccessToken;
      const pageId = channel.credentials?.pageId || channel.platform_id;
      if (!pageAccessToken || !pageId) {
        errors.push(`Channel ${channel.id}: no token or pageId`);
        continue;
      }

      // Get all contacts for this channel that have numeric-only display names (PSIDs)
      const { data: contacts } = await (supabase as any)
        .from('chat_contacts')
        .select('id, platform_user_id, display_name, avatar_url')
        .eq('channel_id', channel.id)
        .is('is_group', false);

      if (!contacts) continue;

      for (const contact of contacts) {
        // Skip if already has a proper name (not just digits)
        if (contact.display_name && !/^\d+$/.test(contact.display_name)) {
          skipped++;
          continue;
        }

        const psid = contact.platform_user_id;
        let displayName: string | undefined;
        let avatarUrl: string | undefined;

        // Try direct profile API first
        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v19.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
          );
          if (profileRes.ok) {
            const profile = await profileRes.json();
            displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            avatarUrl = profile.profile_pic;
          }
        } catch {}

        // Fallback: Conversations API
        if (!displayName) {
          try {
            const convRes = await fetch(
              `https://graph.facebook.com/v19.0/${pageId}/conversations?user_id=${psid}&fields=participants{id,name,profile_pic}&access_token=${pageAccessToken}`
            );
            if (convRes.ok) {
              const convData = await convRes.json();
              const participants = convData.data?.[0]?.participants?.data;
              if (participants) {
                const user = participants.find((p: any) => p.id === psid);
                if (user?.name) displayName = user.name;
                if (user?.profile_pic) avatarUrl = user.profile_pic;
              }
            }
          } catch {}
        }

        if (displayName || avatarUrl) {
          const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
          if (displayName) updateData.display_name = displayName;
          if (avatarUrl) updateData.avatar_url = avatarUrl;

          await (supabase as any)
            .from('chat_contacts')
            .update(updateData)
            .eq('id', contact.id);

          updated++;
          console.log(`Bulk refresh: ${psid} -> ${displayName || '(avatar only)'}`);
        } else {
          failed++;
        }

        // Rate limit: wait 200ms between requests to avoid FB throttling
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      failed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Bulk refresh error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
