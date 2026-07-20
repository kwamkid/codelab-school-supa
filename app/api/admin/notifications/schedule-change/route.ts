// app/api/admin/notifications/schedule-change/route.ts
// แจ้งผู้ปกครองทุกคนในคลาสเมื่อตารางเปลี่ยน (ลายกคลาส / ยกเลิกการเลื่อน / ยกเลิกคาบ)
// เรียกแบบ fire-and-forget จาก client (lib/services/classes.ts) — LINE ล่มต้องไม่
// บล็อกการเลื่อนคลาส. sendScheduleChangeNotification fan-out ถึงผู้รับเพิ่มเติมให้เอง

import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, bearer } from '@/lib/server/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { sendScheduleChangeNotification } from '@/lib/supabase/services/line-notifications';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff(bearer(request.headers.get('authorization')));
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status || 401 });
    }

    const body = await request.json();
    const { classId, changeType, originalDate, newDate } = body as {
      classId?: string;
      changeType?: 'cancelled' | 'rescheduled';
      originalDate?: string; // YYYY-MM-DD
      newDate?: string;
    };
    if (!classId || !changeType || !originalDate) {
      return NextResponse.json({ success: false, error: 'Missing classId/changeType/originalDate' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ชื่อที่โชว์ผู้ปกครอง = ชื่อวิชา (ห้ามใช้รหัสคลาส)
    const { data: cls } = await supabase
      .from('classes')
      .select('id, name, subjects (name)')
      .eq('id', classId)
      .single();
    if (!cls) return NextResponse.json({ success: false, error: 'Class not found' }, { status: 404 });
    const displayName = (cls.subjects as any)?.name || cls.name;

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, students (id, name, nickname, parents (id, line_user_id))')
      .eq('class_id', classId)
      .eq('status', 'active');

    let sent = 0;
    for (const enr of (enrollments || []) as any[]) {
      const student = enr.students;
      const parent = student?.parents;
      if (!parent?.line_user_id) continue;
      const ok = await sendScheduleChangeNotification(
        parent.line_user_id,
        student.nickname || student.name,
        displayName,
        changeType,
        new Date(originalDate),
        newDate ? new Date(newDate) : undefined
      );
      if (ok) sent++;
    }

    return NextResponse.json({ success: true, sent, students: (enrollments || []).length });
  } catch (error: any) {
    console.error('[notifications/schedule-change] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
