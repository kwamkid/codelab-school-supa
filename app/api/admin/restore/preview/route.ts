// app/api/admin/restore/preview/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const fileName = request.nextUrl.searchParams.get('fileName')

    if (!fileName || !/^backup_week_[1-4]\.json$/.test(fileName)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Download backup file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('backups')
      .download(fileName)

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `ไม่พบไฟล์ ${fileName}: ${downloadError?.message || 'File not found'}` },
        { status: 404 }
      )
    }

    const backupText = await fileData.text()
    const backup = JSON.parse(backupText)

    // Return metadata + per-table counts (no actual data)
    const tableSummary: Record<string, number> = {}
    if (backup.tables) {
      for (const [tableName, tableData] of Object.entries(backup.tables)) {
        tableSummary[tableName] = (tableData as { count: number }).count || 0
      }
    }

    return NextResponse.json({
      metadata: backup.metadata,
      tables: tableSummary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[restore/preview] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
