// app/api/events/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventSchedules,
  createEventSchedule,
  updateEventSchedule,
  deleteEventSchedule,
  getEventRegistrations,
  createEventRegistration,
  cancelEventRegistration,
  updateEventAttendance,
  getEventStatistics
} from '@/lib/supabase/services/events'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Admin user type
interface AdminUserData {
  uid: string
  email: string
  displayName: string
  role: 'super_admin' | 'branch_admin' | 'teacher'
  branchIds: string[]
  permissions?: {
    canManageUsers?: boolean
    canManageSettings?: boolean
    canViewReports?: boolean
    canManageAllBranches?: boolean
  }
  isActive: boolean
}

// Helper to verify auth token
async function verifyAuth(request: NextRequest): Promise<AdminUserData | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.split('Bearer ')[1]

    // Verify JWT token with Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const {
      data: { user },
      error
    } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return null
    }

    // Get admin user details from database
    const supabase = createServiceClient()
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (adminError || !adminUser || !adminUser.is_active) {
      return null
    }

    return {
      uid: user.id,
      email: adminUser.email,
      displayName: adminUser.display_name,
      role: adminUser.role,
      branchIds: adminUser.branch_ids || [],
      permissions: adminUser.permissions,
      isActive: adminUser.is_active
    } as AdminUserData
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

// Parse path parameters
function parsePath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  // Remove 'api' and 'events' from the beginning
  const cleanParts = parts.slice(2);
  
  return {
    eventId: cleanParts[0],
    subResource: cleanParts[1], // 'registrations', 'schedules', 'statistics', 'attendance'
    subResourceId: cleanParts[2]
  };
}

// GET handler
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { eventId, subResource, subResourceId } = parsePath(request.nextUrl.pathname);
    
    // GET /api/events - List all events
    if (!eventId) {
      const { searchParams } = new URL(request.url);
      const branchId = searchParams.get('branchId');
      
      // Check branch access
      if (branchId && user.role !== 'super_admin' && 
          user.branchIds?.length > 0 && !user.branchIds.includes(branchId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      
      const events = await getEvents(branchId || undefined);
      return NextResponse.json(events);
    }
    
    // GET /api/events/[id] - Get single event
    if (eventId && !subResource) {
      const event = await getEvent(eventId);
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      
      // Check branch access
      if (user.role !== 'super_admin' && user.branchIds?.length > 0) {
        const hasAccess = event.branchIds.some(bid => user.branchIds.includes(bid));
        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
      
      return NextResponse.json(event);
    }
    
    // GET /api/events/[id]/schedules - Get event schedules
    if (subResource === 'schedules') {
      const schedules = await getEventSchedules(eventId);
      return NextResponse.json(schedules);
    }
    
    // GET /api/events/[id]/registrations - Get event registrations
    if (subResource === 'registrations') {
      const { searchParams } = new URL(request.url);
      const options = {
        scheduleId: searchParams.get('scheduleId') || undefined,
        branchId: searchParams.get('branchId') || undefined,
        status: searchParams.get('status') as any || undefined
      };
      
      const registrations = await getEventRegistrations(eventId, options);
      
      // Filter by branch access
      if (user.role !== 'super_admin' && user.branchIds?.length > 0) {
        const filtered = registrations.filter(r => user.branchIds.includes(r.branchId));
        return NextResponse.json(filtered);
      }
      
      return NextResponse.json(registrations);
    }
    
    // GET /api/events/[id]/statistics - Get event statistics
    if (subResource === 'statistics') {
      const stats = await getEventStatistics(eventId);
      return NextResponse.json(stats);
    }
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST handler
export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { eventId, subResource } = parsePath(request.nextUrl.pathname);
    
    // POST /api/events - Create new event
    if (!eventId) {
      // Only admin can create events
      if (user.role === 'teacher') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      
      // Validate branch access
      if (user.role !== 'super_admin' && user.branchIds?.length > 0) {
        const invalidBranches = body.branchIds.filter(
          (bid: string) => !user.branchIds.includes(bid)
        );
        if (invalidBranches.length > 0) {
          return NextResponse.json(
            { error: 'Cannot create event for unauthorized branches' },
            { status: 403 }
          );
        }
      }
      
      const eventId = await createEvent(body, user.uid);
      return NextResponse.json({ id: eventId, message: 'Event created successfully' });
    }
    
    // POST /api/events/[id]/schedules - Create event schedule
    if (subResource === 'schedules') {
      const scheduleId = await createEventSchedule({
        ...body,
        eventId
      });
      return NextResponse.json({ id: scheduleId, message: 'Schedule created successfully' });
    }
    
    // POST /api/events/[id]/registrations - Create registration
    if (subResource === 'registrations') {
      // Get event first
      const event = await getEvent(eventId);
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      
      const registrationId = await createEventRegistration(body, event);
      return NextResponse.json({ 
        id: registrationId, 
        message: 'Registration successful' 
      });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    
  } catch (error: any) {
    console.error('POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT handler
export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { eventId, subResource, subResourceId } = parsePath(request.nextUrl.pathname);
    
    // PUT /api/events/[id] - Update event
    if (eventId && !subResource) {
      // Only admin can update events
      if (user.role === 'teacher') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      
      // Check branch access
      const event = await getEvent(eventId);
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      
      if (user.role !== 'super_admin' && user.branchIds?.length > 0) {
        const hasAccess = event.branchIds.some(bid => user.branchIds.includes(bid));
        if (!hasAccess) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
      
      await updateEvent(eventId, body, user.uid);
      return NextResponse.json({ message: 'Event updated successfully' });
    }
    
    // PUT /api/events/[id]/schedules/[scheduleId] - Update schedule
    if (subResource === 'schedules' && subResourceId) {
      await updateEventSchedule(subResourceId, body);
      return NextResponse.json({ message: 'Schedule updated successfully' });
    }
    
    // PUT /api/events/[id]/registrations/[regId] - Cancel registration
    if (subResource === 'registrations' && subResourceId) {
      await cancelEventRegistration(
        subResourceId,
        body.reason || 'ยกเลิกโดย Admin',
        user.uid
      );
      return NextResponse.json({ message: 'Registration cancelled successfully' });
    }
    
    // PUT /api/events/[id]/attendance - Update attendance (bulk)
    if (subResource === 'attendance') {
      await updateEventAttendance(body.attendanceData, user.uid);
      return NextResponse.json({ message: 'Attendance updated successfully' });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    
  } catch (error: any) {
    console.error('PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE handler
export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only super admin can delete
    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    const { eventId, subResource, subResourceId } = parsePath(request.nextUrl.pathname);
    
    // DELETE /api/events/[id] - Delete event
    if (eventId && !subResource) {
      await deleteEvent(eventId);
      return NextResponse.json({ message: 'Event deleted successfully' });
    }
    
    // DELETE /api/events/[id]/schedules/[scheduleId] - Delete schedule
    if (subResource === 'schedules' && subResourceId) {
      await deleteEventSchedule(subResourceId);
      return NextResponse.json({ message: 'Schedule deleted successfully' });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    
  } catch (error: any) {
    console.error('DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}