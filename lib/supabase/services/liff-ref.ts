// lib/supabase/services/liff-ref.ts
// Shared, cached reference-data loader for LIFF server routes. subjects/teachers/
// branches/rooms change rarely, so cache them in-memory for a short TTL instead of
// re-querying all four on every request (schedule + makeup both need them).

interface RefMaps {
  subjectMap: Map<string, any>
  teacherMap: Map<string, any>
  branchMap: Map<string, any>
  roomMap: Map<string, any>
}

let cache: { at: number; data: RefMaps } | null = null
const TTL_MS = 60_000 // 1 minute

export async function getReferenceMaps(supabase: any): Promise<RefMaps> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.data

  const [{ data: subjects }, { data: teachers }, { data: branches }, { data: rooms }] = await Promise.all([
    supabase.from('subjects').select('*'),
    supabase.from('teachers').select('*'),
    supabase.from('branches').select('*'),
    supabase.from('rooms').select('*'),
  ])

  const data: RefMaps = {
    subjectMap: new Map((subjects || []).map((s: any) => [s.id, s])),
    teacherMap: new Map((teachers || []).map((t: any) => [t.id, t])),
    branchMap: new Map((branches || []).map((b: any) => [b.id, b])),
    roomMap: new Map((rooms || []).map((r: any) => [r.id, r])),
  }
  cache = { at: now, data }
  return data
}
