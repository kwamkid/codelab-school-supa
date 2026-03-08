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
      .select('*, chat_channels(id, type, credentials)')
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
      const fields = channel.type === 'instagram'
        ? 'name,profile_pic'
        : 'first_name,last_name,profile_pic';

      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${psid}?fields=${fields}&access_token=${pageAccessToken}`
      );

      if (profileRes.ok) {
        const profile = await profileRes.json();
        displayName = channel.type === 'instagram'
          ? profile.name
          : `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        avatarUrl = profile.profile_pic;
      } else {
        const errBody = await profileRes.text();
        console.error(`Profile refresh failed for ${psid}:`, errBody);
        return NextResponse.json({
          error: 'Facebook API error',
          details: errBody,
          psid,
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
