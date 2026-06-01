import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restPatch, restDelete } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    const b = await request.json()
    const data: Record<string, any> = { updated_at: new Date().toISOString() }
    if (b.name !== undefined) data.name = String(b.name).trim()
    if (b.nameEn !== undefined) data.name_en = b.nameEn || null
    if (b.abbreviation !== undefined) data.abbreviation = b.abbreviation || null
    if (b.aliases !== undefined) data.aliases = Array.isArray(b.aliases) ? b.aliases.map((a: string) => a.trim()).filter(Boolean) : []
    if (b.province !== undefined) data.province = b.province || null
    if (b.isActive !== undefined) data.is_active = b.isActive
    const [updated] = await restPatch('schools', { id: `eq.${id}` }, data)
    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    await restDelete('schools', { id: `eq.${id}` })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
