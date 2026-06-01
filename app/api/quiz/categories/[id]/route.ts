import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { restPatch, restDelete } from '@/lib/supabase/rest'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  try {
    const body = await request.json()
    const data: Record<string, any> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.emoji !== undefined) data.emoji = body.emoji
    if (body.description !== undefined) data.description = body.description
    if (body.color !== undefined) data.color = body.color
    if (body.iconType !== undefined) data.icon_type = body.iconType
    const [updated] = await restPatch('quiz_categories', { id: `eq.${id}` }, data)
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
    await restDelete('quiz_categories', { id: `eq.${id}` })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
