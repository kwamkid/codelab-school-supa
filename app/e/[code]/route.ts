import { NextRequest, NextResponse } from 'next/server'
import { resolveShortLink, recordShortLinkClick } from '@/lib/supabase/services/short-links'

export const dynamic = 'force-dynamic'

// GET /e/<code> -> 302 redirect to the stored target path (+ best-effort click count).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const targetPath = await resolveShortLink(code)

  if (!targetPath) {
    // Unknown code -> send to the home page.
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Count the click without blocking the redirect.
  void recordShortLinkClick(code)

  return NextResponse.redirect(new URL(targetPath, request.url))
}
