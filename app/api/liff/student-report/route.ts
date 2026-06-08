// app/api/liff/student-report/route.ts
// LIFF endpoint: same Student Report data, but verifies that the LINE user (parent)
// actually owns the requested student before returning anything. Mirrors the
// ownership lookup in app/api/liff/feedback/route.ts.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { buildStudentClassReport } from '@/lib/supabase/services/student-report';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { lineUserId, studentId, classId } = await request.json();
    if (!lineUserId || !studentId || !classId) {
      return NextResponse.json({ success: false, error: 'Missing lineUserId, studentId or classId' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    // Parent for this LINE user
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();
    if (!parent) {
      return NextResponse.json({ success: false, error: 'Parent not found' }, { status: 403 });
    }

    // Verify the student belongs to this parent
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', parent.id)
      .maybeSingle();
    if (!student) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const report = await buildStudentClassReport(studentId, classId);
    if (!report) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    console.error('[liff/student-report] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
