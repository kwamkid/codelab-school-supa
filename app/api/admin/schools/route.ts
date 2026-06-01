import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect, restInsert } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET — list schools for management (staff)
export async function GET(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const rows = await restSelect('schools', { select: '*', order: 'name.asc' })
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — create school (staff)
export async function POST(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { name, nameEn, abbreviation, aliases, province } = await request.json()
    if (!name || !String(name).trim()) return NextResponse.json({ error: 'กรุณาระบุชื่อโรงเรียน' }, { status: 400 })
    const [created] = await restInsert('schools', {
      name: String(name).trim(),
      name_en: nameEn || null,
      abbreviation: abbreviation || null,
      aliases: Array.isArray(aliases) ? aliases.map((a: string) => a.trim()).filter(Boolean) : [],
      province: province || null,
    })
    return NextResponse.json(created)
  } catch (err: any) {
    if (String(err.message).includes('duplicate')) return NextResponse.json({ error: 'มีโรงเรียนชื่อนี้แล้ว' }, { status: 400 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
