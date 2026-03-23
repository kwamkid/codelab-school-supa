// app/api/admin/chat/refresh-profile/route.ts
// Refresh a chat contact's profile from the platform (Facebook/Instagram/LINE)

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { contactId } = await request.json();
    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get contact with channel info
    const { data: contact, error: contactErr } = await (supabase as any)
      .from('chat_contacts')
      .select('*, chat_channels(id, type, credentials, platform_id)')
      .eq('id', contactId)
      .single();

    if (contactErr || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const channel = contact.chat_channels;
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    let displayName: string | undefined;
    let avatarUrl: string | undefined;

    if (channel.type === 'facebook' || channel.type === 'instagram') {
      const pageAccessToken = channel.credentials?.pageAccessToken;
      if (!pageAccessToken) {
        return NextResponse.json({ error: 'No page access token configured' }, { status: 400 });
      }

      const psid = contact.platform_user_id;
      const pageId = channel.credentials?.pageId || channel.platform_id;
      console.log(`Refresh profile: psid=${psid}, pageId=${pageId}, channelId=${channel.id}, token=${pageAccessToken?.substring(0, 20)}...`);

      const fields = channel.type === 'instagram'
        ? 'name,profile_pic'
        : 'first_name,last_name,profile_pic';

      // Try multiple API versions (v19.0 matches OAuth exchange version)
      let profile: any = null;
      for (const version of ['v19.0', 'v21.0']) {
        const profileRes = await fetch(
          `https://graph.facebook.com/${version}/${psid}?fields=${fields}&access_token=${pageAccessToken}`
        );
        if (profileRes.ok) {
          profile = await profileRes.json();
          console.log(`FB profile OK (${version}): ${psid} ->`, JSON.stringify(profile));
          break;
        } else {
          const errText = await profileRes.text();
          console.warn(`FB profile failed (${version}) for ${psid}:`, errText);
        }
      }

      // Fallback: use Conversations API to find user name + avatar
      if (!profile) {
        console.log(`FB profile: trying conversations API fallback for ${psid}`);
        try {
          const convRes = await fetch(
            `https://graph.facebook.com/v19.0/${pageId}/conversations?user_id=${psid}&fields=participants{id,name,profile_pic}&access_token=${pageAccessToken}`
          );
          if (convRes.ok) {
            const convData = await convRes.json();
            console.log('FB conversations response:', JSON.stringify(convData).substring(0, 500));
            const participants = convData.data?.[0]?.participants?.data;
            if (participants) {
              const user = participants.find((p: any) => p.id === psid);
              if (user?.name) {
                displayName = user.name;
                console.log(`FB conversations fallback OK: ${psid} -> ${displayName}`);
              }
              if (user?.profile_pic) {
                avatarUrl = user.profile_pic;
                console.log(`FB conversations avatar OK: ${psid}`);
              }
            }
          } else {
            console.warn('FB conversations fallback failed:', await convRes.text());
          }
        } catch (convErr) {
          console.error('FB conversations fallback error:', convErr);
        }
      }

      if (profile) {
        displayName = channel.type === 'instagram'
          ? profile.name
          : `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        avatarUrl = profile.profile_pic;
      }

      if (!displayName && !avatarUrl) {
        return NextResponse.json({
          error: 'Failed to fetch profile from Facebook API',
          psid,
          pageId,
        }, { status: 502 });
      }
    } else if (channel.type === 'line') {
      const accessToken = channel.credentials?.accessToken;
      if (!accessToken) {
        return NextResponse.json({ error: 'No LINE access token configured' }, { status: 400 });
      }

      const userId = contact.platform_user_id;
      const profileRes = await fetch(
        `https://api.line.me/v2/bot/profile/${userId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (profileRes.ok) {
        const profile = await profileRes.json();
        displayName = profile.displayName;
        avatarUrl = profile.pictureUrl;
      } else {
        const errBody = await profileRes.text();
        return NextResponse.json({
          error: 'LINE API error',
          details: errBody,
        }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: `Unsupported channel type: ${channel.type}` }, { status: 400 });
    }

    // Update contact in DB
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (displayName) updateData.display_name = displayName;
    if (avatarUrl) updateData.avatar_url = avatarUrl;

    await (supabase as any)
      .from('chat_contacts')
      .update(updateData)
      .eq('id', contactId);

    return NextResponse.json({
      success: true,
      displayName: displayName || contact.display_name,
      avatarUrl: avatarUrl || contact.avatar_url,
    });
  } catch (error: any) {
    console.error('Refresh profile error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
