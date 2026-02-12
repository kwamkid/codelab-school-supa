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

    let query = supabase
      .from('fb_conversion_logs')
      .select(selectColumns, { count: 'exact' })
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

    const { data, error, count } = await query

    if (error) throw error

    // Summary counts using separate count queries (no full row fetch)
    const [
      { count: totalCount },
      { count: sentCount },
      { count: failedCount },
      { count: registerCount },
      { count: trialCount },
      { count: eventJoinCount },
      { count: purchaseCount },
    ] = await Promise.all([
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }),
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }).eq('fb_status', 'sent'),
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }).eq('fb_status', 'failed'),
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }).eq('event_type', 'register'),
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }).eq('event_type', 'trial'),
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }).eq('event_type', 'event_join'),
      supabase.from('fb_conversion_logs').select('id', { count: 'exact', head: true }).eq('event_type', 'purchase'),
    ])

    const total = totalCount || 0
    const sent = sentCount || 0
    const failed = failedCount || 0

    const summary = {
      total,
      sent,
      failed,
      pending: total - sent - failed,
      byEventType: {
        ...(registerCount ? { register: registerCount } : {}),
        ...(trialCount ? { trial: trialCount } : {}),
        ...(eventJoinCount ? { event_join: eventJoinCount } : {}),
        ...(purchaseCount ? { purchase: purchaseCount } : {}),
      },
    }

    return NextResponse.json({
      success: true,
      logs: data || [],
      total: count || 0,
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
