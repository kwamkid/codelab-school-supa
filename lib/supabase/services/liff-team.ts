// lib/supabase/services/liff-team.ts
// แท็บ "ทีม" ในแอปผู้ปกครอง — ยก /team (VEX team portal) เข้ามาไว้ที่เดียวกัน
//
// ต่างจาก /team ตรงที่ไม่ได้ใช้ secret token ในลิงก์ แต่ resolve จาก LINE ที่ยืนยัน
// แล้ว: ผู้ปกครอง → ลูก (students) → vex.kids (ผูก student_id ครบทุกคน) → ทีม
// ทำให้ **ผู้ปกครองร่วมก็เห็นทีมของลูกด้วย** (ฝั่ง /team เช็คแต่ parents.line_user_id)
//
// บ้านที่ไม่มีลูกอยู่ทีม → hasTeam:false และแท็บทีมจะไม่ขึ้นเลย

import { createServiceClient } from '../server';
import { vexDb } from '@/lib/vex/supabase';
import { getViewerContext, type ViewerContext } from './liff-data';

export interface TeamMemberView {
  studentId: string;
  kidId: string;
  nickname: string;
  name: string;
  team: {
    id: string;
    teamNumber: string;
    name: string | null;
    level: string;
    coachName: string | null;
    coachImage: string | null;
    notebookUrl: string | null;
    notebookSubmitUrl: string | null;
    teammates: { id: string; nickname: string }[];
  };
}

const PRACTICE_STATUS = ['proposed', 'approved', 'rejected'] as const;

// ---- resolve: ผู้ปกครอง → ลูก → kids → ทีม -------------------------------

async function resolveFamilyKids(supabase: any, viewer: ViewerContext) {
  const { data: students } = await supabase
    .from('students')
    .select('id, name, nickname')
    .eq('parent_id', viewer.parent.id)
    .eq('is_active', true);
  const studentIds = (students || []).map((s: any) => s.id);
  if (studentIds.length === 0) return { students: [], kids: [] };

  const db = vexDb();
  const { data: kids } = await db
    .from('kids')
    .select('id, team_id, nickname, full_name, student_id')
    .in('student_id', studentIds);

  return { students: students || [], kids: kids || [] };
}

/** เบา ๆ สำหรับ bottom nav — บ้านนี้มีลูกอยู่ทีมไหม */
export async function familyHasTeam(lineUserId: string): Promise<boolean> {
  const supabase = createServiceClient() as any;
  const viewer = await getViewerContext(supabase, lineUserId);
  if (!viewer) return false;
  const { kids } = await resolveFamilyKids(supabase, viewer);
  return kids.length > 0;
}

// ---- ข้อมูลทั้งหมดของแท็บทีม ---------------------------------------------

export async function getTeamData(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const viewer = await getViewerContext(supabase, lineUserId);
  if (!viewer) return { hasTeam: false, members: [] as TeamMemberView[] };

  const { students, kids } = await resolveFamilyKids(supabase, viewer);
  if (kids.length === 0) return { hasTeam: false, members: [] as TeamMemberView[] };

  const db = vexDb();
  const teamIds = Array.from(new Set(kids.map((k: any) => k.team_id)));

  const [teamRes, kidRes] = await Promise.all([
    db.from('teams').select('*').in('id', teamIds),
    // เพื่อนร่วมทีม (ไว้โชว์ว่าทีมนี้มีใครบ้าง + แปะชื่อเจ้าของวันซ้อม)
    db.from('kids').select('id, team_id, nickname').in('team_id', teamIds),
  ]);
  const teams: any[] = teamRes?.data || [];
  const allKids: any[] = kidRes?.data || [];

  // ครูผู้ดูแลทีม — อยู่ public.teachers (อ่านอย่างเดียว)
  const coachIds: string[] = Array.from(
    new Set(teams.map((t: any) => t.coach_teacher_id).filter(Boolean))
  );
  const coachById = new Map<string, { name: string; image: string | null }>();
  if (coachIds.length > 0) {
    const { data: coaches } = await supabase
      .from('teachers')
      .select('id, name, nickname, profile_image')
      .in('id', coachIds)
      .eq('is_active', true);
    for (const c of (coaches || []) as any[]) {
      coachById.set(c.id, { name: c.nickname || c.name, image: c.profile_image || null });
    }
  }

  // ตารางซ้อม: เห็นของทั้งทีม (บ้านอื่น/แอดมินเพิ่มก็เห็น) แต่แก้ได้เฉพาะของตัวเอง
  const { data: practiceRows } = await db
    .from('practices')
    .select('*')
    .in('team_id', teamIds)
    .order('practice_date', { ascending: true });
  const practices: any[] = practiceRows || [];

  // การแข่งขันที่เปิดให้ระดับของทีมนี้ + คำตอบ RSVP ของลูกเรา
  const levels = Array.from(new Set(teams.map((t: any) => t.level)));
  const { data: levelRowsData } = await db.from('event_levels').select('event_id, level').in('level', levels);
  const levelRows: any[] = levelRowsData || [];
  const eventIds: string[] = Array.from(new Set(levelRows.map((r: any) => r.event_id)));
  const [eventRes, attendanceRes] = await Promise.all([
    eventIds.length
      ? db.from('events').select('*').in('id', eventIds).order('date_start', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    db.from('attendance').select('*').in('kid_id', kids.map((k: any) => k.id)),
  ]);
  const events: any[] = (eventRes as any)?.data || [];
  const attendance: any[] = (attendanceRes as any)?.data || [];

  const eventsByLevel = new Map<string, string[]>();
  for (const r of levelRows) {
    const list = eventsByLevel.get(r.level) || [];
    list.push(r.event_id);
    eventsByLevel.set(r.level, list);
  }

  const studentById = new Map<string, any>((students as any[]).map((s: any) => [s.id, s]));
  const teamById = new Map<string, any>(teams.map((t: any) => [t.id, t]));

  const members = kids
    .map((k: any) => {
      const student = studentById.get(k.student_id);
      const team = teamById.get(k.team_id);
      if (!student || !team) return null;
      const coach = team.coach_teacher_id ? coachById.get(team.coach_teacher_id) : null;
      const teammates: { id: string; nickname: string }[] = allKids
        .filter((x: any) => x.team_id === team.id)
        .map((x: any) => ({ id: x.id, nickname: x.nickname }));

      // รูปแบบเดียวกับที่ PracticeCalendar (คอมโพเนนต์ร่วมกับ /team) ต้องการ
      const teamPractices = practices
        .filter((p: any) => p.team_id === team.id)
        .map((p: any) => ({
          id: p.id,
          kid_id: p.kid_id,
          parent_id: p.parent_id,
          practice_date: p.practice_date,
          start_time: p.start_time,
          end_time: p.end_time,
          note: p.note,
          status: p.status,
          reject_reason: p.reject_reason,
        }));

      const teamEventIds = eventsByLevel.get(team.level) || [];
      const teamEvents = events
        .filter((e: any) => teamEventIds.includes(e.id))
        .map((e: any) => ({
          id: e.id,
          name: e.name,
          dateStart: e.date_start,
          dateEnd: e.date_end,
          place: e.place,
          hasWorldSpot: e.has_world_spot,
          rsvp: attendance.find((a: any) => a.event_id === e.id && a.kid_id === k.id)?.status || 'pend',
        }));

      return {
        studentId: student.id,
        kidId: k.id,
        nickname: student.nickname || k.nickname,
        name: student.name,
        team: {
          id: team.id,
          teamNumber: team.team_number,
          name: team.name,
          level: team.level,
          coachName: coach?.name || null,
          coachImage: coach?.image || null,
          notebookUrl: team.notebook_url || null,
          notebookSubmitUrl: team.notebook_submit_url || null,
          teammates,
        },
        practices: teamPractices,
        events: teamEvents,
      };
    })
    .filter(Boolean) as TeamMemberView[];

  return {
    hasTeam: members.length > 0,
    viewerIsSecondary: viewer.isSecondary,
    // ปฏิทินใช้เทียบว่าคำขอไหนเป็นของบ้านเรา (แก้/ลบได้เฉพาะของตัวเอง)
    parentId: viewer.parent.id,
    members,
  };
}

// ---- mutations ------------------------------------------------------------

// เด็กคนนี้เป็นลูกของ viewer จริงไหม (กันขอซ้อมให้เด็กบ้านอื่น)
async function assertKidInFamily(supabase: any, viewer: ViewerContext, kidId: string) {
  const { kids } = await resolveFamilyKids(supabase, viewer);
  const kid = kids.find((k: any) => k.id === kidId);
  if (!kid) throw new Error('ไม่มีสิทธิ์ดำเนินการกับนักเรียนคนนี้');
  return kid;
}

async function loadViewer(lineUserId: string) {
  const supabase = createServiceClient() as any;
  const viewer = await getViewerContext(supabase, lineUserId);
  if (!viewer) throw new Error('ไม่พบข้อมูลผู้ปกครอง');
  return { supabase, viewer };
}

export async function proposePractice(
  lineUserId: string,
  input: { kidId: string; dates: string[]; startTime?: string; endTime?: string; note?: string }
) {
  const { supabase, viewer } = await loadViewer(lineUserId);
  const kid = await assertKidInFamily(supabase, viewer, input.kidId);

  const dates = (input.dates || []).filter(Boolean);
  if (dates.length === 0) throw new Error('เลือกวันซ้อมอย่างน้อย 1 วัน');
  if (input.startTime && input.endTime && input.endTime <= input.startTime) {
    throw new Error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
  }

  const db = vexDb();
  const { data, error } = await db
    .from('practices')
    .insert(
      dates.map((d) => ({
        team_id: kid.team_id,
        kid_id: kid.id,
        parent_id: viewer.parent.id,
        practice_date: d,
        start_time: input.startTime || null,
        end_time: input.endTime || null,
        note: input.note || null,
        status: 'proposed',
      }))
    )
    .select('*');
  if (error) throw new Error(error.message);
  return { ok: true, created: (data || []).length, practices: data || [] };
}

export async function updatePractice(
  lineUserId: string,
  practiceId: string,
  patch: { date?: string; startTime?: string | null; endTime?: string | null; note?: string | null }
) {
  const { supabase, viewer } = await loadViewer(lineUserId);
  const db = vexDb();
  const { data: practice } = await db.from('practices').select('*').eq('id', practiceId).maybeSingle();
  if (!practice) throw new Error('ไม่พบคำขอ');
  if (practice.parent_id !== viewer.parent.id) throw new Error('ไม่มีสิทธิ์แก้ไขคำขอนี้');
  if (practice.status !== 'proposed') throw new Error('คำขอนี้ถูกตรวจแล้ว แก้ไข/ลบไม่ได้');
  await assertKidInFamily(supabase, viewer, practice.kid_id);

  const update: any = {};
  if (patch.date !== undefined) update.practice_date = patch.date;
  if (patch.startTime !== undefined) update.start_time = patch.startTime || null;
  if (patch.endTime !== undefined) update.end_time = patch.endTime || null;
  if (patch.note !== undefined) update.note = patch.note || null;
  if (update.start_time && update.end_time && update.end_time <= update.start_time) {
    throw new Error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { data, error } = await db.from('practices').update(update).eq('id', practiceId).select('*');
  if (error) throw new Error(error.message);
  return { ok: true, practice: (data || [])[0] || null };
}

export async function deletePractice(lineUserId: string, practiceId: string) {
  const { viewer } = await loadViewer(lineUserId);
  const db = vexDb();
  const { data: practice } = await db.from('practices').select('*').eq('id', practiceId).maybeSingle();
  if (!practice) throw new Error('ไม่พบคำขอ');
  if (practice.parent_id !== viewer.parent.id) throw new Error('ไม่มีสิทธิ์ลบคำขอนี้');
  if (practice.status !== 'proposed') throw new Error('คำขอนี้ถูกตรวจแล้ว แก้ไข/ลบไม่ได้');
  const { error } = await db.from('practices').delete().eq('id', practiceId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setEventRsvp(
  lineUserId: string,
  input: { eventId: string; kidId: string; status: 'pend' | 'go' | 'no' }
) {
  const { supabase, viewer } = await loadViewer(lineUserId);
  const kid = await assertKidInFamily(supabase, viewer, input.kidId);

  const db = vexDb();
  // งานนี้เปิดให้ระดับของทีมนี้จริงไหม
  const { data: team } = await db.from('teams').select('level').eq('id', kid.team_id).maybeSingle();
  const { data: allowed } = await db
    .from('event_levels')
    .select('event_id')
    .eq('event_id', input.eventId)
    .eq('level', team?.level)
    .maybeSingle();
  if (!allowed) throw new Error('กิจกรรมนี้ไม่เปิดสำหรับทีมนี้');

  const { data: existing } = await db
    .from('attendance')
    .select('id')
    .eq('event_id', input.eventId)
    .eq('kid_id', input.kidId)
    .maybeSingle();

  const actor = viewer.actorName + (viewer.isSecondary ? ' (ผู้ปกครองร่วม)' : '');
  if (existing) {
    const { error } = await db
      .from('attendance')
      .update({
        status: input.status,
        parent_id: viewer.parent.id,
        updated_by: actor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('attendance').insert({
      event_id: input.eventId,
      kid_id: input.kidId,
      status: input.status,
      parent_id: viewer.parent.id,
      updated_by: actor,
    });
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export { PRACTICE_STATUS };
