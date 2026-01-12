import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      console.error('No active session:', error)
      return NextResponse.json({ error: 'No active session' }, { status: 401 })
    }

    // Return access token
    return NextResponse.json(session.access_token)
  } catch (error) {
    console.error('Error getting auth token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
