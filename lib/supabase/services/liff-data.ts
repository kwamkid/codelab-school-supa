// lib/supabase/services/liff-data.ts
// Unified server-side data layer for the LIFF parent portal. Everything here runs
// with the service role (bypasses RLS) and is scoped by a *verified* lineUserId,
// so it's both functional (LIFF users aren't Supabase-authed) and safe.
//
// Schedule/stats live in ./liff-schedule and are re-exported so routes have a
// single import surface.

import { createServiceClient } from '../server';
import { dbRowToMakeupClass } from '@/lib/services/makeup';

export {
  getParentScheduleEvents,
  getStudentOverallStats,
} from './liff-schedule';

const MAKEUP_QUOTA = 4;

// ---- shared helpers -------------------------------------------------------

async function getParentByLine(supabase: any, lineUserId: string) {
  const { data } = await supabase
    .from('parents')
    .select('*')
    .eq('line_user_id', lineUserId)
    .single();
  return data || null;
}

async function getActiveStudents(supabase: any, parentId: string) {
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_active', true);
  return data || [];
}

// ---- pending makeup count (home alert) ------------------------------------

export async function getPendingMakeupCount(lineUserId: string): Promise<number> {
  const supabase = createServiceClient() as any;
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) return 0;
  const students = await getActiveStudents(supabase, parent.id);
  const studentIds = students.map((s: any) => s.id);
  if (studentIds.length === 0) return 0;
  const { count } = await supabase
    .from('makeup_classes')
    .select('id', { count: 'exact', head: true })
    .in('student_id', studentIds)
    .eq('status', 'pending');
  return count || 0;
}

// ---- makeup page data -----------------------------------------------------

export async function getMakeupData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) return { students: [], makeupData: {} };

  const activeStudents = await getActiveStudents(supabase, parent.id);
  if (activeStudents.length === 0) return { students: [], makeupData: {} };

  const [{ data: subjects }, { data: teachers }, { data: branches }, { data: rooms }] = await Promise.all([
    supabase.from('subjects').select('*'),
    supabase.from('teachers').select('*'),
    supabase.from('branches').select('*'),
    supabase.from('rooms').select('*'),
  ]);
  const subjectMap = new Map<string, any>((subjects || []).map((s: any) => [s.id, s]));
  const teacherMap = new Map<string, any>((teachers || []).map((t: any) => [t.id, t]));
  const branchMap = new Map<string, any>((branches || []).map((b: any) => [b.id, b]));
  const roomMap = new Map<string, any>((rooms || []).map((r: any) => [r.id, r]));

  const makeupData: Record<string, any> = {};

  for (const student of activeStudents) {
    const { data: makeupRows } = await supabase
      .from('makeup_classes')
      .select('*')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    const makeups = (makeupRows || []).map(dbRowToMakeupClass);

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id, classes!enrollments_class_id_fkey(*)')
      .eq('student_id', student.id)
      .eq('status', 'active');

    const classMakeupData: Record<string, any> = {};

    for (const enrollment of enrollments || []) {
      const classData = enrollment.classes;
      if (!classData) continue;

      const subject = subjectMap.get(classData.subject_id);
      const classMakeups = makeups.filter((m: any) => m.originalClassId === enrollment.class_id);

      const selfRequested = classMakeups.filter(
        (m: any) => m.type === 'scheduled' && (m.requestedBy === 'parent-liff' || m.reason?.includes('ลาผ่านระบบ LIFF'))
      ).length;
      const systemGenerated = classMakeups.filter(
        (m: any) => m.type === 'ad-hoc' && m.requestedBy !== 'parent-liff'
      ).length;

      let absences = 0;
      const { data: schedRows } = await supabase
        .from('class_schedules')
        .select('id')
        .eq('class_id', enrollment.class_id);
      const scheduleIds = (schedRows || []).map((s: any) => s.id);
      if (scheduleIds.length > 0) {
        const { data: absentRows } = await supabase
          .from('attendance')
          .select('schedule_id')
          .eq('student_id', student.id)
          .eq('status', 'absent')
          .in('schedule_id', scheduleIds);
        (absentRows || []).forEach((a: any) => {
          const hasMakeup = classMakeups.some((m: any) => m.originalScheduleId === a.schedule_id);
          if (!hasMakeup) absences++;
        });
      }

      const makeupsWithDetails = classMakeups
        .map((makeup: any) => ({
          ...makeup,
          className: classData.name,
          subjectName: subject?.name,
          subjectColor: subject?.color,
          originalTeacherName: teacherMap.get(classData.teacher_id)?.nickname || teacherMap.get(classData.teacher_id)?.name,
          branchName: branchMap.get(classData.branch_id)?.name,
          roomName: roomMap.get(classData.room_id)?.name,
          makeupBranchName: makeup.makeupSchedule ? branchMap.get(makeup.makeupSchedule.branchId)?.name : undefined,
          makeupRoomName: makeup.makeupSchedule
            ? roomMap.get(makeup.makeupSchedule.roomId)?.name || makeup.makeupSchedule.roomName
            : undefined,
          makeupTeacher: makeup.makeupSchedule?.teacherId ? teacherMap.get(makeup.makeupSchedule.teacherId) : null,
        }))
        .sort((a: any, b: any) => new Date(a.originalSessionDate).getTime() - new Date(b.originalSessionDate).getTime());

      const totalUsed = selfRequested + absences;
      classMakeupData[enrollment.class_id] = {
        classId: enrollment.class_id,
        className: classData.name,
        subjectName: subject?.name || '',
        subjectColor: subject?.color,
        makeups: makeupsWithDetails,
        stats: {
          total: classMakeups.length,
          pending: classMakeups.filter((m: any) => m.status === 'pending').length,
          scheduled: classMakeups.filter((m: any) => m.status === 'scheduled').length,
          completed: classMakeups.filter((m: any) => m.status === 'completed').length,
          selfRequested,
          absences,
          systemGenerated,
          totalUsed,
          quotaRemaining: Math.max(0, MAKEUP_QUOTA - totalUsed),
        },
      };
    }

    const overallStats = {
      totalMakeups: Object.values(classMakeupData).reduce((sum: number, c: any) => sum + c.stats.total, 0),
      totalPending: Object.values(classMakeupData).reduce((sum: number, c: any) => sum + c.stats.pending, 0),
      totalScheduled: Object.values(classMakeupData).reduce((sum: number, c: any) => sum + c.stats.scheduled, 0),
      totalCompleted: Object.values(classMakeupData).reduce((sum: number, c: any) => sum + c.stats.completed, 0),
    };

    makeupData[student.id] = {
      student: { id: student.id, name: student.name, nickname: student.nickname },
      classes: classMakeupData,
      overallStats,
    };
  }

  const students = activeStudents.map((s: any) => ({
    id: s.id,
    name: s.name,
    nickname: s.nickname,
    isActive: true,
  }));

  return { students, makeupData };
}

// ---- feedback page data ---------------------------------------------------

export async function getFeedbackData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) return { students: [], feedbacks: [] };

  const studentRows = await getActiveStudents(supabase, parent.id);
  const students = studentRows.map((s: any) => ({ id: s.id, name: s.name, nickname: s.nickname, is_active: true }));
  const studentIds = students.map((s: any) => s.id);
  if (studentIds.length === 0) return { students: [], feedbacks: [] };
  const studentMap = new Map<string, any>(students.map((s: any) => [s.id, s]));

  const { data: attRows } = await supabase
    .from('attendance')
    .select('id, student_id, schedule_id, feedback, photos, checked_at')
    .in('student_id', studentIds);
  const relevant = (attRows || []).filter(
    (r: any) => (r.feedback && r.feedback.trim()) || (Array.isArray(r.photos) && r.photos.length > 0)
  );
  if (relevant.length === 0) return { students, feedbacks: [] };

  const scheduleIds = [...new Set(relevant.map((r: any) => r.schedule_id))];
  const { data: schedRows } = await supabase
    .from('class_schedules')
    .select('id, class_id, session_number, session_date, actual_teacher_id')
    .in('id', scheduleIds);
  const schedMap = new Map<string, any>((schedRows || []).map((s: any) => [s.id, s]));

  const classIds = [...new Set((schedRows || []).map((s: any) => s.class_id))];
  const { data: classRows } = await supabase.from('classes').select('id, name, subject_id, teacher_id').in('id', classIds);
  const classMap = new Map<string, any>((classRows || []).map((c: any) => [c.id, c]));

  const subjectIds = [...new Set((classRows || []).map((c: any) => c.subject_id))];
  const { data: subjectRows } = await supabase.from('subjects').select('id, name').in('id', subjectIds);
  const subjectMap = new Map<string, any>((subjectRows || []).map((s: any) => [s.id, s]));

  const teacherIds = [...new Set([
    ...(schedRows || []).map((s: any) => s.actual_teacher_id).filter(Boolean),
    ...(classRows || []).map((c: any) => c.teacher_id).filter(Boolean),
  ])];
  const { data: teacherRows } = await supabase.from('teachers').select('id, name, nickname').in('id', teacherIds);
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

  return { students, feedbacks };
}

// ---- profile page data ----------------------------------------------------

export async function getProfileData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) return { parent: null, students: [], preferredBranch: null };

  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('parent_id', parent.id)
    .eq('is_active', true);

  let preferredBranch = null;
  if (parent.preferred_branch_id) {
    const { data: branch } = await supabase
      .from('branches')
      .select('*')
      .eq('id', parent.preferred_branch_id)
      .single();
    preferredBranch = branch || null;
  }

  return { parent, students: students || [], preferredBranch };
}

export async function updateParentProfile(
  lineUserId: string,
  parentId: string,
  data: { displayName?: string; phone?: string; email?: string; preferredBranchId?: string; address?: any; emergencyPhone?: string }
) {
  const supabase = createServiceClient() as any;
  // Ownership check: the parent record must belong to the verified LINE user.
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent || parent.id !== parentId) {
    throw new Error('ไม่มีสิทธิ์แก้ไขข้อมูลนี้');
  }

  const update: any = {};
  if (data.displayName !== undefined) update.display_name = data.displayName;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.email !== undefined) update.email = data.email;
  if (data.preferredBranchId !== undefined) update.preferred_branch_id = data.preferredBranchId || null;
  if (data.emergencyPhone !== undefined) update.emergency_phone = data.emergencyPhone;
  if (data.address !== undefined) update.address = data.address;
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from('parents').update(update).eq('id', parentId);
  if (error) throw error;
  return { ok: true };
}

// ---- leave request / cancel ----------------------------------------------

// Confirm the student belongs to the verified parent before mutating.
async function assertStudentOwnedByLine(supabase: any, lineUserId: string, studentId: string) {
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) throw new Error('ไม่พบข้อมูลผู้ปกครอง');
  const { data: student } = await supabase
    .from('students')
    .select('id, parent_id')
    .eq('id', studentId)
    .single();
  if (!student || student.parent_id !== parent.id) {
    throw new Error('ไม่มีสิทธิ์ดำเนินการกับนักเรียนคนนี้');
  }
  return parent;
}

export async function requestLeave(
  lineUserId: string,
  payload: { studentId: string; classId: string; scheduleId: string; reason?: string; type?: string }
) {
  const supabase = createServiceClient() as any;
  const { studentId, classId, scheduleId, reason, type } = payload;
  if (!studentId || !classId || !scheduleId) {
    return { ok: false, status: 400, message: 'ข้อมูลไม่ครบถ้วน' };
  }

  const parent = await assertStudentOwnedByLine(supabase, lineUserId, studentId);

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('parent_id')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('status', 'active')
    .single();
  if (!enrollment) return { ok: false, status: 404, message: 'ไม่พบข้อมูลการลงทะเบียน' };

  const { data: schedule } = await supabase
    .from('class_schedules')
    .select('*')
    .eq('id', scheduleId)
    .eq('class_id', classId)
    .single();
  if (!schedule) return { ok: false, status: 404, message: 'ไม่พบข้อมูลคาบเรียน' };

  if (new Date(schedule.session_date) < new Date()) {
    return { ok: false, status: 400, message: 'ไม่สามารถลาย้อนหลังได้' };
  }

  const { data: existing } = await supabase
    .from('makeup_classes')
    .select('id')
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .eq('original_schedule_id', scheduleId)
    .in('status', ['pending', 'scheduled'])
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, status: 400, message: 'มีการขอลาในคาบนี้แล้ว' };
  }

  // Quota: self-requested makeups + absences
  const { data: quotaMakeups } = await supabase
    .from('makeup_classes')
    .select('id')
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .eq('type', 'scheduled')
    .in('requested_by', ['parent-liff', 'parent']);
  const { data: absences } = await supabase
    .from('attendance')
    .select('id, class_schedules!inner(class_id)')
    .eq('student_id', studentId)
    .eq('status', 'absent')
    .eq('class_schedules.class_id', classId);

  const scheduledMakeups = quotaMakeups?.length || 0;
  const totalAbsences = absences?.length || 0;
  const totalUsed = scheduledMakeups + totalAbsences;
  if (totalUsed >= MAKEUP_QUOTA) {
    return {
      ok: false,
      status: 400,
      message: `ใช้สิทธิ์ครบ ${MAKEUP_QUOTA} ครั้งแล้ว (ลา ${scheduledMakeups} + ขาด ${totalAbsences})`,
      quotaDetails: { scheduled: scheduledMakeups, absences: totalAbsences, total: totalUsed, limit: MAKEUP_QUOTA },
    };
  }

  const { data: makeupResult, error: makeupError } = await supabase
    .from('makeup_classes')
    .insert({
      type: type || 'scheduled',
      original_class_id: classId,
      original_schedule_id: scheduleId,
      student_id: studentId,
      parent_id: parent.id,
      requested_by: 'parent-liff',
      reason: reason || 'ลาผ่านระบบ LIFF',
      status: 'pending',
      original_session_number: schedule.session_number || 0,
      original_session_date: schedule.session_date,
    })
    .select('id')
    .single();
  if (makeupError) throw makeupError;

  // Mark attendance absent (best effort)
  try {
    const { data: existingAtt } = await supabase
      .from('attendance')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('student_id', studentId)
      .single();
    if (existingAtt) {
      await supabase
        .from('attendance')
        .update({ status: 'absent', note: 'ลาผ่านระบบ LIFF', checked_at: new Date().toISOString(), checked_by: 'parent-liff' })
        .eq('id', existingAtt.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: scheduleId,
        student_id: studentId,
        status: 'absent',
        note: 'ลาผ่านระบบ LIFF',
        checked_at: new Date().toISOString(),
        checked_by: 'parent-liff',
      });
    }
  } catch (e) {
    console.error('[requestLeave] attendance update failed:', e);
  }

  return {
    ok: true,
    makeupId: makeupResult.id,
    quotaUsed: totalUsed + 1,
    quotaLimit: MAKEUP_QUOTA,
    quotaDetails: { scheduled: scheduledMakeups + 1, absences: totalAbsences, total: totalUsed + 1 },
  };
}

export async function cancelLeave(
  lineUserId: string,
  payload: { makeupId: string; studentId: string; classId: string; scheduleId: string }
) {
  const supabase = createServiceClient() as any;
  const { makeupId, studentId, scheduleId } = payload;
  if (!makeupId || !studentId || !scheduleId) {
    return { ok: false, status: 400, message: 'ข้อมูลไม่ครบถ้วน' };
  }

  await assertStudentOwnedByLine(supabase, lineUserId, studentId);

  const { data: makeup } = await supabase.from('makeup_classes').select('*').eq('id', makeupId).single();
  if (!makeup) return { ok: false, status: 404, message: 'ไม่พบข้อมูลการลา' };
  if (makeup.student_id !== studentId) return { ok: false, status: 403, message: 'ไม่มีสิทธิ์ดำเนินการ' };
  if (makeup.status !== 'pending') {
    return { ok: false, status: 400, message: 'ไม่สามารถยกเลิกได้ เนื่องจากมีการนัดเรียนชดเชยแล้ว' };
  }
  const originalDate = makeup.original_session_date ? new Date(makeup.original_session_date) : new Date();
  if (originalDate < new Date()) {
    return { ok: false, status: 400, message: 'ไม่สามารถยกเลิกการลาย้อนหลังได้' };
  }

  const { error: deleteError } = await supabase.from('makeup_classes').delete().eq('id', makeupId);
  if (deleteError) throw deleteError;

  try {
    await supabase.from('attendance').delete().eq('schedule_id', scheduleId).eq('student_id', studentId);
  } catch (e) {
    console.error('[cancelLeave] attendance delete failed:', e);
  }

  return { ok: true, message: 'ยกเลิกการลาเรียนเรียบร้อยแล้ว' };
}
