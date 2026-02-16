import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const eventType = searchParams.get('eventType')
    const fbStatus = searchParams.get('fbStatus')
    const memberId = searchParams.get('memberId')

    const selectColumns = 'id, event_type, fb_event_name, event_id, member_id, phone_hash, fb_status, audience_status, is_resend, created_at'

    // Fetch all rows for summary + accurate count (count: 'exact' is unreliable with @supabase/ssr)
    const summaryClient = createServiceClient()
    const { data: allLogs } = await summaryClient
      .from('fb_conversion_logs')
      .select('id, fb_status, event_type')

    const allRows = (allLogs || []) as Array<{ id: string; fb_status: string; event_type: string }>

    // Summary counts (always from all data, no filters)
    const totalCount = allRows.length
    const sentCount = allRows.filter(r => r.fb_status === 'sent').length
    const failedCount = allRows.filter(r => r.fb_status === 'failed').length
    const registerCount = allRows.filter(r => r.event_type === 'register').length
    const trialCount = allRows.filter(r => r.event_type === 'trial').length
    const eventJoinCount = allRows.filter(r => r.event_type === 'event_join').length
    const purchaseCount = allRows.filter(r => r.event_type === 'purchase').length

    const summary = {
      total: totalCount,
      sent: sentCount,
      failed: failedCount,
      pending: totalCount - sentCount - failedCount,
      byEventType: {
        ...(registerCount ? { register: registerCount } : {}),
        ...(trialCount ? { trial: trialCount } : {}),
        ...(eventJoinCount ? { event_join: eventJoinCount } : {}),
        ...(purchaseCount ? { purchase: purchaseCount } : {}),
      },
    }

    // Apply filters to get filtered count
    let filteredRows = allRows
    if (eventType && eventType !== 'all') {
      filteredRows = filteredRows.filter(r => r.event_type === eventType)
    }
    if (fbStatus && fbStatus !== 'all') {
      filteredRows = filteredRows.filter(r => r.fb_status === fbStatus)
    }
    if (memberId) {
      // memberId filter not in summary data, so we can't count here — use full count
    }
    const filteredTotal = filteredRows.length

    // Fetch paginated data for display
    let query = supabase
      .from('fb_conversion_logs')
      .select(selectColumns)
      .order('created_at', { ascending: false })

    if (eventType && eventType !== 'all') {
      query = query.eq('event_type', eventType)
    }
    if (fbStatus && fbStatus !== 'all') {
      query = query.eq('fb_status', fbStatus)
    }
    if (memberId) {
      query = query.eq('member_id', memberId)
    }

    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      logs: data || [],
      total: filteredTotal,
      page,
      pageSize,
      summary,
    })
  } catch (error) {
    console.error('[FB] logs error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs' },
      { status: 500 }
    )
  }
}
