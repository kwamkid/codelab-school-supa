// app/api/liff/student-report/route.ts
// LIFF endpoint: same Student Report data, but verifies that the LINE user actually
// belongs to the student's family before returning anything.
//
// "ครอบครัว" = ผู้ปกครองหลัก (parents.line_user_id) หรือผู้รับเพิ่มเติมที่ตอบรับ
// คำเชิญแล้ว (parent_line_recipients) — เดิม route นี้เช็คแต่ผู้ปกครองหลัก
// พ่อที่ผูก LINE ไว้เป็นผู้รับเพิ่มเติมจึงเปิดรายงานลูกไม่ได้ (403)

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiffUser } from '@/lib/line/verify-liff-token';
import { createServiceClient } from '@/lib/supabase/server';
import { getViewerContext } from '@/lib/supabase/services/liff-data';
import { buildStudentClassReport } from '@/lib/supabase/services/student-report';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveLiffUser(request, body);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { studentId, classId } = body;
    if (!studentId || !classId) {
      return NextResponse.json({ success: false, error: 'Missing studentId or classId' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    const viewer = await getViewerContext(supabase, user.lineUserId);
    if (!viewer) {
      return NextResponse.json({ success: false, error: 'Parent not found' }, { status: 403 });
    }

    // Verify the student belongs to this family
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', viewer.parent.id)
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
