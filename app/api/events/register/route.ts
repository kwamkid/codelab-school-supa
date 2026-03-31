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

    // Get event name
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('name')
      .eq('id', data.eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
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

    const attendeesByBranch = (schedule as any).attendees_by_branch || {}
    const maxAttendeesByBranch = (schedule as any).max_attendees_by_branch || {}

    // Check per-branch capacity
    const branchId = data.branchId
    const currentBranchAttendees = (attendeesByBranch[branchId] as number) || 0
    const branchMax = (maxAttendeesByBranch[branchId] as number) || 0

    if (branchMax > 0) {
      // Per-branch quota exists
      if (currentBranchAttendees >= branchMax) {
        return NextResponse.json({ error: 'สาขานี้เต็มแล้ว' }, { status: 400 })
      }
      if (currentBranchAttendees + data.attendeeCount > branchMax) {
        return NextResponse.json(
          { error: `สาขานี้เหลือที่ว่างอีก ${branchMax - currentBranchAttendees} ที่` },
          { status: 400 }
        )
      }
    } else {
      // Fallback: check total capacity
      const currentTotal = Object.values(attendeesByBranch).reduce(
        (sum: number, count: any) => sum + count, 0
      ) as number
      if (currentTotal + data.attendeeCount > (schedule as any).max_attendees) {
        return NextResponse.json(
          { error: `เหลือที่ว่างอีก ${(schedule as any).max_attendees - currentTotal} ที่` },
          { status: 400 }
        )
      }
    }

    // Prepare registration data
    const registrationData = {
      event_id: data.eventId,
      event_name: (event as any).name,
      schedule_id: data.scheduleId,
      schedule_date: data.scheduleDate,
      schedule_time: `${(schedule as any).start_time || ''} - ${(schedule as any).end_time || ''}`,
      branch_id: data.branchId,
      line_user_id: data.lineUserId || null,
      parent_name: data.parentName,
      parent_phone: data.parentPhone,
      parent_email: data.parentEmail || null,
      status: 'confirmed',
      attendee_count: data.attendeeCount,
      is_guest: data.isGuest || false,
      students: (data.students || []).map((s: any) => ({
        ...s,
        birthdate: s.birthdate || null
      })),
      parents: (data.parents || []).map((p: any) => ({
        name: p.name,
        phone: p.phone,
        email: p.email || null,
        isMainContact: p.isMainContact || false,
      })),
      registered_from: 'liff',
      registered_at: new Date().toISOString()
    }

    // Create registration
    const { data: result, error: insertError } = await supabase
      .from('event_registrations' as any)
      .insert(registrationData as any)
      .select('id')
      .single()

    if (insertError) throw insertError

    const registrationId = (result as any).id
    console.log('[API] Registration created:', registrationId)

    // Insert students into event_registration_students
    if (data.students && data.students.length > 0) {
      const studentRows = data.students.map((s: any) => ({
        registration_id: registrationId,
        student_id: s.studentId || null,
        name: s.name,
        nickname: s.nickname || '',
        birthdate: s.birthdate || null,
        school_name: s.schoolName || null,
        grade_level: s.gradeLevel || null,
      }))

      const { error: studentError } = await supabase
        .from('event_registration_students' as any)
        .insert(studentRows as any)

      if (studentError) {
        console.error('[API] Error inserting students:', studentError)
      }
    }

    // Insert parents into event_registration_parents
    // Always include main contact, plus additional parents from form
    const parentRows: any[] = []

    // Main contact is always a parent
    parentRows.push({
      registration_id: registrationId,
      name: data.parentName,
      phone: data.parentPhone,
      email: data.parentEmail || null,
      is_main_contact: true,
    })

    // Additional parents (when countingMethod === 'parents')
    if (data.parents && data.parents.length > 0) {
      for (const p of data.parents) {
        // Skip if same as main contact
        if (p.phone === data.parentPhone) continue
        parentRows.push({
          registration_id: registrationId,
          name: p.name,
          phone: p.phone,
          email: p.email || null,
          is_main_contact: p.isMainContact || false,
        })
      }
    }

    const { error: parentError } = await supabase
      .from('event_registration_parents' as any)
      .insert(parentRows as any)

    if (parentError) {
      console.error('[API] Error inserting parents:', parentError)
    }

    // Fire FB conversion event (await so Vercel doesn't kill the function early)
    try {
      const fbResult = await sendFBConversionInternal({
        event_type: 'event_join',
        phone: data.parentPhone,
        email: data.parentEmail || undefined,
        member_id: data.parentId || undefined,
        entity_id: registrationId,
        branch_id: data.branchId,
      })
      console.log('[FB CAPI] Event registration result:', JSON.stringify(fbResult))
    } catch (fbErr) {
      console.error('[FB CAPI] Event registration error:', fbErr)
    }

    // Update schedule attendee count
    const updatedAttendeesByBranch = {
      ...attendeesByBranch,
      [data.branchId]: currentBranchAttendees + data.attendeeCount
    }

    // Check if any branch is full → mark schedule full if ALL branches are full
    const allBranchesFull = Object.entries(maxAttendeesByBranch).every(([bid, max]) => {
      const current = (updatedAttendeesByBranch[bid] as number) || 0
      return current >= (max as number)
    })

    const { error: updateError } = await supabase
      .from('event_schedules' as any)
      .update({
        attendees_by_branch: updatedAttendeesByBranch,
        status: allBranchesFull && Object.keys(maxAttendeesByBranch).length > 0 ? 'full' : 'available',
      } as any)
      .eq('id', data.scheduleId)

    if (updateError) {
      console.error('[API] Error updating schedule:', updateError)
    }

    console.log('[API] Schedule updated')

    return NextResponse.json({
      success: true,
      registrationId
    })
  } catch (error: any) {
    console.error('[API] Registration error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create registration' }, { status: 500 })
  }
}