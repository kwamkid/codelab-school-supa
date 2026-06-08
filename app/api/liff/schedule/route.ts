// app/api/liff/schedule/route.ts
// Returns a parent's schedule events + students + per-student stats for the LIFF
// schedule page. Runs server-side with the service role so it bypasses RLS
// (LIFF users authenticate via LINE, not Supabase Auth, so the browser anon
// client cannot read enrollments/class_schedules/makeup_classes).

import { NextRequest, NextResponse } from 'next/server';
import { getParentScheduleEvents, getStudentOverallStats } from '@/lib/supabase/services/liff-schedule';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { lineUserId, start, end } = await request.json();
    if (!lineUserId) {
      return NextResponse.json({ success: false, error: 'Missing lineUserId' }, { status: 400 });
    }

    const startDate = start ? new Date(start) : new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1);
    const endDate = end ? new Date(end) : new Date(new Date().getFullYear() + 1, 11, 31);

    const { events, students } = await getParentScheduleEvents(lineUserId, startDate, endDate);

    // Per-student overall stats (also needs service role)
    const stats: Record<string, any> = {};
    await Promise.all(
      students.map(async (s) => {
        stats[s.student.id] = await getStudentOverallStats('', s.student.id);
      })
    );

    return NextResponse.json({ success: true, events, students, stats });
  } catch (error: any) {
    console.error('[liff/schedule] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
