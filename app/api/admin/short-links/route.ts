import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, bearer } from '@/lib/server/admin-auth'
import { getOrCreateEventShortLink } from '@/lib/supabase/services/short-links'

export const dynamic = 'force-dynamic'

// POST { eventId } -> { code } : create (or reuse) a short link for an event.
export async function POST(request: NextRequest) {
  const auth = await requireStaff(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (auth.role === 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const { eventId } = await request.json()
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

    const code = await getOrCreateEventShortLink(eventId)
    return NextResponse.json({ code })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
