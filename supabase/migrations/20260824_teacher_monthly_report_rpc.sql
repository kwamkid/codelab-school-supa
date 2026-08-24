-- Monthly teacher evaluation report (/reports/teacher-monthly).
-- One round-trip: per-teacher counts of sessions taught, attendance checked and
-- Teacher-Feedback sent for one calendar month, plus makeup/trial sessions.
--
-- Notes
--  * teacher of a session = COALESCE(class_schedules.actual_teacher_id, classes.teacher_id)
--    so substitutes are credited to the person who actually taught it.
--  * only sessions that already happened are counted — the window ends at
--    LEAST(month_end, today in Bangkok) so a mid-month view doesn't score a
--    teacher against classes they haven't taught yet.
--  * "feedback" lives on public.attendance (feedback text + photos[]), one row
--    per student, so a session counts as "มี feedback" when ≥1 student got one.
--  * WHO checked attendance: attendance.checked_by is an **auth.users id**, not
--    an admin_users id — join through admin_users.auth_user_id, then
--    admin_users.teacher_id tells us whether the checker IS the teacher of that
--    session (ครูเช็คเอง) or somebody else (แอดมิน/ครูคนอื่นเช็คให้).
--    Rows saved before checked_by was recorded come back as "ไม่ทราบผู้เช็ค".

create or replace function public.get_teacher_monthly_report(
  p_month date default null,
  p_branch_id uuid default null
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
with rng as (
  select
    date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Bangkok')::date))::date as m_start,
    (date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Bangkok')::date))
      + interval '1 month' - interval '1 day')::date as m_end,
    (now() at time zone 'Asia/Bangkok')::date as today
),
win as (
  select m_start, m_end, today, least(m_end, today) as cutoff from rng
),
sess as (
  select cs.id as sid,
         cs.session_date,
         cs.session_number,
         coalesce(cs.actual_teacher_id, c.teacher_id) as tid,
         coalesce(nullif(su.name, ''), c.name) as label
  from class_schedules cs
  join classes c on c.id = cs.class_id
  left join subjects su on su.id = c.subject_id
  cross join win w
  where cs.session_date between w.m_start and w.cutoff
    and c.status in ('started', 'completed')
    and cs.status <> 'cancelled'
    and (p_branch_id is null or c.branch_id = p_branch_id)
),
sess_flags as (
  select s.*,
    exists (select 1 from attendance a where a.schedule_id = s.sid) as checked,
    -- ครูเจ้าของคาบเป็นคนกดเช็คเอง
    exists (
      select 1 from attendance a
      join admin_users au on au.auth_user_id = a.checked_by
      where a.schedule_id = s.sid and au.teacher_id = s.tid
    ) as self_checked,
    -- ชื่อคนอื่นที่กดเช็คให้ (แอดมิน หรือครูคนอื่น) — null = ไม่มี/ไม่ทราบ
    (
      select min(coalesce(nullif(btrim(au.display_name), ''), au.email))
      from attendance a
      join admin_users au on au.auth_user_id = a.checked_by
      where a.schedule_id = s.sid and au.teacher_id is distinct from s.tid
    ) as other_by,
    exists (select 1 from attendance a where a.schedule_id = s.sid
              and btrim(coalesce(a.feedback, '')) <> '') as has_fb,
    exists (select 1 from attendance a where a.schedule_id = s.sid
              and coalesce(array_length(a.photos, 1), 0) > 0) as has_photo
  from sess s
),
agg as (
  select tid,
    count(*) as sessions,
    count(*) filter (where checked) as checked,
    count(*) filter (where self_checked) as self_checked,
    count(*) filter (where checked and not self_checked and other_by is not null) as other_checked,
    count(*) filter (where checked and not self_checked and other_by is null) as unknown_checked,
    count(*) filter (where has_fb) as fb_sessions,
    count(*) filter (where has_photo) as photo_sessions,
    coalesce(
      jsonb_agg(jsonb_build_object('date', session_date, 'label', label, 'no', session_number)
                order by session_date) filter (where not checked),
      '[]'::jsonb) as unchecked_list,
    coalesce(
      jsonb_agg(jsonb_build_object('date', session_date, 'label', label, 'no', session_number,
                                   'by', other_by)
                order by session_date) filter (where checked and not self_checked),
      '[]'::jsonb) as other_checked_list,
    coalesce(
      jsonb_agg(jsonb_build_object('date', session_date, 'label', label, 'no', session_number)
                order by session_date) filter (where checked and not has_fb),
      '[]'::jsonb) as no_fb_list
  from sess_flags
  group by tid
),
stu as (
  select s.tid,
    count(*) filter (where a.status in ('present', 'late')) as attended,
    count(*) filter (where btrim(coalesce(a.feedback, '')) <> '') as fb_students
  from sess s
  join attendance a on a.schedule_id = s.sid
  group by s.tid
),
mk as (
  select m.makeup_teacher_id as tid,
    count(*) as makeup_total,
    count(*) filter (where m.attendance_status is not null) as makeup_checked
  from makeup_classes m
  cross join win w
  where m.makeup_teacher_id is not null
    and m.makeup_date between w.m_start and w.cutoff
    and m.status <> 'cancelled'
    and (p_branch_id is null or coalesce(m.makeup_branch_id, m.branch_id) = p_branch_id)
  group by 1
),
tr as (
  select t.teacher_id as tid,
    count(*) as trial_total,
    count(*) filter (where t.attended is not null) as trial_checked
  from trial_sessions t
  cross join win w
  where t.teacher_id is not null
    and t.scheduled_date between w.m_start and w.cutoff
    and t.status <> 'cancelled'
    and (p_branch_id is null or t.branch_id = p_branch_id)
  group by 1
),
ids as (
  select tid from agg where tid is not null
  union select tid from mk where tid is not null
  union select tid from tr where tid is not null
),
rows as (
  select
    i.tid as id,
    coalesce(nullif(te.nickname, ''), nullif(te.name, ''), 'ไม่ระบุครู') as nickname,
    coalesce(nullif(te.name, ''), '') as name,
    coalesce(te.is_active, false) as is_active,
    coalesce(a.sessions, 0) as sessions,
    coalesce(a.checked, 0) as checked,
    coalesce(a.self_checked, 0) as self_checked,
    coalesce(a.other_checked, 0) as other_checked,
    coalesce(a.unknown_checked, 0) as unknown_checked,
    coalesce(a.fb_sessions, 0) as fb_sessions,
    coalesce(a.photo_sessions, 0) as photo_sessions,
    coalesce(s.attended, 0) as attended,
    coalesce(s.fb_students, 0) as fb_students,
    coalesce(m.makeup_total, 0) as makeup_total,
    coalesce(m.makeup_checked, 0) as makeup_checked,
    coalesce(t.trial_total, 0) as trial_total,
    coalesce(t.trial_checked, 0) as trial_checked,
    coalesce(a.unchecked_list, '[]'::jsonb) as unchecked_list,
    coalesce(a.other_checked_list, '[]'::jsonb) as other_checked_list,
    coalesce(a.no_fb_list, '[]'::jsonb) as no_fb_list
  from ids i
  left join teachers te on te.id = i.tid
  left join agg a on a.tid = i.tid
  left join stu s on s.tid = i.tid
  left join mk m on m.tid = i.tid
  left join tr t on t.tid = i.tid
)
select jsonb_build_object(
  'month', to_char((select m_start from win), 'YYYY-MM'),
  'monthStart', (select m_start from win),
  'monthEnd', (select m_end from win),
  'cutoff', (select cutoff from win),
  -- true = เดือนนี้ยังไม่จบ (นับถึงวันนี้); false ทั้งเดือนที่จบแล้วและเดือนอนาคตที่ยังไม่มีข้อมูล
  'partial', (select cutoff < m_end and cutoff >= m_start from win),
  'totals', jsonb_build_object(
    'teachers', (select count(*) from rows),
    'sessions', (select coalesce(sum(sessions), 0) from rows),
    'checked', (select coalesce(sum(checked), 0) from rows),
    'selfChecked', (select coalesce(sum(self_checked), 0) from rows),
    'otherChecked', (select coalesce(sum(other_checked), 0) from rows),
    'unknownChecked', (select coalesce(sum(unknown_checked), 0) from rows),
    'fbSessions', (select coalesce(sum(fb_sessions), 0) from rows),
    'photoSessions', (select coalesce(sum(photo_sessions), 0) from rows),
    'attended', (select coalesce(sum(attended), 0) from rows),
    'fbStudents', (select coalesce(sum(fb_students), 0) from rows),
    'makeup', (select coalesce(sum(makeup_total), 0) from rows),
    'trial', (select coalesce(sum(trial_total), 0) from rows),
    'noFbTeachers', (select count(*) from rows where sessions > 0 and fb_sessions = 0)
  ),
  'teachers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'nickname', nickname,
      'name', name,
      'isActive', is_active,
      'sessions', sessions,
      'checked', checked,
      'selfChecked', self_checked,
      'otherChecked', other_checked,
      'unknownChecked', unknown_checked,
      'fbSessions', fb_sessions,
      'photoSessions', photo_sessions,
      'attended', attended,
      'fbStudents', fb_students,
      'makeupTotal', makeup_total,
      'makeupChecked', makeup_checked,
      'trialTotal', trial_total,
      'trialChecked', trial_checked,
      'uncheckedList', unchecked_list,
      'otherCheckedList', other_checked_list,
      'noFbList', no_fb_list
    ) order by fb_sessions desc, self_checked desc, sessions desc, nickname)
    from rows
  ), '[]'::jsonb)
);
$function$;

comment on function public.get_teacher_monthly_report(date, uuid) is
  'Per-teacher monthly stats for /reports/teacher-monthly: sessions taught, attendance checked (split ครูเช็คเอง / คนอื่นเช็คให้ via attendance.checked_by → admin_users.auth_user_id → teacher_id), feedback sent, makeup/trial. Window ends at LEAST(month end, today Bangkok).';
