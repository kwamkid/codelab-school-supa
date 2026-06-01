import { restSelect } from '@/lib/supabase/rest'

const norm = (s: any) => String(s ?? '').trim().toLowerCase()

/**
 * Resolve a school input (full name / English / abbreviation / alias) to the
 * canonical school name stored on students. Falls back to the raw input when
 * no school matches (so exact name typing still works).
 */
export async function resolveSchoolName(input: string): Promise<string> {
  const raw = String(input ?? '').trim()
  if (!raw) return raw
  const q = norm(raw)
  try {
    const all = await restSelect<any>('schools', { select: 'name,name_en,abbreviation,aliases' })
    const hit = all.find((s) =>
      [s.name, s.name_en, s.abbreviation, ...(s.aliases || [])].some((v: string) => norm(v) === q)
    )
    return hit ? hit.name : raw
  } catch {
    return raw
  }
}
