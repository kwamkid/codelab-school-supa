-- Dashboard birthday alert: students whose birthday (next p_days days, Bangkok
-- time) falls within ±2 days of one of THEIR upcoming class sessions — i.e.
-- the kid will be in class around their birthday, so staff can celebrate.
-- Year-wrap safe (Dec→Jan) and Feb-29 safe (interval math clamps to Feb 28).

create or replace function public.get_upcoming_birthdays(p_branch_id uuid default null, p_days int default 14)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
with today as (
  select (now() at time zone 'Asia/Bangkok')::date as d
),
st as (
  -- active students with an active enrollment (branch-scoped via the class)
  select distinct s.id, coalesce(nullif(s.nickname, ''), s.name) as display,
         s.name as full_name, s.birthdate
  from public.students s
  join public.enrollments e on e.student_id = s.id and e.status = 'active'
  join public.classes c on c.id = e.class_id and c.status not in ('draft','cancelled')
  where s.is_active = true and s.birthdate is not null
    and (p_branch_id is null or c.branch_id = p_branch_id)
),
bd as (
  -- next occurrence of each student's birthday (>= today)
  select st.*,
    case
      when (st.birthdate + make_interval(years => (date_part('year', t.d) - date_part('year', st.birthdate))::int))::date >= t.d
      then (st.birthdate + make_interval(years => (date_part('year', t.d) - date_part('year', st.birthdate))::int))::date
      else (st.birthdate + make_interval(years => (date_part('year', t.d) - date_part('year', st.birthdate))::int + 1))::date
    end as bday
  from st, today t
),
up as (
  select bd.*, (date_part('year', bd.bday) - date_part('year', bd.birthdate))::int as turning
  from bd, today t
  where bd.bday between t.d and t.d + p_days
),
sess as (
  -- the student's own upcoming sessions within ±2 days of the birthday
  select u.id as student_id,
         jsonb_agg(jsonb_build_object(
           'subjectName', coalesce(su.name, c.name),
           'subjectColor', su.color,
           'sessionDate', cs.session_date,
           'startTime', c.start_time,
           'endTime', c.end_time,
           'branchName', b.name
         ) order by cs.session_date) as sessions
  from up u
  join public.enrollments e on e.student_id = u.id and e.status = 'active'
  join public.classes c on c.id = e.class_id and c.status not in ('draft','cancelled')
  left join public.subjects su on su.id = c.subject_id
  left join public.branches b on b.id = c.branch_id
  join public.class_schedules cs on cs.class_id = c.id and cs.status <> 'cancelled'
  cross join today t
  where (p_branch_id is null or c.branch_id = p_branch_id)
    and cs.session_date between u.bday - 2 and u.bday + 2
    and cs.session_date >= t.d
  group by u.id
)
select coalesce(jsonb_agg(jsonb_build_object(
  'studentName', u.display,
  'fullName', u.full_name,
  'birthday', u.bday,
  'turning', u.turning,
  'sessions', s.sessions
) order by u.bday, u.display), '[]'::jsonb)
from up u
join sess s on s.student_id = u.id;
$function$;

grant execute on function public.get_upcoming_birthdays(uuid, int) to authenticated;
