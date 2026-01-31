// app/api/admin/backup-logs/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('backup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    console.log('[backup-logs] Query result:', { count: data?.length, error: error?.message })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[backup-logs] Exception:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
