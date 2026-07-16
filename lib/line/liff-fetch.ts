// lib/line/liff-fetch.ts
// Client helper for calling LIFF API routes. Attaches the LINE ID token as a
// Bearer header so the server can verify the caller's identity. Use this for all
// LIFF data access instead of calling Supabase services directly (which run as
// anon and are blocked by RLS).

import { getLiffInstance } from './liff-client';

export async function liffFetch<T = any>(
  path: string,
  body?: any,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST'
): Promise<T> {
  const liff = getLiffInstance();
  let idToken: string | null = null;
  try {
    idToken = liff?.getIDToken?.() ?? null;
  } catch {
    idToken = null;
  }

  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
  }
  return data as T;
}
