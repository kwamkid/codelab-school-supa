-- ติดตามลูกค้า (/followups) — one follow-up log for 3 sales/retention lists:
--   trial   = attended a trial, family hasn't enrolled since     (ref = trial_sessions.id)
--   at_risk = active student with ≥N consecutive checked misses  (ref = enrollments.id)
--   ending  = active student whose class ends soon, not renewed  (ref = enrollments.id)
--
-- A follow-up belongs to an EPISODE so stale calls don't hide new work:
--   trial   → episode = the trial session id (one episode per trial)
--   at_risk → episode = streak start date (kid came back then stopped again = new episode)
--   ending  → episode = the class end date
-- status: (no row for the episode) = ยังไม่ติดต่อ | contacted = ติดต่อแล้ว (+reason) | no_answer = ติดต่อไม่ได้
--
-- Replaces the short-lived student_followups table (never had rows).

drop function if exists public.get_at_risk_students(uuid[], int);
drop table if exists public.student_followups;

create table if not exists public.customer_followups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('trial', 'at_risk', 'ending')),
  ref_id uuid not null,
  episode text not null,
  branch_id uuid references public.branches(id) on delete set null,
  status text not null check (status in ('contacted', 'no_answer')),
  reason text,
  note text,
  created_by uuid references public.admin_users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_followups_ref on public.customer_followups (kind, ref_id, created_at desc);
alter table public.customer_followups enable row level security;
-- no policies: service role only (/api/admin/followups)

-- latest follow-up of one episode + full history of the ref, as jsonb
create or replace function public.followup_json(p_kind text, p_ref uuid, p_episode text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'followup', (
      select jsonb_build_object('status', f.status, 'reason', f.reason, 'note', f.note, 'by', f.created_by_name, 'at', f.created_at)
      from customer_followups f
      where f.kind = p_kind and f.ref_id = p_ref and f.episode = p_episode
      order by f.created_at desc limit 1
    ),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', f.status, 'reason', f.reason, 'note', f.note,
                                          'by', f.created_by_name, 'at', f.created_at, 'episode', f.episode)
                       order by f.created_at desc)
      from customer_followups f where f.kind = p_kind and f.ref_id = p_ref
    ), '[]'::jsonb)
  )
$$;
revoke execute on function public.followup_json(text, uuid, text) from public, anon, authenticated;
grant execute on function public.followup_json(text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 1) trial: same rule as before (+ follow-up status)
create or replace function public.get_trial_followups(
  p_branch_ids uuid[] default null,
  p_days int default 120
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with today as (select (now() at time zone 'Asia/Bangkok')::date as d),
fam as (
  select regexp_replace(p.phone, '\D', '', 'g') as ph,
         (e.enrolled_at at time zone 'Asia/Bangkok')::date as d
  from enrollments e join parents p on p.id = e.parent_id
  where e.status <> 'dropped' and coalesce(p.phone, '') <> ''
),
candidates as (
  select ts.*, tb.parent_name, tb.parent_phone, tb.contact_note, tb.source,
         regexp_replace(tb.parent_phone, '\D', '', 'g') as ph,
         lower(trim(ts.student_name)) as child_key
  from trial_sessions ts
  join trial_bookings tb on tb.id = ts.booking_id, today
  where ts.status = 'attended'
    and not coalesce(ts.converted, false)
    and tb.status not in ('cancelled', 'converted')
    and (p_branch_ids is null or ts.branch_id = any (p_branch_ids))
    and ts.scheduled_date >= today.d - coalesce(p_days, 120)
),
open_trials as (
  select c.* from candidates c
  where not exists (select 1 from fam f where f.ph = c.ph and f.d >= c.scheduled_date)
),
t as (
  select distinct on (booking_id, child_key) o.*,
         count(*) over (partition by booking_id, child_key) as trial_count
  from open_trials o
  order by booking_id, child_key, scheduled_date desc
)
select coalesce(jsonb_agg(jsonb_build_object(
  'sessionId', t.id,
  'bookingId', t.booking_id,
  'parentName', t.parent_name,
  'parentPhone', t.parent_phone,
  'studentName', t.student_name,
  'subject', trim(s.name),
  'branchId', t.branch_id,
  'branchName', b.name,
  'teacher', coalesce(te.nickname, te.name),
  'trialDate', to_char(t.scheduled_date, 'YYYY-MM-DD'),
  'trialCount', t.trial_count,
  'daysAgo', (select d from today) - t.scheduled_date,
  'interestedLevel', t.interested_level,
  'feedback', nullif(trim(coalesce(t.feedback, '')), ''),
  'contactNote', nullif(trim(coalesce(t.contact_note, '')), ''),
  'source', t.source,
  'existingCustomer', exists (select 1 from fam f where f.ph = t.ph and f.d < t.scheduled_date),
  'episode', t.id::text
) || public.followup_json('trial', t.id, t.id::text)
order by t.scheduled_date desc), '[]'::jsonb)
from t
join subjects s on s.id = t.subject_id
join branches b on b.id = t.branch_id
left join teachers te on te.id = t.teacher_id;
$function$;

-- ---------------------------------------------------------------------------
-- 2) at_risk
create or replace function public.get_at_risk_students(
  p_branch_ids uuid[] default null,
  p_min_streak int default 2
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with today as (select (now() at time zone 'Asia/Bangkok')::date as d),
hist as (
  select e.id as enrollment_id, e.student_id, e.parent_id, e.branch_id, e.class_id,
         cs.session_date, a.status::text as st,
         row_number() over (partition by e.id order by cs.session_date desc) as rn
  from enrollments e
  join classes c on c.id = e.class_id and c.status = 'started'
  join class_schedules cs on cs.class_id = c.id and cs.status <> 'cancelled'
  join attendance a on a.schedule_id = cs.id and a.student_id = e.student_id, today
  where e.status = 'active'
    and cs.session_date <= today.d
    and (p_branch_ids is null or e.branch_id = any (p_branch_ids))
),
streaks as (
  select enrollment_id, student_id, parent_id, branch_id, class_id,
         coalesce(min(rn) filter (where st in ('present', 'late')) - 1, count(*)) as streak,
         max(session_date) filter (where st in ('present', 'late')) as last_present,
         max(session_date) as last_checked
  from hist group by 1, 2, 3, 4, 5
),
risk as (
  select s.*,
         (select min(h.session_date) from hist h where h.enrollment_id = s.enrollment_id and h.rn <= s.streak) as streak_start,
         (select count(*) from hist h where h.enrollment_id = s.enrollment_id and h.rn <= s.streak and h.st = 'absent') as absent_n,
         (select count(*) from hist h where h.enrollment_id = s.enrollment_id and h.rn <= s.streak and h.st <> 'absent') as excused_n
  from streaks s
  where s.streak >= greatest(coalesce(p_min_streak, 2), 1)
)
select coalesce(jsonb_agg(jsonb_build_object(
  'enrollmentId', r.enrollment_id,
  'studentId', r.student_id,
  'branchId', r.branch_id,
  'branchName', b.name,
  'studentName', st.name,
  'studentNickname', st.nickname,
  'parentName', coalesce(nullif(pa.display_name, ''), pa.line_display_name),
  'parentPhone', pa.phone,
  'classId', r.class_id,
  'classCode', c.name,
  'subject', trim(su.name),
  'teacher', coalesce(t.nickname, t.name),
  'streak', r.streak,
  'absent', r.absent_n,
  'excused', r.excused_n,
  'lastPresent', to_char(r.last_present, 'YYYY-MM-DD'),
  'lastChecked', to_char(r.last_checked, 'YYYY-MM-DD'),
  'episode', to_char(r.streak_start, 'YYYY-MM-DD')
) || public.followup_json('at_risk', r.enrollment_id, to_char(r.streak_start, 'YYYY-MM-DD'))
order by r.streak desc, r.last_checked desc), '[]'::jsonb)
from risk r
join students st on st.id = r.student_id
left join parents pa on pa.id = r.parent_id
join classes c on c.id = r.class_id
left join subjects su on su.id = c.subject_id
left join teachers t on t.id = c.teacher_id
join branches b on b.id = r.branch_id;
$function$;

-- ---------------------------------------------------------------------------
-- 3) ending: active enrollment in a started class ending within p_days.
--    renewed = the student already has another non-dropped enrollment in a class
--    that starts on/after this class's start and isn't completed/cancelled.
create or replace function public.get_ending_students(
  p_branch_ids uuid[] default null,
  p_days int default 30
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with today as (select (now() at time zone 'Asia/Bangkok')::date as d),
e as (
  select en.id as enrollment_id, en.student_id, en.parent_id, en.branch_id, c.id as class_id,
         c.name as class_code, c.start_date, c.end_date, c.subject_id, c.teacher_id
  from enrollments en
  join classes c on c.id = en.class_id and c.status = 'started', today
  where en.status = 'active'
    and c.end_date between today.d and today.d + coalesce(p_days, 30)
    and (p_branch_ids is null or en.branch_id = any (p_branch_ids))
),
x as (
  select e.*,
         (select count(*) from class_schedules cs, today
          where cs.class_id = e.class_id and cs.status <> 'cancelled' and cs.session_date >= today.d) as sessions_left,
         (select jsonb_build_object('subject', trim(s2.name), 'startDate', to_char(c2.start_date, 'YYYY-MM-DD'))
          from enrollments en2
          join classes c2 on c2.id = en2.class_id
          left join subjects s2 on s2.id = c2.subject_id
          where en2.student_id = e.student_id and en2.status <> 'dropped' and c2.id <> e.class_id
            and c2.status not in ('completed', 'cancelled') and c2.start_date >= e.start_date
          order by c2.start_date limit 1) as renewed_to
  from e
)
select coalesce(jsonb_agg(jsonb_build_object(
  'enrollmentId', x.enrollment_id,
  'studentId', x.student_id,
  'branchId', x.branch_id,
  'branchName', b.name,
  'studentName', st.name,
  'studentNickname', st.nickname,
  'parentName', coalesce(nullif(pa.display_name, ''), pa.line_display_name),
  'parentPhone', pa.phone,
  'classId', x.class_id,
  'classCode', x.class_code,
  'subject', trim(su.name),
  'teacher', coalesce(t.nickname, t.name),
  'endDate', to_char(x.end_date, 'YYYY-MM-DD'),
  'daysLeft', x.end_date - (select d from today),
  'sessionsLeft', x.sessions_left,
  'renewedTo', x.renewed_to,
  'episode', to_char(x.end_date, 'YYYY-MM-DD')
) || public.followup_json('ending', x.enrollment_id, to_char(x.end_date, 'YYYY-MM-DD'))
order by x.end_date, st.nickname), '[]'::jsonb)
from x
join students st on st.id = x.student_id
left join parents pa on pa.id = x.parent_id
left join subjects su on su.id = x.subject_id
left join teachers t on t.id = x.teacher_id
join branches b on b.id = x.branch_id;
$function$;

revoke execute on function public.get_trial_followups(uuid[], int) from public, anon, authenticated;
revoke execute on function public.get_at_risk_students(uuid[], int) from public, anon, authenticated;
revoke execute on function public.get_ending_students(uuid[], int) from public, anon, authenticated;
grant execute on function public.get_trial_followups(uuid[], int) to service_role;
grant execute on function public.get_at_risk_students(uuid[], int) to service_role;
grant execute on function public.get_ending_students(uuid[], int) to service_role;
