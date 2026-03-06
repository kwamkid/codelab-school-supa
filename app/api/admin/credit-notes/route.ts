import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - List credit notes by enrollment
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const enrollmentId = searchParams.get('enrollmentId')

  if (!enrollmentId) {
    return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data, error } = await (supabase as any)
    .from('credit_notes')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
