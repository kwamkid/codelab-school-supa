// lib/supabase/services/student-report.ts
// Server-side (service role) builder that bundles everything needed to render a
// printable Student Report + Certificate for ONE student in ONE class.
// Used by both the admin route and the LIFF route (RLS-independent).

import { createServiceClient } from '@/lib/supabase/server';

export interface ReportSession {
  sessionNumber: number;
  sessionDate: string;        // ISO
  status: string;             // present|late|absent|sick|leave|'' (not checked)
  feedback: string;
  photos: string[];
  teacherName: string;
}

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  sick: number;
  leave: number;
  checked: number;            // sessions with any recorded status
  attendanceRate: number;     // (present + late) / checked * 100, rounded
}

export interface StudentClassReport {
  student: {
    id: string;
    name: string;
    nameEn: string;
    nickname: string;
    studentCode: string;
    gradeLevel: string;
    schoolName: string;
  };
  class: {
    id: string;
    name: string;
    code: string;
    startDate: string | null;
    endDate: string | null;
    totalSessions: number;
    status: string;
  };
  subject: { name: string; code: string };
  teacher: { name: string; nameEn: string; nickname: string };
  branch: { name: string; address: string; phone: string };
  company: { name: string };
  attendance: AttendanceSummary;
  sessions: ReportSession[];  // sorted by sessionNumber ASC
  isCompleted: boolean;       // class.status === 'completed'
}

/**
 * Build the consolidated report for a student in a class.
 * Returns null if the student or class cannot be found.
 */
export async function buildStudentClassReport(
  studentId: string,
  classId: string
): Promise<StudentClassReport | null> {
  const supabase = createServiceClient() as any;

  // Student
  const { data: student } = await supabase
    .from('students')
    .select('id, name, name_en, nickname, student_code, grade_level, school_name')
    .eq('id', studentId)
    .single();
  if (!student) return null;

  // Class
  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, code, subject_id, teacher_id, branch_id, start_date, end_date, total_sessions, status')
    .eq('id', classId)
    .single();
  if (!cls) return null;

  // Subject / branch / default class teacher (parallel)
  const [{ data: subject }, { data: branch }] = await Promise.all([
    supabase.from('subjects').select('name, code').eq('id', cls.subject_id).single(),
    supabase.from('branches').select('name, address, phone, invoice_company_id').eq('id', cls.branch_id).single(),
  ]);

  // Invoice company for the letterhead = the company assigned to THIS class's
  // branch (branches.invoice_company_id). Multiple companies can be active, so
  // picking "any active one" returned the wrong name. Fall back to the first
  // active company only when the branch has no company assigned.
  let company: { name: string } | null = null;
  if (branch?.invoice_company_id) {
    const { data } = await supabase
      .from('invoice_companies')
      .select('name')
      .eq('id', branch.invoice_company_id)
      .maybeSingle();
    company = data;
  }
  if (!company) {
    const { data } = await supabase
      .from('invoice_companies')
      .select('name')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    company = data;
  }

  // All schedules for this class (ordered)
  const { data: schedRows } = await supabase
    .from('class_schedules')
    .select('id, session_number, session_date, actual_teacher_id')
    .eq('class_id', classId)
    .order('session_number', { ascending: true });
  const schedules = schedRows || [];
  const scheduleIds = schedules.map((s: any) => s.id);

  // This student's attendance for those schedules
  let attRows: any[] = [];
  if (scheduleIds.length > 0) {
    const { data } = await supabase
      .from('attendance')
      .select('schedule_id, status, feedback, photos')
      .eq('student_id', studentId)
      .in('schedule_id', scheduleIds);
    attRows = data || [];
  }
  const attMap = new Map<string, any>(attRows.map((a) => [a.schedule_id, a]));

  // Resolve teacher names (class default + any per-session substitutes)
  const teacherIds = [
    ...new Set([
      cls.teacher_id,
      ...schedules.map((s: any) => s.actual_teacher_id).filter(Boolean),
    ].filter(Boolean)),
  ];
  let teacherMap = new Map<string, any>();
  if (teacherIds.length > 0) {
    const { data: teacherRows } = await supabase
      .from('teachers')
      .select('id, name, name_en, nickname')
      .in('id', teacherIds);
    teacherMap = new Map<string, any>((teacherRows || []).map((t: any) => [t.id, t]));
  }
  const defaultTeacher = teacherMap.get(cls.teacher_id);

  // Build sessions + attendance summary
  const summary: AttendanceSummary = {
    present: 0, late: 0, absent: 0, sick: 0, leave: 0, checked: 0, attendanceRate: 0,
  };
  const sessions: ReportSession[] = schedules.map((s: any) => {
    const att = attMap.get(s.id);
    const status: string = att?.status || '';
    if (status && status in summary) {
      (summary as any)[status] += 1;
      summary.checked += 1;
    }
    const t = teacherMap.get(s.actual_teacher_id) || defaultTeacher;
    return {
      sessionNumber: s.session_number,
      sessionDate: s.session_date,
      status,
      feedback: att?.feedback || '',
      photos: Array.isArray(att?.photos) ? att.photos : [],
      teacherName: t?.nickname || t?.name || '',
    };
  });
  summary.attendanceRate = summary.checked
    ? Math.round(((summary.present + summary.late) / summary.checked) * 100)
    : 0;

  return {
    student: {
      id: student.id,
      name: student.name,
      nameEn: student.name_en || '',
      nickname: student.nickname || '',
      studentCode: student.student_code || '',
      gradeLevel: student.grade_level || '',
      schoolName: student.school_name || '',
    },
    class: {
      id: cls.id,
      name: cls.name,
      code: cls.code || '',
      startDate: cls.start_date || null,
      endDate: cls.end_date || null,
      totalSessions: cls.total_sessions || schedules.length,
      status: cls.status || 'draft',
    },
    subject: { name: subject?.name || '', code: subject?.code || '' },
    teacher: { name: defaultTeacher?.name || '', nameEn: defaultTeacher?.name_en || '', nickname: defaultTeacher?.nickname || '' },
    branch: { name: branch?.name || '', address: branch?.address || '', phone: branch?.phone || '' },
    company: { name: company?.name || '' },
    attendance: summary,
    sessions,
    isCompleted: (cls.status || '') === 'completed',
  };
}
