// app/api/admin/reports/student-report/route.ts
// Admin endpoint: bundle the printable Student Report + Certificate data for a
// student in a class. Service role (RLS bypassed), same trust model as the other
// /api/admin/* routes (called from the admin UI).

import { NextRequest, NextResponse } from 'next/server';
import { buildStudentClassReport } from '@/lib/supabase/services/student-report';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { studentId, classId } = await request.json();
    if (!studentId || !classId) {
      return NextResponse.json({ success: false, error: 'Missing studentId or classId' }, { status: 400 });
    }

    const report = await buildStudentClassReport(studentId, classId);
    if (!report) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('[admin/reports/student-report] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
