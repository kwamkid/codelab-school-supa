// lib/supabase/services/liff-data.ts
// Unified server-side data layer for the LIFF parent portal. Everything here runs
// with the service role (bypasses RLS) and is scoped by a *verified* lineUserId,
// so it's both functional (LIFF users aren't Supabase-authed) and safe.
//
// Schedule/stats live in ./liff-schedule and are re-exported so routes have a
// single import surface.

import { createServiceClient } from '../server';

export {
  getParentScheduleEvents,
  getStudentOverallStats,
} from './liff-schedule';
export type { StudentStats, StudentScheduleData } from './liff-schedule';

const DEFAULT_MAKEUP_QUOTA = 4;

// ---- shared helpers -------------------------------------------------------

// Parent-facing makeup quota per course. Reads the admin setting
// (settings.makeup → makeupLimitPerCourse) so LIFF stays in sync with the
// admin side; falls back to the default if the setting is missing/misconfigured.
// A limit of 0 in settings means "unlimited".
async function getMakeupQuota(supabase: any): Promise<number> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'makeup')
      .single();
    const limit = data?.value?.makeupLimitPerCourse;
    if (typeof limit === 'number' && limit >= 0) {
      return limit === 0 ? Infinity : limit;
    }
  } catch (e) {
    console.error('[liff-data] getMakeupQuota failed, using default:', e);
  }
  return DEFAULT_MAKEUP_QUOTA;
}

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

// ---- home dashboard summary (single call) ---------------------------------

export async function getHomeSummary(lineUserId: string) {
  const supabase = createServiceClient() as any;
  // Single round-trip via Postgres function (was ~10 sequential queries).
  const { data, error } = await supabase.rpc('get_liff_home', { p_line_user_id: lineUserId });
  if (error) throw error;
  return {
    hasParent: data?.has_parent ?? false,
    parentName: data?.parent_name ?? '',
    pendingMakeupCount: data?.pending_makeup_count ?? 0,
    nextClass: data?.next_class ?? null,
    latestFeedback: data?.latest_feedback ?? null,
  };
}

// ---- makeup page data -----------------------------------------------------

export async function getMakeupData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const MAKEUP_QUOTA = await getMakeupQuota(supabase);
  // Single round-trip; assemble the per-class makeup view + stats in JS.
  const { data, error } = await supabase.rpc('get_liff_makeup', { p_line_user_id: lineUserId });
  if (error) throw error;

  const studentsRaw: any[] = data?.students ?? [];
  const makeups: any[] = data?.makeups ?? [];
  const enrollments: any[] = data?.enrollments ?? [];
  const absencesArr: any[] = data?.absences ?? [];
  if (studentsRaw.length === 0) return { students: [], makeupData: {} };

  const absenceMap = new Map<string, number>();
  for (const a of absencesArr) absenceMap.set(`${a.studentId}-${a.classId}`, a.cnt);

  const makeupData: Record<string, any> = {};

  for (const student of studentsRaw) {
    const studentMakeups = makeups.filter((m) => m.studentId === student.id);
    const studentEnrollments = enrollments.filter((e) => e.studentId === student.id);
    const classMakeupData: Record<string, any> = {};

    for (const enr of studentEnrollments) {
      const classMakeups = studentMakeups.filter((m) => m.originalClassId === enr.classId);
      const nonCancelled = classMakeups.filter((m) => m.status !== 'cancelled');
      // Quota-counting makeups only (real leaves/absences). Excludes enrollment
      // catch-up, class pause, sickness, teacher-caused — flagged countsTowardQuota=false.
      const quotaCounting = nonCancelled.filter((m) => m.countsTowardQuota !== false);
      // Informational breakdown (not used for quota):
      const selfRequested = nonCancelled.filter(
        (m) => m.requestedBy === 'parent-liff' || m.reason?.includes('ลาผ่านระบบ LIFF')
      ).length;
      const systemGenerated = nonCancelled.filter((m) => m.requestedBy !== 'parent-liff' && !m.reason?.includes('ลาผ่านระบบ LIFF')).length;
      const absences = absenceMap.get(`${student.id}-${enr.classId}`) || 0;
      const makeupsWithDetails = classMakeups
        .map((m) => ({ ...m, className: enr.className, subjectName: enr.subjectName, subjectColor: enr.subjectColor }))
        .sort((a, b) => new Date(a.originalSessionDate).getTime() - new Date(b.originalSessionDate).getTime());
      // Quota = non-cancelled makeups that count toward quota, matching
      // requestLeave() enforcement and the admin-side getMakeupCount().
      const totalUsed = quotaCounting.length;
      classMakeupData[enr.classId] = {
        classId: enr.classId,
        className: enr.className,
        subjectName: enr.subjectName || '',
        subjectColor: enr.subjectColor,
        makeups: makeupsWithDetails,
        stats: {
          total: classMakeups.length,
          pending: classMakeups.filter((m) => m.status === 'pending').length,
          scheduled: classMakeups.filter((m) => m.status === 'scheduled').length,
          completed: classMakeups.filter((m) => m.status === 'completed').length,
          selfRequested,
          absences,
          systemGenerated,
          totalUsed,
          quotaLimit: Number.isFinite(MAKEUP_QUOTA) ? MAKEUP_QUOTA : null,
          // null quotaRemaining = unlimited (admin set makeupLimitPerCourse to 0)
          quotaRemaining: Number.isFinite(MAKEUP_QUOTA) ? Math.max(0, MAKEUP_QUOTA - totalUsed) : null,
        },
      };
    }

    const overallStats = {
      totalMakeups: Object.values(classMakeupData).reduce((s: number, c: any) => s + c.stats.total, 0),
      totalPending: Object.values(classMakeupData).reduce((s: number, c: any) => s + c.stats.pending, 0),
      totalScheduled: Object.values(classMakeupData).reduce((s: number, c: any) => s + c.stats.scheduled, 0),
      totalCompleted: Object.values(classMakeupData).reduce((s: number, c: any) => s + c.stats.completed, 0),
    };

    makeupData[student.id] = {
      student: { id: student.id, name: student.name, nickname: student.nickname },
      classes: classMakeupData,
      overallStats,
    };
  }

  const students = studentsRaw.map((s) => ({ id: s.id, name: s.name, nickname: s.nickname, isActive: true }));
  return { students, makeupData };
}

// ---- feedback page data ---------------------------------------------------

export async function getFeedbackData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  // Single round-trip via Postgres function.
  const { data, error } = await supabase.rpc('get_liff_feedback', { p_line_user_id: lineUserId });
  if (error) throw error;
  return { students: data?.students ?? [], feedbacks: data?.feedbacks ?? [] };
}

// ---- profile page data ----------------------------------------------------

export async function getProfileData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  // Single round-trip; returns camelCase parent + students + preferred branch.
  const { data, error } = await supabase.rpc('get_liff_profile', { p_line_user_id: lineUserId });
  if (error) throw error;
  return {
    hasParent: data?.hasParent ?? false,
    parent: data?.parent ?? null,
    students: data?.students ?? [],
    preferredBranch: data?.preferredBranch ?? null,
  };
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

  // Quota: count non-cancelled makeups that count toward quota (counts_toward_quota),
  // regardless of who created them (parent via LIFF, admin form, or attendance
  // check-in). Real leaves/absences count; enrollment catch-up, class pause,
  // sickness, and teacher-caused makeups are flagged counts_toward_quota=false and
  // are excluded. Matches the admin side (getMakeupCount) so both count identically.
  const MAKEUP_QUOTA = await getMakeupQuota(supabase);
  const { count: makeupCount } = await supabase
    .from('makeup_classes')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('original_class_id', classId)
    .eq('counts_toward_quota', true)
    .neq('status', 'cancelled');

  const totalUsed = makeupCount || 0;
  if (totalUsed >= MAKEUP_QUOTA) {
    return {
      ok: false,
      status: 400,
      message: `ใช้สิทธิ์ลาครบ ${MAKEUP_QUOTA} ครั้งแล้ว`,
      quotaDetails: { scheduled: totalUsed, absences: 0, total: totalUsed, limit: MAKEUP_QUOTA },
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
      counts_toward_quota: true, // a LIFF leave is a real leave → consumes quota
      original_session_number: schedule.session_number || 0,
      original_session_date: schedule.session_date,
    })
    .select('id')
    .single();
  if (makeupError) throw makeupError;

  // Mark attendance as 'leave' (best effort). NOTE: attendance.checked_by is a
  // uuid FK — it cannot hold the string 'parent-liff' (that silently errored
  // before, so LIFF leaves never got an attendance row). Leave it null and rely
  // on the note to identify the source; the paired makeup row is the source of truth.
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
        .update({ status: 'leave', note: 'ลาผ่านระบบ LIFF', checked_at: new Date().toISOString(), checked_by: null })
        .eq('id', existingAtt.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: scheduleId,
        student_id: studentId,
        status: 'leave',
        note: 'ลาผ่านระบบ LIFF',
        checked_at: new Date().toISOString(),
        checked_by: null,
      });
    }
  } catch (e) {
    console.error('[requestLeave] attendance update failed:', e);
  }

  return {
    ok: true,
    makeupId: makeupResult.id,
    quotaUsed: totalUsed + 1,
    quotaLimit: Number.isFinite(MAKEUP_QUOTA) ? MAKEUP_QUOTA : null,
    quotaDetails: { scheduled: totalUsed + 1, absences: 0, total: totalUsed + 1, limit: MAKEUP_QUOTA },
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
