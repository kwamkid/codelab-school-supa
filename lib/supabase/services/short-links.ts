// lib/supabase/services/short-links.ts
//
// Generic short-link service (server-side, service role).
// First use case: event registration links — turns the long
// /liff/events/register/<uuid> path into /e/<code>.

import { createServiceClient } from '../server'

// Code alphabet: no ambiguous chars (0/O, 1/l/I) so codes are easy to read/type.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const CODE_LENGTH = 6

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
  }
  return code
}

/**
 * Get the existing short link for a (kind, refId), or create one.
 * Reuses the same code on repeat calls so a link shared earlier keeps working.
 * Returns the short code (e.g. "Xa9k2b").
 */
export async function getOrCreateShortLink(
  kind: string,
  refId: string,
  targetPath: string,
  createdBy?: string
): Promise<string> {
  const supabase = createServiceClient()

  // Reuse existing link for this ref if present.
  const { data: existing } = await (supabase as any)
    .from('short_links')
    .select('code')
    .eq('kind', kind)
    .eq('ref_id', refId)
    .maybeSingle()

  if (existing?.code) {
    return existing.code as string
  }

  // Create a new one, retrying on the (rare) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const { error } = await (supabase as any)
      .from('short_links')
      .insert({
        code,
        target_path: targetPath,
        kind,
        ref_id: refId,
        created_by: createdBy ?? null,
      })

    if (!error) {
      return code
    }

    // 23505 = unique_violation. If it's the (kind, ref_id) index, another
    // request just created it — fetch and return that one.
    if (error.code === '23505') {
      const { data: raced } = await (supabase as any)
        .from('short_links')
        .select('code')
        .eq('kind', kind)
        .eq('ref_id', refId)
        .maybeSingle()
      if (raced?.code) return raced.code as string
      // Otherwise it was a code collision — loop and try a new code.
      continue
    }

    console.error('Error creating short link:', error)
    throw new Error('Failed to create short link')
  }

  throw new Error('Failed to create short link after multiple attempts')
}

/** Convenience wrapper for event registration links. */
export async function getOrCreateEventShortLink(
  eventId: string,
  createdBy?: string
): Promise<string> {
  return getOrCreateShortLink(
    'event',
    eventId,
    `/liff/events/register/${eventId}`,
    createdBy
  )
}

/** Resolve a code → target path (null if not found). */
export async function resolveShortLink(code: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('short_links')
    .select('target_path')
    .eq('code', code)
    .maybeSingle()
  return data?.target_path ?? null
}

/** Best-effort atomic click increment. */
export async function recordShortLinkClick(code: string): Promise<void> {
  const supabase = createServiceClient()
  try {
    await (supabase as any).rpc('increment_short_link_click', { p_code: code })
  } catch (error) {
    console.error('Error incrementing short link click:', error)
  }
}
