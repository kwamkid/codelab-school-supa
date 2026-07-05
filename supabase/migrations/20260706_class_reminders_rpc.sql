-- get_class_reminders(p_date): returns one row per (student × schedule) that should
-- receive a class reminder for p_date, with all data needed to build the LINE message.
-- Filters applied in SQL (single round-trip instead of nested per-schedule queries):
--   * class status = 'started' and schedule status = 'scheduled'
--   * class NOT inside its whole-class pause window (pause_from..pause_to inclusive)
--   * student NOT on leave for this exact session:
--       - no makeup_classes row on original_schedule_id (status pending|scheduled)
--       - no attendance row on schedule_id (status absent|leave|sick)
--   * parent has a linked LINE user id
create or replace function public.get_class_reminders(p_date date)
returns table (
  schedule_id uuid,
  session_date date,
  session_number integer,
  class_id uuid,
  class_name varchar,
  start_time time,
  end_time time,
  subject_name varchar,
  teacher_name varchar,
  teacher_nickname varchar,
  branch_name varchar,
  room_name varchar,
  student_id uuid,
  student_name varchar,
  student_nickname varchar,
  parent_id uuid,
  line_user_id varchar
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id            as schedule_id,
    s.session_date,
    s.session_number,
    c.id            as class_id,
    c.name          as class_name,
    c.start_time,
    c.end_time,
    subj.name       as subject_name,
    t.name          as teacher_name,
    t.nickname      as teacher_nickname,
    b.name          as branch_name,
    r.name          as room_name,
    st.id           as student_id,
    st.name         as student_name,
    st.nickname     as student_nickname,
    p.id            as parent_id,
    p.line_user_id
  from class_schedules s
  join classes c      on c.id = s.class_id
  join enrollments e  on e.class_id = c.id and e.status = 'active'
  join students st    on st.id = e.student_id
  join parents p      on p.id = st.parent_id
  left join subjects subj on subj.id = c.subject_id
  left join teachers t    on t.id = coalesce(s.actual_teacher_id, c.teacher_id)
  left join branches b    on b.id = c.branch_id
  left join rooms r       on r.id = coalesce(s.actual_room_id, c.room_id)
  where s.session_date = p_date
    and s.status = 'scheduled'
    and c.status = 'started'
    and not (
      c.pause_from is not null
      and p_date >= c.pause_from
      and (c.pause_to is null or p_date <= c.pause_to)
    )
    and not exists (
      select 1 from makeup_classes mc
      where mc.original_schedule_id = s.id
        and mc.student_id = st.id
        and mc.status in ('pending', 'scheduled')
    )
    and not exists (
      select 1 from attendance a
      where a.schedule_id = s.id
        and a.student_id = st.id
        and a.status in ('absent', 'leave', 'sick')
    )
    and p.line_user_id is not null
  order by c.name, st.name;
$$;
