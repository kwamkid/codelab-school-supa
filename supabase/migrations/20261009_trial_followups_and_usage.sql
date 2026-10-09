-- 1) Trial follow-up list (tab "ควรโทรตาม" on /trial)
-- 2) Admin page-view log + usage summary (/reports/usage, super_admin)

-- ---------------------------------------------------------------------------
-- 1) Attended trials whose family has NOT enrolled since — same conversion rule
--    as get_business_dashboard: converted = ts.converted OR the booking's family
--    (digits-only phone trial_bookings.parent_phone = parents.phone) has a
--    non-dropped enrollment on/after the trial date (any course).
--    Bookings staff already closed (cancelled / converted) are excluded.
--    ONE row per child per booking (latest attended trial; trialCount = how many).
--    p_branch_ids null = all branches (the API passes the caller's branches for
--    branch admins — access control lives in /api/admin/trial/followups).
drop function if exists public.get_trial_followups(uuid, int);

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
  'existingCustomer', exists (select 1 from fam f where f.ph = t.ph and f.d < t.scheduled_date)
) order by t.scheduled_date desc), '[]'::jsonb)
from t
join subjects s on s.id = t.subject_id
join branches b on b.id = t.branch_id
left join teachers te on te.id = t.teacher_id;
$function$;

revoke execute on function public.get_trial_followups(uuid[], int) from public, anon, authenticated;
grant execute on function public.get_trial_followups(uuid[], int) to service_role;

comment on function public.get_trial_followups(uuid[], int) is
  'Attended trials (last p_days) whose family has not enrolled on/after the trial date (phone match), booking not cancelled/converted, one row per child per booking — the "ควรโทรตาม" tab on /trial.';

-- ---------------------------------------------------------------------------
-- 2) Page views of the admin app. One row per navigation (client dedupes
--    repeats of the same path within a short window). path is normalised
--    (uuid segments → [id]); menu_href = href of the matching sidebar item (the
--    stable grouping key), menu = its label at the time (display only — renaming
--    a menu doesn't split its stats).
create table if not exists public.admin_page_views (
  id bigserial primary key,
  admin_user_id uuid references public.admin_users(id) on delete set null,
  role text,
  path text not null,
  menu text,
  menu_href text,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_page_views_created_at on public.admin_page_views (created_at desc);
create index if not exists idx_admin_page_views_menu on public.admin_page_views (menu);
alter table public.admin_page_views add column if not exists menu_href text;
alter table public.admin_page_views enable row level security;
-- no policies: service role only (written by /api/admin/track-view)

create or replace function public.get_menu_usage(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with v as (
  select pv.*, coalesce(nullif(au.nickname, ''), au.display_name) as user_name
  from admin_page_views pv
  left join admin_users au on au.id = pv.admin_user_id
  where pv.created_at >= now() - make_interval(days => coalesce(p_days, 30))
),
menus as (
  select coalesce(menu_href, path) as menu_key,
         (array_agg(coalesce(menu, path) order by created_at desc))[1] as menu,
         count(*) as views,
         count(distinct admin_user_id) as users,
         count(distinct (created_at at time zone 'Asia/Bangkok')::date) as days_used,
         max(created_at) as last_at,
         count(*) filter (where role = 'super_admin') as by_super,
         count(*) filter (where role = 'branch_admin') as by_branch,
         count(*) filter (where role = 'teacher') as by_teacher
  from v group by 1
),
users as (
  select admin_user_id, max(user_name) as name, max(role) as role, count(*) as views,
         count(distinct coalesce(menu_href, path)) as menus, max(created_at) as last_at
  from v group by 1
),
tracking as (select min(created_at) as since from admin_page_views)
select jsonb_build_object(
  'since', (select since from tracking),
  'days', coalesce(p_days, 30),
  'totalViews', (select count(*) from v),
  'menus', coalesce((select jsonb_agg(jsonb_build_object(
      'key', menu_key, 'menu', menu, 'views', views, 'users', users, 'daysUsed', days_used, 'lastAt', last_at,
      'bySuper', by_super, 'byBranch', by_branch, 'byTeacher', by_teacher
    ) order by views desc) from menus), '[]'::jsonb),
  'users', coalesce((select jsonb_agg(jsonb_build_object(
      'id', admin_user_id, 'name', name, 'role', role, 'views', views, 'menus', menus, 'lastAt', last_at
    ) order by views desc) from users), '[]'::jsonb)
);
$function$;

revoke execute on function public.get_menu_usage(int) from public, anon, authenticated;
grant execute on function public.get_menu_usage(int) to service_role;

comment on function public.get_menu_usage(int) is
  'Admin menu usage for /reports/usage: per-menu views/users/days used and per-user activity over the last p_days, from admin_page_views.';
