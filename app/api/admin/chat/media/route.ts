// app/api/admin/chat/media/route.ts
// Proxy for LINE media content (images, video, audio, files)
// LINE content URLs require Authorization header, so we proxy through this endpoint.

import { NextRequest, NextResponse } from 'next/server';
import { getChannelById } from '@/lib/services/chat-webhook';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const channelId = searchParams.get('channelId');

    if (!url || !channelId) {
      return NextResponse.json({ error: 'Missing url or channelId' }, { status: 400 });
    }

    // This route is loaded via <img>/<video> src (no Bearer header possible),
    // so it can't use requireStaff. Instead only proxy LINE's content API —
    // otherwise any caller could make us send the channel access token to an
    // arbitrary host (token exfiltration / SSRF).
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    if (target.protocol !== 'https:' || target.hostname !== 'api-data.line.me') {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }

    // Get channel credentials for auth token
    const channel = await getChannelById(channelId);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const accessToken = channel.credentials?.accessToken || channel.credentials?.pageAccessToken;
    if (!accessToken) {
      return NextResponse.json({ error: 'No access token' }, { status: 400 });
    }

    // Build headers based on channel type
    const headers: Record<string, string> = {};
    if (channel.type === 'line') {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Fetch the media from platform
    const mediaRes = await fetch(url, { headers });

    if (!mediaRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch media: ${mediaRes.status}` },
        { status: mediaRes.status }
      );
    }

    // Stream the response back
    const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
    const body = mediaRes.body;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
