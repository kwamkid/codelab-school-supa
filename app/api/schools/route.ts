import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeSchoolName } from '@/lib/utils/normalize-school-name'
import { restSelect } from '@/lib/supabase/rest'
import { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Supabase returns max 1000 rows per query by default.
async function fetchAllRows<T>(
  queryFn: (from: number, to: number) => ReturnType<ReturnType<SupabaseClient['from']>['select']>
): Promise<T[]> {
  const PAGE_SIZE = 1000
  const allRows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await queryFn(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    allRows.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allRows
}

// GET /api/schools?search=xxx - search schools (alias-aware: name / English / abbreviation / aliases)
export async function GET(request: NextRequest) {
  try {
    const search = (new URL(request.url).searchParams.get('search') || '').trim().toLowerCase()

    const all = await restSelect<any>('schools', {
      is_active: 'eq.true',
      select: 'name,name_en,abbreviation,aliases',
      order: 'name.asc',
    })

    const matched = (search
      ? all.filter((s) =>
          [s.name, s.name_en, s.abbreviation, ...(s.aliases || [])]
            .some((v: string) => (v || '').toLowerCase().includes(search))
        )
      : all
    ).slice(0, 50)

    const schools = matched.map((s) => ({ name: s.name, abbreviation: s.abbreviation, nameEn: s.name_en }))
    return NextResponse.json({ success: true, schools })
  } catch (error) {
    console.error('Error fetching schools:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch schools' }, { status: 500 })
  }
}

// POST /api/schools - merge or normalize school names
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()

    if (body.action === 'merge') {
      const { target, sources } = body as { target: string; sources: string[] }

      if (!target || !sources?.length) {
        return NextResponse.json({ success: false, error: 'Missing target or sources' }, { status: 400 })
      }

      let updated = 0
      for (const source of sources) {
        if (source === target) continue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updatedRows } = await (supabase.from('students') as any)
          .update({ school_name: target })
          .eq('school_name', source)
          .select('id')

        updated += updatedRows?.length || 0
      }

      return NextResponse.json({ success: true, updated })
    }

    if (body.action === 'normalize') {
      // Normalize all school names: strip prefixes, trim
      const students = await fetchAllRows<{ id: string; school_name: string }>((from, to) =>
        (supabase as any)
          .from('students')
          .select('id, school_name')
          .not('school_name', 'is', null)
          .neq('school_name', '')
          .range(from, to)
      )

      let updated = 0
      for (const student of students) {
        const normalized = normalizeSchoolName(student.school_name)
        if (normalized !== student.school_name) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('students') as any)
            .update({ school_name: normalized })
            .eq('id', student.id)
          updated++
        }
      }

      return NextResponse.json({ success: true, updated })
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Error in schools POST:', error)
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }
}
