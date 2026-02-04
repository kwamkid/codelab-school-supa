/**
 * Utility functions for normalizing Thai school names.
 * Handles common variations like "โรงเรียนสาธิต", "รร.สาธิต", "สาธิต"
 */

const PREFIXES = [
  'โรงเรียน',
  'ร.ร.',
  'รร.',
  'ร.ร',
  'รร',
  'school',
  'School',
  'SCHOOL',
]

/**
 * Normalizes a school name by stripping common Thai school prefixes
 * and collapsing whitespace.
 *
 * Examples:
 *   "โรงเรียนสาธิต"  -> "สาธิต"
 *   "รร.สาธิต"       -> "สาธิต"
 *   "ร.ร. สาธิต"     -> "สาธิต"
 *   "สาธิต"          -> "สาธิต"
 */
export function normalizeSchoolName(name: string): string {
  if (!name) return ''

  let normalized = name.trim()

  for (const prefix of PREFIXES) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length)
      break
    }
  }

  return normalized.replace(/\s+/g, ' ').trim()
}

/**
 * Returns a lowercase key for Map-based grouping.
 */
export function schoolNameKey(name: string): string {
  return normalizeSchoolName(name).toLowerCase()
}

export interface SchoolGroup {
  displayName: string
  count: number
  variants: string[]
}

/**
 * Groups an array of raw school names by normalized key,
 * picking the most common original variant as displayName.
 */
export function groupSchoolNames(schoolNames: string[]): SchoolGroup[] {
  const groups = new Map<string, {
    variantCounts: Map<string, number>
    total: number
  }>()

  for (const raw of schoolNames) {
    if (!raw || !raw.trim()) continue

    const key = schoolNameKey(raw)
    if (!key) continue

    if (!groups.has(key)) {
      groups.set(key, { variantCounts: new Map(), total: 0 })
    }

    const group = groups.get(key)!
    group.total++
    group.variantCounts.set(raw, (group.variantCounts.get(raw) || 0) + 1)
  }

  return Array.from(groups.entries())
    .map(([, group]) => {
      let bestVariant = ''
      let bestCount = 0
      for (const [variant, count] of group.variantCounts) {
        if (count > bestCount) {
          bestVariant = variant
          bestCount = count
        }
      }

      return {
        displayName: bestVariant,
        count: group.total,
        variants: Array.from(group.variantCounts.keys()),
      }
    })
    .sort((a, b) => b.count - a.count)
}
