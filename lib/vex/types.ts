// lib/vex/types.ts
// Domain types + display labels for the VEX team-management feature. Mirrors the
// vex.* schema. No Admin/Parent types here — identity is reused from public.*.

// The DB enum vex.vex_level still includes 'v5_uni', so the type keeps it (reads
// must stay type-safe). It's just no longer offered in the UI (see LEVELS).
export type Level = 'iq_elem' | 'iq_ms' | 'v5_ms' | 'v5_hs' | 'v5_uni'

// Levels offered in the UI (University removed for now).
export const LEVELS: Level[] = ['iq_elem', 'iq_ms', 'v5_ms', 'v5_hs']

export type Program = 'iq' | 'v5'

/** Public path to each program's logo (in public/vex/). */
export const PROGRAM_LOGO: Record<Program, string> = {
  iq: '/vex/VEX IQ RC Full Color.svg',
  v5: '/vex/VEX V5 RC Full Color.svg',
}

/** Per-level metadata: which program logo + the short grade label (ES/MS/HS). */
export const LEVEL_META: Record<Level, { program: Program; short: string; grade: string }> = {
  iq_elem: { program: 'iq', short: 'ES', grade: 'Elementary' },
  iq_ms: { program: 'iq', short: 'MS', grade: 'Middle School' },
  v5_ms: { program: 'v5', short: 'MS', grade: 'Middle School' },
  v5_hs: { program: 'v5', short: 'HS', grade: 'High School' },
  v5_uni: { program: 'v5', short: 'UNI', grade: 'University' },
}

/** Full display label (kept for a11y / tooltips / selects). */
export const LEVEL_LABELS: Record<Level, string> = {
  iq_elem: 'VEX IQ — Elementary',
  iq_ms: 'VEX IQ — Middle School',
  v5_ms: 'VEX V5 — Middle School',
  v5_hs: 'VEX V5 — High School',
  v5_uni: 'VEX V5 — University',
}

export function levelLabel(level: Level): string {
  return LEVEL_LABELS[level] ?? level
}

export type RsvpStatus = 'pend' | 'go' | 'no'
export type PracticeStatus = 'proposed' | 'approved' | 'rejected'
export type ActorType = 'admin' | 'parent' | 'system'

export interface Team {
  id: string
  team_number: string
  name: string | null
  level: Level
  branch_id: string | null
  slug: string
  event_token: string | null
  practice_token: string | null
  created_at: string
}

export interface Kid {
  id: string
  team_id: string
  nickname: string
  full_name: string | null
  created_at: string
}

export interface VexEvent {
  id: string
  name: string
  date_start: string | null
  date_end: string | null
  place: string | null
  has_world_spot: boolean
  sort_order: number
  created_at: string
  /** Levels this event is open to (from vex.event_levels). Populated by queries that join. */
  levels?: Level[]
}

export interface Attendance {
  id: string
  event_id: string
  kid_id: string
  status: RsvpStatus
  parent_id: string | null
  updated_by: string | null
  updated_at: string
}

export interface Practice {
  id: string
  team_id: string
  kid_id: string
  parent_id: string | null
  practice_date: string
  start_time: string | null
  end_time: string | null
  note: string | null
  status: PracticeStatus
  edited_by_admin: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

/** The two kinds of public link a team exposes. */
export type LinkKind = 'event' | 'practice'
