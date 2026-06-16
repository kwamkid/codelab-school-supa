import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateEventShortLink } from '@/lib/supabase/services/short-links'

export const dynamic = 'force-dynamic'

// POST { eventId } -> { code } : create (or reuse) a short link for an event.
export async function POST(request: NextRequest) {
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
