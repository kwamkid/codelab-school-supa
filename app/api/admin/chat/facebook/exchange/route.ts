// app/api/admin/chat/facebook/exchange/route.ts
// Exchange Facebook OAuth code for token → fetch pages + IG accounts

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface FacebookPage {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  pagePicture?: string;
  instagram?: {
    id: string;
    name?: string;
    username?: string;
    profilePictureUrl?: string;
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    const { code, appId, appSecret, redirectUri } = await request.json();

    if (!code || !appId || !appSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing required fields: code, appId, appSecret, redirectUri' },
        { status: 400 }
      );
    }

    // 1. Exchange code for short-lived user access token
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.json(
        { error: `Facebook token error: ${tokenData.error.message}` },
        { status: 400 }
      );
    }

    const shortToken = tokenData.access_token;
    console.log('FB Exchange: got short token OK');

    // 2. Exchange for long-lived token (60 days)
    const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', appId);
    longTokenUrl.searchParams.set('client_secret', appSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();

    if (longTokenData.error) {
      return NextResponse.json(
        { error: `Long-lived token error: ${longTokenData.error.message}` },
        { status: 400 }
      );
    }

    const longLivedUserToken = longTokenData.access_token;
    console.log('FB Exchange: got long-lived token OK');

    // 3. Fetch pages the user manages
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture{url}&limit=100&access_token=${longLivedUserToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();
    console.log('FB Exchange: pages response:', JSON.stringify(pagesData).substring(0, 500));

    if (pagesData.error) {
      return NextResponse.json(
        { error: `Pages fetch error: ${pagesData.error.message}` },
        { status: 400 }
      );
    }

    // If /me/accounts is empty, try fetching via Business accounts
    let allPages = pagesData.data || [];
    if (allPages.length === 0) {
      console.log('FB Exchange: /me/accounts empty, trying business pages...');
      try {
        // Get user's businesses
        const bizRes = await fetch(
          `https://graph.facebook.com/v19.0/me/businesses?access_token=${longLivedUserToken}`
        );
        const bizData = await bizRes.json();
        console.log('FB Exchange: businesses:', JSON.stringify(bizData).substring(0, 500));

        if (bizData.data && bizData.data.length > 0) {
          for (const biz of bizData.data) {
            const bizPagesRes = await fetch(
              `https://graph.facebook.com/v19.0/${biz.id}/owned_pages?fields=id,name,access_token,picture{url}&limit=100&access_token=${longLivedUserToken}`
            );
            const bizPagesData = await bizPagesRes.json();
            console.log(`FB Exchange: business ${biz.id} pages:`, JSON.stringify(bizPagesData).substring(0, 500));
            if (bizPagesData.data) {
              allPages = [...allPages, ...bizPagesData.data];
            }
          }
        }
      } catch (bizErr) {
        console.error('FB Exchange: business pages fetch error:', bizErr);
      }
    }

    if (allPages.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบเพจ Facebook ที่คุณมีสิทธิ์จัดการ กรุณาตรวจสอบว่าบัญชี Facebook ที่ใช้เป็น Admin ของเพจ' },
        { status: 404 }
      );
    }

    // 4. For each page, get Instagram business account + subscribe to webhooks
    const pages: FacebookPage[] = await Promise.all(
      allPages.map(async (page: any) => {
        const result: FacebookPage = {
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
          pagePicture: page.picture?.data?.url,
          instagram: null,
        };

        // Fetch linked Instagram Business Account
        try {
          const igRes = await fetch(
            `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${page.access_token}`
          );
          const igData = await igRes.json();
          if (igData.instagram_business_account) {
            result.instagram = {
              id: igData.instagram_business_account.id,
              name: igData.instagram_business_account.name,
              username: igData.instagram_business_account.username,
              profilePictureUrl: igData.instagram_business_account.profile_picture_url,
            };
          }
        } catch {
          // IG fetch failed, skip
        }

        // Subscribe page to messaging webhook
        try {
          await fetch(
            `https://graph.facebook.com/v19.0/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${page.access_token}`,
            { method: 'POST' }
          );
        } catch {
          // Subscription failed, non-critical
        }

        return result;
      })
    );

    return NextResponse.json({ pages });
  } catch (error: any) {
    console.error('Facebook exchange error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
