// app/api/liff/feedback/route.ts
// Returns a parent's children + teacher-feedback history (text + photos) for the
// LIFF "Teacher Feedback" page. Uses the service role so it works regardless of
// the LIFF client's RLS context.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { lineUserId } = await request.json();
    if (!lineUserId) {
      return NextResponse.json({ success: false, error: 'Missing lineUserId' }, { status: 400 });
    }

    const supabase = createServiceClient() as any;

    // Parent → students
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();
    if (!parent) {
      return NextResponse.json({ success: true, students: [], feedbacks: [] });
    }

    const { data: studentRows } = await supabase
      .from('students')
      .select('id, name, nickname, is_active')
      .eq('parent_id', parent.id);
    const students = (studentRows || []).filter((s: any) => s.is_active);
    const studentIds = students.map((s: any) => s.id);
    if (studentIds.length === 0) {
      return NextResponse.json({ success: true, students: [], feedbacks: [] });
    }
    const studentMap = new Map<string, any>(students.map((s: any) => [s.id, s]));

    // Attendance records with feedback or photos
    const { data: attRows } = await supabase
      .from('attendance')
      .select('id, student_id, schedule_id, feedback, photos, checked_at')
      .in('student_id', studentIds);
    const relevant = (attRows || []).filter(
      (r: any) => (r.feedback && r.feedback.trim()) || (Array.isArray(r.photos) && r.photos.length > 0)
    );
    if (relevant.length === 0) {
      return NextResponse.json({ success: true, students, feedbacks: [] });
    }

    // Resolve schedules → classes → subjects → teachers
    const scheduleIds = [...new Set(relevant.map((r: any) => r.schedule_id))];
    const { data: schedRows } = await supabase
      .from('class_schedules')
      .select('id, class_id, session_number, session_date, actual_teacher_id')
      .in('id', scheduleIds);
    const schedMap = new Map<string, any>((schedRows || []).map((s: any) => [s.id, s]));

    const classIds = [...new Set((schedRows || []).map((s: any) => s.class_id))];
    const { data: classRows } = await supabase
      .from('classes')
      .select('id, name, subject_id, teacher_id')
      .in('id', classIds);
    const classMap = new Map<string, any>((classRows || []).map((c: any) => [c.id, c]));

    const subjectIds = [...new Set((classRows || []).map((c: any) => c.subject_id))];
    const { data: subjectRows } = await supabase
      .from('subjects')
      .select('id, name')
      .in('id', subjectIds);
    const subjectMap = new Map<string, any>((subjectRows || []).map((s: any) => [s.id, s]));

    const teacherIds = [...new Set([
      ...(schedRows || []).map((s: any) => s.actual_teacher_id).filter(Boolean),
      ...(classRows || []).map((c: any) => c.teacher_id).filter(Boolean),
    ])];
    const { data: teacherRows } = await supabase
      .from('teachers')
      .select('id, name, nickname')
      .in('id', teacherIds);
    const teacherMap = new Map<string, any>((teacherRows || []).map((t: any) => [t.id, t]));

    const feedbacks = relevant
      .map((r: any) => {
        const sched = schedMap.get(r.schedule_id);
        if (!sched) return null;
        const cls = classMap.get(sched.class_id);
        if (!cls) return null;
        const subject = subjectMap.get(cls.subject_id);
        const teacherId = sched.actual_teacher_id || cls.teacher_id;
        const teacher = teacherMap.get(teacherId);
        const student = studentMap.get(r.student_id);
        return {
          id: r.id,
          studentId: r.student_id,
          studentName: student?.nickname || student?.name || '',
          className: cls.name,
          subjectName: subject?.name || '',
          sessionNumber: sched.session_number,
          sessionDate: sched.session_date,
          feedback: r.feedback || '',
          photos: Array.isArray(r.photos) ? r.photos : [],
          teacherName: teacher?.nickname || teacher?.name || '',
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

    return NextResponse.json({ success: true, students, feedbacks });
  } catch (error: any) {
    console.error('[liff/feedback] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'failed' }, { status: 500 });
  }
}
