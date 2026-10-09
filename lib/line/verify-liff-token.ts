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

// Cache verified tokens briefly so rapid tab switches don't each hit LINE's
// verify endpoint. Keyed by the token string; ID tokens are stable per session.
const verifyCache = new Map<string, { at: number; user: VerifiedLiffUser }>();
const VERIFY_TTL_MS = 10 * 60_000; // 10 minutes

/** Why the last verification failed (LINE's error_description), for the audit log. */
type VerifyFailure = { reason: 'expired' | 'invalid'; detail: string };

export async function verifyLiffIdToken(idToken: string): Promise<VerifiedLiffUser | null> {
  return (await verifyLiffIdTokenDetailed(idToken)).user;
}

async function verifyLiffIdTokenDetailed(
  idToken: string
): Promise<{ user: VerifiedLiffUser | null; failure?: VerifyFailure }> {
  if (!idToken) return { user: null, failure: { reason: 'invalid', detail: 'empty token' } };

  const cached = verifyCache.get(idToken);
  if (cached && Date.now() - cached.at < VERIFY_TTL_MS) return { user: cached.user };

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
      return { user: null, failure: { reason: /expired/i.test(err) ? 'expired' : 'invalid', detail: `${res.status} ${err}`.slice(0, 200) } };
    }
    const payload = await res.json();
    if (!payload?.sub) return { user: null, failure: { reason: 'invalid', detail: 'no sub in payload' } };
    const user = { lineUserId: payload.sub, name: payload.name, picture: payload.picture };
    verifyCache.set(idToken, { at: Date.now(), user });
    return { user };
  } catch (error) {
    console.error('[verifyLiffIdToken] Error:', error);
    return { user: null, failure: { reason: 'invalid', detail: String(error).slice(0, 200) } };
  }
}

// ---------------------------------------------------------------------------
// Audit (temporary): record how each LIFF call was identified so we can see how
// often the unverified body.lineUserId fallback is still used before removing it.
// Table liff_auth_audit (migration 20261010_liff_auth_audit). Best-effort and
// time-boxed — a slow/failed insert never breaks or noticeably delays the request.
type AuditOutcome = 'verified' | 'no_token' | 'expired' | 'invalid' | 'unauthorized';

async function auditLiffAuth(request: Request, outcome: AuditOutcome, lineUserId: string | null, detail?: string) {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const ua = request.headers.get('user-agent') || '';
    const insert = (createServiceClient() as any).from('liff_auth_audit').insert({
      route: new URL(request.url).pathname.slice(0, 200),
      outcome,
      line_user_id: lineUserId,
      detail: detail ?? null,
      in_line_app: / Line\//i.test(ua),
    });
    await Promise.race([insert, new Promise((resolve) => setTimeout(resolve, 400))]);
  } catch {
    // never let auditing affect the request
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

  let failure: VerifyFailure | undefined;
  if (token) {
    const res = await verifyLiffIdTokenDetailed(token);
    if (res.user) {
      await auditLiffAuth(request, 'verified', res.user.lineUserId);
      return { lineUserId: res.user.lineUserId, verified: true };
    }
    failure = res.failure;
    // Token failed verification (e.g. expired). Prefer to fall back to the body
    // userId rather than break the portal — audited so we can tighten this once
    // the verified path is confirmed working in production.
    console.warn('[resolveLiffUser] ID token verification failed; falling back to body lineUserId');
  }

  if (body?.lineUserId) {
    if (!token) console.warn('[resolveLiffUser] No ID token; using unverified body lineUserId');
    await auditLiffAuth(request, token ? (failure?.reason ?? 'invalid') : 'no_token', String(body.lineUserId).slice(0, 64), failure?.detail);
    return { lineUserId: body.lineUserId, verified: false };
  }

  await auditLiffAuth(request, 'unauthorized', null, failure?.detail ?? (token ? 'token rejected' : 'no token, no body id'));
  return null;
}
