// app/api/admin/link-tokens/route.ts
// Server route for admin to generate a parent LINE-link token.
// The generateLinkToken service uses the service role (server-only), so it must
// NOT be imported into client components — the admin QR component calls this route instead.

import { NextRequest, NextResponse } from 'next/server'
import { generateLinkToken } from '@/lib/supabase/services/link-tokens'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parentId = body?.parentId as string | undefined

    if (!parentId) {
      return NextResponse.json({ error: 'parentId is required' }, { status: 400 })
    }

    const token = await generateLinkToken(parentId)
    return NextResponse.json({ token })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create link token'
    // Surface the specific "already linked" case so the client can show the right UI.
    const status = message === 'Parent already linked to LINE' ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
