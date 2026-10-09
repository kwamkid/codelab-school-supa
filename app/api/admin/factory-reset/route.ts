// app/api/admin/factory-reset/route.ts
// Server wrapper around the server-only factory-reset service (uses service role).
// GET            → getDataStatistics()
// POST           → factoryReset() (runs to completion; progress is not streamed)

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, bearer } from '@/lib/server/admin-auth'
import { getDataStatistics, factoryReset } from '@/lib/supabase/services/factory-reset'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    return NextResponse.json(await getDataStatistics())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(bearer(request.headers.get('authorization')))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    // The onProgress callback can't stream over a single HTTP response; the client
    // shows an indeterminate progress state while this runs to completion.
    await factoryReset()
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
