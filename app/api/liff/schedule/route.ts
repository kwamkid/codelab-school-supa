// app/api/liff/schedule/route.ts
// Schedule events + students + per-student stats for the LIFF schedule page.
// Identity is resolved from a verified LINE ID token (Authorization: Bearer).

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { getParentScheduleEvents, getStudentOverallStats } from '@/lib/supabase/services/liff-data';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const startDate = body.start ? new Date(body.start) : new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1);
    const endDate = body.end ? new Date(body.end) : new Date(new Date().getFullYear() + 1, 11, 31);

    const { events, students } = await getParentScheduleEvents(user.lineUserId, startDate, endDate);

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
