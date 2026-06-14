// Scheduling Assistant service
// Two decision tools for admins:
//   1. findClassesForStudent — given subject/age/branch/availability, list classes
//      a new student can join, with next session date + how many makeups they'd owe.
//   2. suggestNewClassSlots — given room/teacher/subject/time/start/days, generate
//      the would-be session dates and report which ones conflict (room/teacher/holiday),
//      so you can tell if a full run of N sessions fits before another class blocks it.

import { getClient } from '@/lib/supabase/client';
import { getClasses, getClass, getClassSchedules } from '@/lib/services/classes';
import { getSubjects } from '@/lib/services/subjects';
import { getHolidaysForBranch } from '@/lib/services/holidays';
import { Class, Subject, ClassSchedule } from '@/types/models';

function getLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeTime(t: string): string {
  return (t || '').substring(0, 5);
}

/** Age in whole years from a birthdate string/Date; null if missing. */
function ageFromBirthdate(bd: string | Date | null | undefined): number | null {
  if (!bd) return null;
  const d = new Date(bd);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

type Classmate = { nickname: string; age: number | null; schoolName: string | null };

/** One query: active classmates for all given classes → map classId → classmates. */
async function getClassmatesForClasses(classIds: string[]): Promise<Map<string, Classmate[]>> {
  const map = new Map<string, Classmate[]>();
  if (classIds.length === 0) return map;
  const supabase = getClient();
  const { data, error } = await (supabase as any)
    .from('enrollments')
    .select('class_id, status, students(nickname, name, birthdate, school_name)')
    .in('class_id', classIds)
    .eq('status', 'active');
  if (error) { console.error('classmates fetch error', error); return map; }
  for (const row of (data || []) as any[]) {
    const st = row.students;
    if (!st) continue;
    const list = map.get(row.class_id) || [];
    list.push({
      nickname: st.nickname || st.name || '',
      age: ageFromBirthdate(st.birthdate),
      schoolName: st.school_name || null,
    });
    map.set(row.class_id, list);
  }
  return map;
}

/** Do two [start,end) time ranges overlap? times as "HH:MM". */
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return normalizeTime(aStart) < normalizeTime(bEnd) && normalizeTime(aEnd) > normalizeTime(bStart);
}

/** Top subjects by active enrollment in a branch — for quick-select chips. */
export async function getTopSubjects(
  branchId: string,
  limit = 3
): Promise<{ id: string; name: string; color: string; count: number }[]> {
  const supabase = getClient();
  // Pull active enrollments with their class's subject; aggregate in JS (small set).
  const { data, error } = await (supabase as any)
    .from('enrollments')
    .select('status, classes!enrollments_class_id_fkey(branch_id, subject_id, subjects(id, name, color))')
    .eq('status', 'active');
  if (error) { console.error('top subjects error', error); return []; }

  const counts = new Map<string, { id: string; name: string; color: string; count: number }>();
  for (const row of (data || []) as any[]) {
    const cls = row.classes;
    if (!cls || cls.branch_id !== branchId) continue;
    const subj = cls.subjects;
    if (!subj) continue;
    const cur = counts.get(subj.id) || { id: subj.id, name: subj.name, color: subj.color || '#6B7280', count: 0 };
    cur.count++;
    counts.set(subj.id, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

// ============================================================
// Tab 1 — Find classes for a new student
// ============================================================

export interface StudentAvailabilitySlot {
  /** 0=Sun … 6=Sat */
  dayOfWeek: number;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface FindClassesParams {
  subjectId: string;
  branchId: string;
  /** student age in years; used only to flag age-range mismatch (not to exclude) */
  age?: number;
  /** when the student is free; empty = no time constraint */
  availability?: StudentAvailabilitySlot[];
}

export interface ClassMatch {
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  roomId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  status: string;
  maxStudents: number;
  enrolledCount: number;
  seatsLeft: number;
  /** true when the class has no seats left */
  isFull: boolean;
  totalSessions: number;
  /** the class's actual first session date (when the course began) */
  classStartDate: string;
  /** true if the course hasn't started yet (start date is today or later) */
  hasStarted: boolean;
  /** next session the student could attend (>= today), null if class already ended */
  nextSessionDate: string | null;
  nextSessionNumber: number | null;
  /** sessions already passed = makeups the student would owe to catch up */
  makeupCount: number;
  /** does the class day+time fit the student's availability? (true if none given) */
  fitsAvailability: boolean;
  /** does the class fall on a day the student is free? (true if no availability given) */
  fitsDay: boolean;
  /** does it fit the time window on a matching day? (true if no availability given) */
  fitsTime: boolean;
  /** is the student's age within the subject's age range? null if age/range unknown */
  ageFits: boolean | null;
  /** true when this is the exact subject requested; false = a nearby suggestion */
  isExactSubject: boolean;
  /** students already enrolled (active) — to gauge peer age/school fit */
  classmates: { nickname: string; age: number | null; schoolName: string | null }[];
  /** average age of enrolled classmates (null if none/no birthdates) */
  avgClassmateAge: number | null;
}

export interface FindClassesResult {
  exact: ClassMatch[];
  nearby: ClassMatch[];
}

/** Break availability fit into day-fit and time-fit so the UI can explain WHY.
 * Time is a flexible OVERLAP check (any overlap with a free slot counts) — a class
 * at 08:30-10:30 still "fits" a 09:00-18:00 window since they overlap 09:00-10:30. */
function classAvailabilityFit(
  cls: Class,
  availability?: StudentAvailabilitySlot[]
): { fitsDay: boolean; fitsTime: boolean } {
  if (!availability || availability.length === 0) return { fitsDay: true, fitsTime: true };
  const dayMatch = cls.daysOfWeek.filter((dow) => availability.some((s) => s.dayOfWeek === dow));
  const fitsDay = dayMatch.length > 0;
  const cs = normalizeTime(cls.startTime);
  const ce = normalizeTime(cls.endTime);
  // time fits if the class overlaps a free slot on a day the student is free
  const fitsTime = dayMatch.some((dow) =>
    availability.some(
      (slot) =>
        slot.dayOfWeek === dow &&
        cs < normalizeTime(slot.endTime) &&
        ce > normalizeTime(slot.startTime)
    )
  );
  return { fitsDay, fitsTime };
}

async function buildMatch(
  cls: Class,
  subject: Subject | undefined,
  age: number | undefined,
  availability: StudentAvailabilitySlot[] | undefined,
  isExactSubject: boolean,
  todayStr: string,
  classmates: Classmate[]
): Promise<ClassMatch> {
  const schedules = await getClassSchedules(cls.id);
  const active = schedules.filter((s) => s.status !== 'cancelled' && s.status !== 'rescheduled');

  const sortedActive = [...active].sort((a, b) => +new Date(a.sessionDate) - +new Date(b.sessionDate));
  // makeups owed = sessions whose date is before today
  const past = active.filter((s) => getLocalDateString(new Date(s.sessionDate)) < todayStr);
  const upcoming = sortedActive.filter((s) => getLocalDateString(new Date(s.sessionDate)) >= todayStr);
  const next = upcoming[0];
  // actual course start = earliest active session (fallback to configured startDate)
  const classStartDate = sortedActive[0]
    ? getLocalDateString(new Date(sortedActive[0].sessionDate))
    : getLocalDateString(new Date(cls.startDate));
  const hasStarted = classStartDate < todayStr;

  const ageFits =
    age == null || !subject?.ageRange
      ? null
      : age >= subject.ageRange.min && age <= subject.ageRange.max;

  const ages = classmates.map((c) => c.age).filter((a): a is number => a != null);
  const avgClassmateAge = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null;

  return {
    classId: cls.id,
    className: cls.name,
    classCode: cls.code,
    subjectId: cls.subjectId,
    subjectName: subject?.name || '',
    teacherId: cls.teacherId,
    roomId: cls.roomId,
    daysOfWeek: cls.daysOfWeek,
    startTime: normalizeTime(cls.startTime),
    endTime: normalizeTime(cls.endTime),
    status: cls.status,
    maxStudents: cls.maxStudents,
    enrolledCount: cls.enrolledCount,
    seatsLeft: Math.max(0, cls.maxStudents - cls.enrolledCount),
    isFull: cls.maxStudents - cls.enrolledCount <= 0,
    totalSessions: cls.totalSessions,
    classStartDate,
    hasStarted,
    nextSessionDate: next ? getLocalDateString(new Date(next.sessionDate)) : null,
    nextSessionNumber: next ? next.sessionNumber : null,
    makeupCount: past.length,
    ...(() => {
      const fit = classAvailabilityFit(cls, availability);
      return { fitsAvailability: fit.fitsDay && fit.fitsTime, fitsDay: fit.fitsDay, fitsTime: fit.fitsTime };
    })(),
    ageFits,
    isExactSubject,
    classmates,
    avgClassmateAge,
  };
}

export async function findClassesForStudent(params: FindClassesParams): Promise<FindClassesResult> {
  const { subjectId, branchId, age, availability } = params;
  const todayStr = getLocalDateString(new Date());

  const [allClasses, subjects] = await Promise.all([getClasses(branchId), getSubjects()]);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const targetSubject = subjectMap.get(subjectId);

  // Active courses (published/started). Full classes are kept too — shown with a
  // "เต็ม" badge in case the parent wants a waitlist / extra seat.
  const joinable = allClasses.filter(
    (c) => c.status === 'published' || c.status === 'started'
  );

  const exactClasses = joinable.filter((c) => c.subjectId === subjectId);

  // "Nearby" = same category and/or level as the requested subject, different subject.
  const nearbySubjectIds = new Set(
    subjects
      .filter(
        (s) =>
          s.id !== subjectId &&
          targetSubject &&
          (s.category === targetSubject.category || s.level === targetSubject.level)
      )
      .map((s) => s.id)
  );
  const nearbyClasses = joinable.filter((c) => nearbySubjectIds.has(c.subjectId));

  // Fetch classmates for all candidate classes in one query.
  const candidateIds = [...exactClasses, ...nearbyClasses].map((c) => c.id);
  const classmatesMap = await getClassmatesForClasses(candidateIds);

  const exact = await Promise.all(
    exactClasses.map((c) => buildMatch(c, subjectMap.get(c.subjectId), age, availability, true, todayStr, classmatesMap.get(c.id) || []))
  );
  const nearby = await Promise.all(
    nearbyClasses.map((c) => buildMatch(c, subjectMap.get(c.subjectId), age, availability, false, todayStr, classmatesMap.get(c.id) || []))
  );

  // "Age gap": how far the student's age is from a good fit. Smaller = better.
  // Uses subject age-range first, falls back to classmates' average age.
  const ageGap = (m: ClassMatch): number => {
    if (age == null) return 0;
    const subj = subjectMap.get(m.subjectId);
    if (subj?.ageRange) {
      if (age < subj.ageRange.min) return subj.ageRange.min - age;
      if (age > subj.ageRange.max) return age - subj.ageRange.max;
      return 0; // within range
    }
    if (m.avgClassmateAge != null) return Math.abs(age - m.avgClassmateAge);
    return 0;
  };

  // Rank: time fit → has seats (full sinks) → fewest makeups → age fit → soonest.
  const rank = (a: ClassMatch, b: ClassMatch) => {
    if (a.fitsAvailability !== b.fitsAvailability) return a.fitsAvailability ? -1 : 1;
    if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
    if (!a.nextSessionDate) return 1;
    if (!b.nextSessionDate) return -1;
    if (a.makeupCount !== b.makeupCount) return a.makeupCount - b.makeupCount;
    const ga = ageGap(a), gb = ageGap(b);
    if (ga !== gb) return ga - gb;
    return a.nextSessionDate.localeCompare(b.nextSessionDate);
  };

  // Drop classes with no future session, and (when an age is given) any whose
  // subject age-range excludes the child — don't recommend age-inappropriate classes.
  const keep = (m: ClassMatch) => m.nextSessionDate && m.ageFits !== false;

  return {
    exact: exact.filter(keep).sort(rank),
    nearby: nearby.filter(keep).sort(rank),
  };
}

// ============================================================
// Tab 2 — Suggest when a new class can open
// ============================================================

export interface SuggestSlotParams {
  branchId: string;
  roomId: string;
  teacherId: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  /** earliest start date to consider */
  startDate: Date;
  /** 0=Sun … 6=Sat */
  daysOfWeek: number[];
  totalSessions: number;
  /** exclude an existing class (when editing) */
  excludeClassId?: string;
  /** how far ahead to look for fitting the full run (months) */
  horizonMonths?: number;
}

export interface SessionCheck {
  date: string;
  sessionNumber: number;
  ok: boolean;
  conflicts: { type: string; message: string; conflict_type: string; conflict_name: string; conflict_time: string }[];
}

export interface SuggestSlotResult {
  /** the generated session dates (holidays already skipped) */
  sessions: SessionCheck[];
  /** can the full run of totalSessions happen with NO conflicts? */
  canOpenFully: boolean;
  /** if not, the session number where the first conflict occurs */
  firstConflictSession: number | null;
  /** how many leading sessions are conflict-free before the first conflict */
  conflictFreeLeading: number;
  /** end date of the full run (last session) */
  lastSessionDate: string | null;
}

/** Generate session dates honoring daysOfWeek + skipping holidays, up to totalSessions. */
function genSessionDates(
  startDate: Date,
  daysOfWeek: number[],
  totalSessions: number,
  holidayStrings: Set<string>,
  horizonMonths: number
): Date[] {
  const dates: Date[] = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const limit = new Date(startDate);
  limit.setMonth(limit.getMonth() + horizonMonths);

  while (dates.length < totalSessions && cur <= limit) {
    const dow = cur.getDay();
    const ds = getLocalDateString(cur);
    if (daysOfWeek.includes(dow) && !holidayStrings.has(ds)) {
      dates.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export async function suggestNewClassSlots(params: SuggestSlotParams): Promise<SuggestSlotResult> {
  const {
    branchId, roomId, teacherId, startTime, endTime,
    startDate, daysOfWeek, totalSessions, excludeClassId,
    horizonMonths = 12,
  } = params;

  // 1. Holidays in the look-ahead window → skip them when generating dates.
  const horizonEnd = new Date(startDate);
  horizonEnd.setMonth(horizonEnd.getMonth() + horizonMonths);
  const holidays = await getHolidaysForBranch(branchId, startDate, horizonEnd);
  const holidayStrings = new Set(holidays.map((h) => getLocalDateString(new Date(h.date))));

  const dates = genSessionDates(startDate, daysOfWeek, totalSessions, holidayStrings, horizonMonths);

  if (dates.length === 0) {
    return { sessions: [], canOpenFully: false, firstConflictSession: null, conflictFreeLeading: 0, lastSessionDate: null };
  }

  // 2. One RPC call checks room+teacher conflicts across ALL dates.
  const supabase = getClient();
  const { data, error } = await (supabase as any).rpc('check_range_availability', {
    p_dates: dates.map((d) => getLocalDateString(d)),
    p_start_time: startTime,
    p_end_time: endTime,
    p_branch_id: branchId,
    p_room_id: roomId,
    p_teacher_id: teacherId,
    p_exclude_class_id: excludeClassId || null,
  });
  if (error) throw error;

  const conflictsByDate = new Map<string, any[]>();
  for (const row of (data || []) as any[]) {
    conflictsByDate.set(row.date, row.conflicts || []);
  }

  const sessions: SessionCheck[] = dates.map((d, i) => {
    const ds = getLocalDateString(d);
    const conflicts = conflictsByDate.get(ds) || [];
    return { date: ds, sessionNumber: i + 1, ok: conflicts.length === 0, conflicts };
  });

  const firstConflict = sessions.find((s) => !s.ok);
  const conflictFreeLeading = firstConflict ? firstConflict.sessionNumber - 1 : sessions.length;

  return {
    sessions,
    canOpenFully: !firstConflict && sessions.length === totalSessions,
    firstConflictSession: firstConflict ? firstConflict.sessionNumber : null,
    conflictFreeLeading,
    lastSessionDate: sessions[sessions.length - 1]?.date || null,
  };
}
