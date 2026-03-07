import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Direct PostgREST fetch — Supabase JS client .eq() has bug with untyped tables
async function queryTable(table: string, params: Record<string, string>) {
  const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || 'Query failed')
  }
  return res.json()
}

// GET - List credit notes by enrollment
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const enrollmentId = searchParams.get('enrollmentId')

  if (!enrollmentId) {
    return NextResponse.json({ error: 'enrollmentId is required' }, { status: 400 })
  }

  try {
    const data = await queryTable('credit_notes', {
      'select': '*',
      'enrollment_id': `eq.${enrollmentId}`,
      'order': 'created_at.desc',
    })

    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
