import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (eventId) {
      // Get single event
      const { data: event, error } = await supabase.from('events').select('*').eq('id', eventId).single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Event not found' }, { status: 404 })
        }
        throw error
      }

      // Transform to expected format
      const transformedEvent = {
        id: event.id,
        name: event.name,
        description: event.description,
        status: event.status,
        isActive: event.is_active,
        branchIds: event.branch_ids || [],
        registrationStartDate: event.registration_start_date,
        registrationEndDate: event.registration_end_date,
        createdAt: event.created_at,
        updatedAt: event.updated_at
      }

      return NextResponse.json({ event: transformedEvent })
    } else {
      // Get all published events
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform to expected format
      const transformedEvents = (events || []).map(event => ({
        id: event.id,
        name: event.name,
        description: event.description,
        status: event.status,
        isActive: event.is_active,
        branchIds: event.branch_ids || [],
        registrationStartDate: event.registration_start_date,
        registrationEndDate: event.registration_end_date,
        createdAt: event.created_at,
        updatedAt: event.updated_at
      }))

      return NextResponse.json({ events: transformedEvents })
    }
  } catch (error: any) {
    console.error('[API] Error getting events:', error)
    return NextResponse.json({ error: 'Failed to get events' }, { status: 500 })
  }
}

// Get event schedules
export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  try {
    const { eventId } = await request.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    const { data: schedules, error } = await supabase
      .from('event_schedules')
      .select('*')
      .eq('event_id', eventId)
      .order('date', { ascending: true })

    if (error) throw error

    // Transform to expected format. Derive status from live seat counts rather
    // than the stored `status` field, which can go stale (reset to 'available' on
    // any cancellation, ignores per-branch quotas) — keeps it consistent with the
    // admin view and prevents booking a full slot. A cancelled slot stays cancelled.
    const transformedSchedules = (schedules || []).map(schedule => {
      const attendeesByBranch = schedule.attendees_by_branch || {}
      const totalAttendees = Object.values(attendeesByBranch).reduce(
        (sum: number, c: any) => sum + (Number(c) || 0), 0
      )
      const remaining = (schedule.max_attendees ?? 0) - totalAttendees
      const status = schedule.status === 'cancelled'
        ? 'cancelled'
        : (remaining > 0 ? 'available' : 'full')
      return {
        id: schedule.id,
        eventId: schedule.event_id,
        date: schedule.date,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        maxAttendees: schedule.max_attendees,
        attendeesByBranch,
        status
      }
    })

    return NextResponse.json({ schedules: transformedSchedules })
  } catch (error: any) {
    console.error('[API] Error getting schedules:', error)
    return NextResponse.json({ error: 'Failed to get schedules' }, { status: 500 })
  }
}