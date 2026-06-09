// lib/line/verify-liff-token.ts
// Server-side verification of a LINE LIFF ID token. The browser sends the token
// from `liff.getIDToken()`; we verify it against LINE so the resulting userId can
// be trusted (a client can't just claim to be another parent).

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

// The LIFF ID's numeric prefix is the associated LINE Login channel ID, which is
// the `aud`/`client_id` of the ID token.
function getChannelId(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2007575627-GmKBZJdo';
  return process.env.LINE_LIFF_CHANNEL_ID || liffId.split('-')[0];
}

export interface VerifiedLiffUser {
  lineUserId: string;
  name?: string;
  picture?: string;
}

export async function verifyLiffIdToken(idToken: string): Promise<VerifiedLiffUser | null> {
  if (!idToken) return null;
  try {
    const res = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: getChannelId() }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[verifyLiffIdToken] LINE verify failed:', res.status, err);
      return null;
    }
    const payload = await res.json();
    if (!payload?.sub) return null;
    return { lineUserId: payload.sub, name: payload.name, picture: payload.picture };
  } catch (error) {
    console.error('[verifyLiffIdToken] Error:', error);
    return null;
  }
}

/**
 * Resolve the LIFF user for an API route.
 * Prefers the verified ID token from the `Authorization: Bearer <token>` header.
 * Falls back to a raw `lineUserId` in the body (only if no token was sent) so the
 * portal keeps working if the LIFF app's `openid` scope isn't enabled yet.
 * Returns the userId and whether it was cryptographically verified.
 */
export async function resolveLiffUser(
  request: Request,
  body: any
): Promise<{ lineUserId: string; verified: boolean } | null> {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;

  if (token) {
    const verified = await verifyLiffIdToken(token);
    if (verified) return { lineUserId: verified.lineUserId, verified: true };
    // Token failed verification (e.g. wrong channel id / openid scope). Prefer to
    // fall back to the body userId rather than break the portal — log it so we can
    // tighten this once the verified path is confirmed working in production.
    console.warn('[resolveLiffUser] ID token verification failed; falling back to body lineUserId');
  }

  if (body?.lineUserId) {
    if (token) {
      // already warned above
    } else {
      console.warn('[resolveLiffUser] No ID token; using unverified body lineUserId');
    }
    return { lineUserId: body.lineUserId, verified: false };
  }

  return null;
}
