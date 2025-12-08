// app/api/auth/callback/line/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getLineSettings } from '@/lib/supabase/services/line-settings'

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (request.headers.get('x-forwarded-proto') || 'https') + '://' + 
                    request.headers.get('host');
    
    // Handle error from LINE
    if (error) {
      console.error('LINE Login error:', error, errorDescription);
      return NextResponse.redirect(`${baseUrl}/test-line-login?error=${error}`);
    }
    
    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/test-line-login?error=missing_params`);
    }
    
    // Get LINE settings
    const settings = await getLineSettings();
    
    if (!settings.loginChannelId || !settings.loginChannelSecret) {
      return NextResponse.redirect(`${baseUrl}/test-line-login?error=not_configured`);
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${baseUrl}/api/auth/callback/line`,
        client_id: settings.loginChannelId,
        client_secret: settings.loginChannelSecret,
      }),
    });
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${baseUrl}/test-line-login?error=token_exchange_failed`);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const idToken = tokenData.id_token;
    
    // Get user profile
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!profileResponse.ok) {
      console.error('Profile fetch failed:', await profileResponse.text());
      return NextResponse.redirect(`${baseUrl}/test-line-login?error=profile_fetch_failed`);
    }
    
    const profile = await profileResponse.json();
    console.log('LINE Profile:', profile);
    
    // TODO: Here you would typically:
    // 1. Create or update user in your database
    // 2. Create a session
    // 3. Set cookies
    
    // For now, redirect back with success
    return NextResponse.redirect(
      `${baseUrl}/test-line-login?success=true&userId=${profile.userId}`
    );
    
  } catch (error) {
    console.error('LINE callback error:', error);
    // Get base URL for error redirect
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (request.headers.get('x-forwarded-proto') || 'https') + '://' + 
                    request.headers.get('host');
    return NextResponse.redirect(`${baseUrl}/test-line-login?error=server_error`);
  }
}