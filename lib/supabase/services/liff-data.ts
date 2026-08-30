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

// หา parents ของ line id นี้ — account หลัก (parents.line_user_id) ก่อน,
// ไม่เจอค่อยเช็ค account รอง (parent_line_recipients ที่ตอบรับคำเชิญแล้ว)
// → account รองใช้ portal ได้เหมือน account หลักโดยไม่ต้องมี parents row ของตัวเอง
async function getParentByLine(supabase: any, lineUserId: string) {
  const { data } = await supabase
    .from('parents')
    .select('*')
    .eq('line_user_id', lineUserId)
    .maybeSingle();
  if (data) return data;

  const { data: rec } = await supabase
    .from('parent_line_recipients')
    .select('parent_id')
    .eq('line_user_id', lineUserId)
    .eq('is_active', true)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  if (!rec?.parent_id) return null;

  const { data: family } = await supabase
    .from('parents')
    .select('*')
    .eq('id', rec.parent_id)
    .maybeSingle();
  return family || null;
}

// RPC ฝั่ง LIFF ทุกตัว key ด้วย "line id หลัก" ของครอบครัว — ถ้าผู้เรียกเป็น
// account รอง ให้ map ไปใช้ line id หลักก่อนเรียก RPC (โครงสร้าง RPC เดิมไม่ต้องแก้)
export async function resolveFamilyLineId(supabase: any, lineUserId: string): Promise<string> {
  const parent = await getParentByLine(supabase, lineUserId);
  return parent?.line_user_id || lineUserId;
}

// แถวผู้รับเพิ่มเติมของ LINE id นี้ (null ถ้าเป็นผู้ปกครองหลัก)
async function getRecipientByLine(supabase: any, lineUserId: string) {
  const { data } = await supabase
    .from('parent_line_recipients')
    .select('*')
    .eq('line_user_id', lineUserId)
    .eq('is_active', true)
    .not('accepted_at', 'is', null)
    .maybeSingle();
  return data || null;
}

// บันทึกว่าใครทำอะไรผ่าน portal — best effort, ห้ามให้ log พังแล้วรายการหลักพังตาม
async function logLiffActivity(
  supabase: any,
  viewer: ViewerContext,
  action: string,
  extra?: { studentId?: string; targetId?: string; detail?: any }
) {
  try {
    await supabase.from('liff_activity_log').insert({
      parent_id: viewer.parent?.id ?? null,
      actor_line_id: viewer.actorLineId,
      actor_name: viewer.actorName,
      actor_role: viewer.isSecondary ? 'secondary' : 'primary',
      action,
      student_id: extra?.studentId ?? null,
      target_id: extra?.targetId ?? null,
      detail: extra?.detail ?? null,
    });
  } catch (e) {
    console.error('[liff-data] activity log failed:', action, e);
  }
}

export interface ViewerContext {
  parent: any;
  /** true = ผู้รับเพิ่มเติม (พ่อ/ย่า/พี่) ที่ถูกเชิญเข้ามา, false = ผู้ปกครองหลัก */
  isSecondary: boolean;
  recipient: any | null;
  /** ชื่อที่ใช้บันทึกว่า "ใครเป็นคนทำรายการนี้" */
  actorName: string;
  actorLineId: string;
}

// ใครกำลังใช้ portal อยู่ — ใช้ตอนบันทึก transaction ว่าใครเป็นคนกด
// (พ่อกับแม่ผูกครอบครัวเดียวกัน แต่คนละ LINE id → ต้องแยกให้ออก)
export async function getViewerContext(
  supabase: any,
  lineUserId: string
): Promise<ViewerContext | null> {
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) return null;
  const isSecondary = parent.line_user_id !== lineUserId;
  const recipient = isSecondary ? await getRecipientByLine(supabase, lineUserId) : null;
  const actorName = isSecondary
    ? recipient?.full_name || recipient?.display_name || recipient?.label || 'ผู้รับเพิ่มเติม'
    : parent.display_name || parent.line_display_name || 'ผู้ปกครอง';
  return { parent, isSecondary, recipient, actorName, actorLineId: lineUserId };
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
  const familyLineId = await resolveFamilyLineId(supabase, lineUserId);
  // Single round-trip via Postgres function (was ~10 sequential queries).
  const { data, error } = await supabase.rpc('get_liff_home', { p_line_user_id: familyLineId });
  if (error) throw error;
  return {
    hasParent: data?.has_parent ?? false,
    parentName: data?.parent_name ?? '',
    pendingMakeupCount: data?.pending_makeup_count ?? 0,
    // One upcoming class per active student (a multi-kid parent sees them all).
    nextClasses: data?.next_classes ?? (data?.next_class ? [data.next_class] : []),
    nextClass: data?.next_class ?? null,
    latestFeedback: data?.latest_feedback ?? null,
  };
}

// ---- makeup page data -----------------------------------------------------

export async function getMakeupData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const familyLineId = await resolveFamilyLineId(supabase, lineUserId);
  const MAKEUP_QUOTA = await getMakeupQuota(supabase);
  // Single round-trip; assemble the per-class makeup view + stats in JS.
  const { data, error } = await supabase.rpc('get_liff_makeup', { p_line_user_id: familyLineId });
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
      // แจ้งเองผ่าน portal vs ระบบ/แอดมินสร้างให้ — เดิมเทียบ requestedBy === 'parent-liff'
      // ซึ่งเก็บลง DB ไม่ได้เลย (คอลัมน์เป็น uuid) จึงนับเป็น 0 ตลอด
      const isSelfRequested = (m: any) =>
        m.requestedVia === 'liff' || m.reason?.includes('ลาผ่านระบบ LIFF');
      const selfRequested = nonCancelled.filter(isSelfRequested).length;
      const systemGenerated = nonCancelled.filter((m: any) => !isSelfRequested(m)).length;
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
  const familyLineId = await resolveFamilyLineId(supabase, lineUserId);
  // Single round-trip via Postgres function.
  const { data, error } = await supabase.rpc('get_liff_feedback', { p_line_user_id: familyLineId });
  if (error) throw error;
  return { students: data?.students ?? [], feedbacks: data?.feedbacks ?? [] };
}

// ---- profile page data ----------------------------------------------------

export async function getProfileData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const viewer = await getViewerContext(supabase, lineUserId);
  const familyLineId = viewer?.parent?.line_user_id || lineUserId;
  // Single round-trip; returns camelCase parent + students + preferred branch.
  const { data, error } = await supabase.rpc('get_liff_profile', { p_line_user_id: familyLineId });
  if (error) throw error;
  const rec = viewer?.recipient;
  return {
    hasParent: data?.hasParent ?? false,
    parent: data?.parent ?? null,
    students: data?.students ?? [],
    preferredBranch: data?.preferredBranch ?? null,
    // account รอง (ผู้รับแจ้งเตือนที่ถูกเชิญ) — หน้า UI ใช้ซ่อนสิทธิ์จัดการ
    // ข้อมูลครอบครัว (แก้โปรไฟล์หลัก/เพิ่มนักเรียน/จัดการผู้รับ)
    viewerIsSecondary: !!viewer?.isSecondary,
    // ข้อมูลติดต่อของ "ตัวผู้รับเอง" — เขาแก้ของตัวเองได้ (ชื่อจริง/เบอร์/อีเมล)
    viewerRecipient: rec
      ? {
          id: rec.id,
          label: rec.label ?? null,
          fullName: rec.full_name ?? null,
          phone: rec.phone ?? null,
          email: rec.email ?? null,
          displayName: rec.display_name ?? null,
          pictureUrl: rec.picture_url ?? null,
          // ยังไม่ได้กรอกเบอร์ = ทางโรงเรียนติดต่อกลับไม่ได้ → หน้า UI ขึ้นเตือน
          needsContactInfo: !rec.phone,
        }
      : null,
  };
}

// ผู้รับเพิ่มเติมแก้ข้อมูลติดต่อ "ของตัวเอง" (ไม่แตะข้อมูลครอบครัว)
export async function updateRecipientSelf(
  lineUserId: string,
  data: { fullName?: string; phone?: string; email?: string; label?: string }
) {
  const supabase = createServiceClient() as any;
  const viewer = await getViewerContext(supabase, lineUserId);
  if (!viewer?.recipient) throw new Error('ไม่มีสิทธิ์แก้ไขข้อมูลนี้');

  const update: any = { updated_at: new Date().toISOString() };
  if (data.fullName !== undefined) update.full_name = data.fullName.trim() || null;
  if (data.phone !== undefined) update.phone = data.phone.trim() || null;
  if (data.email !== undefined) update.email = data.email.trim() || null;
  if (data.label !== undefined) update.label = data.label.trim() || null;

  const { error } = await supabase
    .from('parent_line_recipients')
    .update(update)
    .eq('id', viewer.recipient.id)
    .eq('line_user_id', lineUserId); // แก้ได้เฉพาะแถวของตัวเอง
  if (error) throw error;

  await logLiffActivity(supabase, viewer, 'recipient.update', {
    targetId: viewer.recipient.id,
    detail: { fields: Object.keys(update).filter((k) => k !== 'updated_at') },
  });
  return { ok: true };
}

export async function updateParentProfile(
  lineUserId: string,
  parentId: string,
  data: { displayName?: string; phone?: string; email?: string; preferredBranchId?: string; address?: any; emergencyPhone?: string }
) {
  const supabase = createServiceClient() as any;
  // Ownership check: the parent record must belong to the verified LINE user.
  // ผู้รับเพิ่มเติมแก้โปรไฟล์ครอบครัวไม่ได้ — ให้แก้ของตัวเองผ่าน updateRecipientSelf
  const viewer = await getViewerContext(supabase, lineUserId);
  const parent = viewer?.parent;
  if (!viewer || !parent || parent.id !== parentId || viewer.isSecondary) {
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
  await logLiffActivity(supabase, viewer, 'profile.update', {
    targetId: parentId,
    detail: { fields: Object.keys(update) },
  });
  return { ok: true };
}

// ---- leave request / cancel ----------------------------------------------

// Confirm the student belongs to the verified parent before mutating.
// คืน viewer context ด้วย — ผู้รับเพิ่มเติมทำรายการได้เหมือนผู้ปกครองหลัก
// แต่ต้องรู้ว่าเป็นใครเพื่อบันทึกลง transaction
async function assertStudentOwnedByLine(supabase: any, lineUserId: string, studentId: string) {
  const viewer = await getViewerContext(supabase, lineUserId);
  if (!viewer) throw new Error('ไม่พบข้อมูลผู้ปกครอง');
  const { data: student } = await supabase
    .from('students')
    .select('id, parent_id')
    .eq('id', studentId)
    .single();
  if (!student || student.parent_id !== viewer.parent.id) {
    throw new Error('ไม่มีสิทธิ์ดำเนินการกับนักเรียนคนนี้');
  }
  return viewer;
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

  const viewer = await assertStudentOwnedByLine(supabase, lineUserId, studentId);
  const parent = viewer.parent;

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

  // Denormalized columns the admin lists read (student/class/branch/parent names).
  // The admin-side createMakeupRequest fills these too — keep both paths identical
  // so a LIFF leave doesn't show up as a blank row in the admin makeup list.
  const [{ data: student }, { data: classData }] = await Promise.all([
    supabase.from('students').select('id, name, nickname').eq('id', studentId).single(),
    supabase.from('classes').select('id, name, code, subject_id, branch_id').eq('id', classId).single(),
  ]);
  const [{ data: subject }, { data: branch }] = await Promise.all([
    classData?.subject_id
      ? supabase.from('subjects').select('name').eq('id', classData.subject_id).single()
      : Promise.resolve({ data: null }),
    classData?.branch_id
      ? supabase.from('branches').select('name').eq('id', classData.branch_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const { data: makeupResult, error: makeupError } = await supabase
    .from('makeup_classes')
    .insert({
      type: type || 'scheduled',
      original_class_id: classId,
      original_schedule_id: scheduleId,
      original_session_number: schedule.session_number || 0,
      original_session_date: schedule.session_date,

      class_name: classData?.name || null,
      class_code: classData?.code || null,
      subject_id: classData?.subject_id || null,
      subject_name: subject?.name || null,

      student_id: studentId,
      student_name: student?.name || null,
      student_nickname: student?.nickname || null,

      parent_id: parent.id,
      parent_name: parent.display_name || parent.line_display_name || null,
      parent_phone: parent.phone || null,
      parent_line_user_id: parent.line_user_id || null,

      branch_id: classData?.branch_id || null,
      branch_name: branch?.name || null,

      request_date: new Date().toISOString(),
      // requested_by is a uuid column — the old code wrote the string 'parent-liff'
      // here, which made every LIFF leave fail with a 500. Channel + actor now live
      // in requested_via / requested_by_* instead.
      requested_by: parent.id,
      requested_via: 'liff',
      requested_by_line_id: viewer.actorLineId,
      requested_by_name: viewer.actorName,
      requested_by_role: viewer.isSecondary ? 'secondary' : 'primary',
      reason: reason || 'ลาผ่านระบบ LIFF',
      status: 'pending',
      counts_toward_quota: true, // a LIFF leave is a real leave → consumes quota
    })
    .select('id')
    .single();
  if (makeupError) throw makeupError;

  await logLiffActivity(supabase, viewer, 'leave.request', {
    studentId,
    targetId: makeupResult.id,
    detail: { classId, scheduleId, reason: reason || null, sessionDate: schedule.session_date },
  });

  const attendanceNote = `ลาผ่านระบบ LIFF (โดย ${viewer.actorName}${viewer.isSecondary ? ' — ผู้รับเพิ่มเติม' : ''})`;

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
        .update({ status: 'leave', note: attendanceNote, checked_at: new Date().toISOString(), checked_by: null })
        .eq('id', existingAtt.id);
    } else {
      await supabase.from('attendance').insert({
        schedule_id: scheduleId,
        student_id: studentId,
        status: 'leave',
        note: attendanceNote,
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

  const viewer = await assertStudentOwnedByLine(supabase, lineUserId, studentId);

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

  // แถว makeup ถูกลบทิ้ง → log คือร่องรอยเดียวที่เหลือว่าใครเป็นคนยกเลิก
  await logLiffActivity(supabase, viewer, 'leave.cancel', {
    studentId,
    targetId: makeupId,
    detail: {
      classId: makeup.original_class_id,
      scheduleId,
      sessionDate: makeup.original_session_date,
      reason: makeup.reason,
    },
  });

  const { error: deleteError } = await supabase.from('makeup_classes').delete().eq('id', makeupId);
  if (deleteError) throw deleteError;

  try {
    await supabase.from('attendance').delete().eq('schedule_id', scheduleId).eq('student_id', studentId);
  } catch (e) {
    console.error('[cancelLeave] attendance delete failed:', e);
  }

  return { ok: true, message: 'ยกเลิกการลาเรียนเรียบร้อยแล้ว' };
}

// ---- registration / student writes ----------------------------------------
// LIFF parents aren't Supabase-authed, so they can't use /api/admin/mutation
// (requireStaff → 401). These run with the service role and are scoped to the
// verified LINE user, mirroring the read layer above.

interface StudentInput {
  name: string;
  nameEn?: string | null;
  nickname: string;
  birthdate: string; // ISO or yyyy-mm-dd
  gender?: 'M' | 'F';
  schoolName?: string | null;
  gradeLevel?: string | null;
  allergies?: string | null;
  specialNeeds?: string | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
}

// กันสร้างนักเรียนซ้ำ — เทียบชื่อเล่น (ไม่สนตัวพิมพ์/ช่องว่าง) + วันเกิด
// เคสจริง: คุณพ่อที่เป็นผู้ปกครองร่วมเปิดลิงก์ทีมเก่าแล้วโดนไล่ให้ "ลงทะเบียน"
// ซ้ำ ๆ → ได้ลูกคนเดิมเพิ่มมาอีก 5 แถวในเดือนเดียว (30 ส.ค. 69)
async function findExistingStudent(supabase: any, parentId: string, student: StudentInput) {
  const nickname = (student.nickname || '').trim().toLowerCase();
  const birthdate = (student.birthdate || '').slice(0, 10);
  if (!nickname || !birthdate) return null;

  const { data } = await supabase
    .from('students')
    .select('id, nickname, birthdate')
    .eq('parent_id', parentId);

  return (
    (data || []).find(
      (row: any) =>
        (row.nickname || '').trim().toLowerCase() === nickname &&
        String(row.birthdate || '').slice(0, 10) === birthdate
    ) || null
  );
}

function studentRow(parentId: string, s: StudentInput) {
  return {
    parent_id: parentId,
    name: s.name?.trim(),
    name_en: s.nameEn?.trim() || null,
    nickname: s.nickname?.trim(),
    birthdate: s.birthdate, // date column accepts an ISO timestamp string
    gender: s.gender || 'M',
    school_name: s.schoolName?.trim() || null,
    grade_level: s.gradeLevel?.trim() || null,
    allergies: s.allergies?.trim() || null,
    special_needs: s.specialNeeds?.trim() || null,
    emergency_contact: s.emergencyContact?.trim() || null,
    emergency_phone: s.emergencyPhone?.trim() || null,
    is_active: true,
  };
}

// Register flow: if this LINE user already has a parent record, reuse it and just
// add the student; otherwise create the parent (bound to this LINE id) first.
export async function registerParentWithStudent(
  lineUserId: string,
  payload: {
    parentName: string;
    parentPhone: string;
    lineDisplayName?: string | null;
    linePictureUrl?: string | null;
    student: StudentInput;
  }
) {
  const supabase = createServiceClient() as any;
  const phone = (payload.parentPhone || '').replace(/[-\s]/g, '');

  if (!payload.student?.name || !payload.student?.nickname || !payload.student?.birthdate) {
    return { ok: false, status: 400, message: 'กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน' };
  }

  let parent = await getParentByLine(supabase, lineUserId);

  if (!parent) {
    if (!payload.parentName?.trim() || !phone) {
      return { ok: false, status: 400, message: 'กรุณากรอกชื่อและเบอร์โทรผู้ปกครอง' };
    }

    // Guard the phone unique constraint with a friendly message instead of a 500.
    const { data: dup } = await supabase
      .from('parents')
      .select('id, line_user_id')
      .eq('phone', phone)
      .maybeSingle();

    if (dup) {
      // If the existing record is already this LINE user's, reuse it; otherwise
      // it's someone else's phone.
      if (dup.line_user_id && dup.line_user_id === lineUserId) {
        parent = dup;
      } else {
        return {
          ok: false,
          status: 409,
          message: 'เบอร์โทรศัพท์นี้ถูกลงทะเบียนแล้ว กรุณาติดต่อสถาบัน',
        };
      }
    }
  }

  if (!parent) {
    const { data: created, error } = await supabase
      .from('parents')
      .insert({
        display_name: payload.parentName.trim(),
        phone,
        line_user_id: lineUserId,
        line_display_name: payload.lineDisplayName || null,
        picture_url: payload.linePictureUrl || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    parent = created;
  }

  // ลงทะเบียนซ้ำด้วยข้อมูลลูกคนเดิม = ไม่ต้องสร้างใหม่ (กันรายชื่อบานปลาย)
  const existing = await findExistingStudent(supabase, parent.id, payload.student);
  if (existing) {
    return { ok: true, parentId: parent.id, studentId: existing.id, alreadyRegistered: true };
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .insert(studentRow(parent.id, payload.student))
    .select('id')
    .single();
  if (studentError) throw studentError;

  return { ok: true, parentId: parent.id, studentId: student.id };
}

// Add a student to the verified parent's own account (portal "add student").
export async function createStudentForParent(lineUserId: string, student: StudentInput) {
  const supabase = createServiceClient() as any;
  const parent = await getParentByLine(supabase, lineUserId);
  if (!parent) return { ok: false, status: 404, message: 'ไม่พบข้อมูลผู้ปกครอง' };

  if (!student?.name || !student?.nickname || !student?.birthdate) {
    return { ok: false, status: 400, message: 'กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน' };
  }

  const existing = await findExistingStudent(supabase, parent.id, student);
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: `มี "${student.nickname}" ในรายชื่อของคุณอยู่แล้ว`,
    };
  }

  const { data, error } = await supabase
    .from('students')
    .insert(studentRow(parent.id, student))
    .select('id')
    .single();
  if (error) throw error;
  return { ok: true, studentId: data.id };
}

// Edit one of the verified parent's own students.
export async function updateStudentForParent(
  lineUserId: string,
  studentId: string,
  data: Partial<StudentInput>
) {
  const supabase = createServiceClient() as any;
  await assertStudentOwnedByLine(supabase, lineUserId, studentId);

  const update: any = {};
  if (data.name !== undefined) update.name = data.name?.trim();
  if (data.nameEn !== undefined) update.name_en = data.nameEn?.trim() || null;
  if (data.nickname !== undefined) update.nickname = data.nickname?.trim();
  if (data.birthdate !== undefined) update.birthdate = data.birthdate;
  if (data.gender !== undefined) update.gender = data.gender;
  if (data.schoolName !== undefined) update.school_name = data.schoolName?.trim() || null;
  if (data.gradeLevel !== undefined) update.grade_level = data.gradeLevel?.trim() || null;
  if (data.allergies !== undefined) update.allergies = data.allergies?.trim() || null;
  if (data.specialNeeds !== undefined) update.special_needs = data.specialNeeds?.trim() || null;
  if (data.emergencyContact !== undefined) update.emergency_contact = data.emergencyContact?.trim() || null;
  if (data.emergencyPhone !== undefined) update.emergency_phone = data.emergencyPhone?.trim() || null;
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from('students').update(update).eq('id', studentId);
  if (error) throw error;
  return { ok: true };
}
