// lib/vex/tokens.ts
// Public-link tokens. Each team has two: one for event RSVP, one for practice.
// A link slug is `<team_number>-<6char token>` (e.g. "2999A-a7k2m9"). team_number
// may itself contain letters (real VEX code), so parsing splits on the LAST hyphen.

import { customAlphabet } from 'nanoid'

// Unambiguous lowercase alnum: drop 0/o/1/l/i to avoid confusion when shared.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const nanoid6 = customAlphabet(ALPHABET, 6)

/** A fresh unguessable 6-char team token. */
export function newTeamToken(): string {
  return nanoid6()
}

/** Build the public link slug for a team + token. */
export function linkSlug(teamNumber: string, token: string): string {
  return `${teamNumber}-${token}`
}

/**
 * Split a slug into { teamNumber, token }. Splits on the LAST hyphen because
 * team_number can contain hyphens/letters. Returns null if malformed.
 */
export function parseLinkSlug(slug: string): { teamNumber: string; token: string } | null {
  if (!slug) return null
  const idx = slug.lastIndexOf('-')
  if (idx <= 0 || idx === slug.length - 1) return null
  const teamNumber = slug.slice(0, idx)
  const token = slug.slice(idx + 1)
  if (!teamNumber || !token) return null
  return { teamNumber, token }
}
