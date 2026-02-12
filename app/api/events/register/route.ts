import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendFBConversionInternal } from '@/lib/fb/handler'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const data = await request.json()

    console.log('[API] Event registration request:', {
      eventId: data.eventId,
      scheduleId: data.scheduleId,
      branchId: data.branchId,
      isGuest: data.isGuest,
      attendeeCount: data.attendeeCount
    })

    // Validate required fields
    if (!data.eventId || !data.scheduleId || !data.branchId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get schedule to check capacity
    const { data: schedule, error: scheduleError } = await supabase
      .from('event_schedules')
      .select('*')
      .eq('id', data.scheduleId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const attendeesByBranch = schedule.attendees_by_branch || {}
    const currentAttendees = Object.values(attendeesByBranch).reduce(
      (sum: number, count: any) => sum + count,
      0
    ) as number

    // Check if full
    if (currentAttendees >= schedule.max_attendees) {
      return NextResponse.json({ error: 'This schedule is full' }, { status: 400 })
    }

    // Check if will exceed capacity
    if (currentAttendees + data.attendeeCount > schedule.max_attendees) {
      return NextResponse.json(
        { error: `Only ${schedule.max_attendees - currentAttendees} seats available` },
        { status: 400 }
      )
    }

    // Prepare registration data
    const registrationData = {
      event_id: data.eventId,
      schedule_id: data.scheduleId,
      branch_id: data.branchId,
      line_user_id: data.lineUserId || null,
      parent_name: data.parentName,
      parent_phone: data.parentPhone,
      parent_email: data.parentEmail || null,
      schedule_date: data.scheduleDate,
      status: 'confirmed',
      attendee_count: data.attendeeCount,
      is_guest: data.isGuest || false,
      students: (data.students || []).map((s: any) => ({
        ...s,
        birthdate: s.birthdate || null
      })),
      registered_at: new Date().toISOString()
    }

    // Create registration
    const { data: result, error: insertError } = await supabase
      .from('event_registrations')
      .insert(registrationData)
      .select('id')
      .single()

    if (insertError) throw insertError

    console.log('[API] Registration created:', result.id)

    // Fire FB conversion event (await so Vercel doesn't kill the function early)
    try {
      const fbResult = await sendFBConversionInternal({
        event_type: 'event_join',
        phone: data.parentPhone,
        email: data.parentEmail || undefined,
        member_id: data.parentId || undefined,
        entity_id: result.id,
        branch_id: data.branchId,
      })
      console.log('[FB CAPI] Event registration result:', JSON.stringify(fbResult))
    } catch (fbErr) {
      console.error('[FB CAPI] Event registration error:', fbErr)
    }

    // Update schedule attendee count
    const currentBranchCount = (attendeesByBranch[data.branchId] as number) || 0
    const newTotal = currentAttendees + data.attendeeCount

    const updatedAttendeesByBranch = {
      ...attendeesByBranch,
      [data.branchId]: currentBranchCount + data.attendeeCount
    }

    const { error: updateError } = await supabase
      .from('event_schedules')
      .update({
        attendees_by_branch: updatedAttendeesByBranch,
        status: newTotal >= schedule.max_attendees ? 'full' : 'available',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.scheduleId)

    if (updateError) {
      console.error('[API] Error updating schedule:', updateError)
    }

    console.log('[API] Schedule updated')

    return NextResponse.json({
      success: true,
      registrationId: result.id
    })
  } catch (error: any) {
    console.error('[API] Registration error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create registration' }, { status: 500 })
  }
}