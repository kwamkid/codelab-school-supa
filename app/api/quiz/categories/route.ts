import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restSelect, restInsert } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

// GET — list categories (public; used by student + admin)
export async function GET() {
  try {
    const rows = await restSelect('quiz_categories', { select: '*', order: 'name.asc' })
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — create category (staff)
export async function POST(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { name, emoji, description, color, iconType } = await request.json()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const [created] = await restInsert('quiz_categories', {
      name,
      emoji: emoji || '📚',
      description: description || null,
      color: color || 'from-purple-400 to-pink-400',
      icon_type: iconType || null,
    })
    return NextResponse.json(created)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
