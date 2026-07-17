// lib/vex/public-team.ts
// Resolve a team from a public link slug. A slug encodes team_number + a token.
//
// Since the unified team link (2026-07-17), the event and practice tokens are
// interchangeable entry points: EITHER token resolves the team for BOTH kinds,
// so one shared link + the bottom tab bar covers competition and practice
// views, and every previously-distributed link keeps working. (Both links were
// always handed to the same audience — the team's parents — so the split was
// routing, not a security boundary.)

import { vexDb } from './supabase'
import { parseLinkSlug } from './tokens'
import type { LinkKind, Team } from './types'

/**
 * Resolve a team by its public slug. `kind` selects which DATA the caller wants
 * (event vs practice view) — it no longer restricts which token may be used.
 * Matching is by TOKEN ONLY: the random token is the actual secret, and the
 * team_number in the slug is cosmetic — so renaming a team (e.g. the 3883F.
 * → 3883F cleanup) never breaks links that were already handed out.
 * Returns null on any mismatch (caller returns 404).
 */
export async function resolveTeamBySlug(slug: string, _kind: LinkKind): Promise<Team | null> {
  const parsed = parseLinkSlug(slug)
  if (!parsed) return null
  // Tokens are generated as URL-safe alphanumerics; reject anything else so the
  // .or() filter string below can't be shaped by the caller.
  if (!/^[A-Za-z0-9_-]+$/.test(parsed.token)) return null

  const { data, error } = await vexDb()
    .from('teams')
    .select('*')
    .or(`event_token.eq.${parsed.token},practice_token.eq.${parsed.token}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[vex resolveTeamBySlug] query error:', error)
    return null
  }
  return (data as Team) || null
}
