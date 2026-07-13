// lib/vex/public-team.ts
// Resolve a team from a public link slug. A slug encodes team_number + a token;
// the token must match the RIGHT kind (event vs practice) — the two tokens are
// NOT interchangeable, so an event link can't be used to reach practice data.

import { vexDb } from './supabase'
import { parseLinkSlug } from './tokens'
import type { LinkKind, Team } from './types'

/**
 * Resolve a team by its public slug for a given link kind.
 * Requires team_number + token to match, and the token to be the correct kind.
 * Returns null on any mismatch (caller returns 404).
 */
export async function resolveTeamBySlug(slug: string, kind: LinkKind): Promise<Team | null> {
  const parsed = parseLinkSlug(slug)
  if (!parsed) return null

  const tokenColumn = kind === 'event' ? 'event_token' : 'practice_token'

  const { data, error } = await vexDb()
    .from('teams')
    .select('*')
    .eq('team_number', parsed.teamNumber)
    .eq(tokenColumn, parsed.token)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[vex resolveTeamBySlug] query error:', error)
    return null
  }
  return (data as Team) || null
}
