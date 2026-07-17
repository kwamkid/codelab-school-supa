-- One-round-trip aggregate for the VEX Team report (was 7 sequential PostgREST
-- queries). Joins vex.teams/kids → students → enrollments → classes → subjects
-- and returns the whole report as jsonb. Ages use Bangkok wall-clock date.

create or replace function public.get_vex_team_report(p_branch_id uuid default null)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
with t as (
  select id, level, branch_id
  from vex.teams
  where p_branch_id is null or branch_id = p_branch_id
),
k as (
  select vk.id, vk.team_id, vk.student_id, t.level, t.branch_id
  from vex.kids vk
  join t on t.id = vk.team_id
),
s as (
  select st.id as student_id,
         coalesce(nullif(st.nickname, ''), st.name) as display,
         st.birthdate,
         coalesce(nullif(btrim(st.school_name), ''), 'ไม่ระบุ') as school,
         date_part('year', age((now() at time zone 'Asia/Bangkok')::date, st.birthdate))::int as years
  from (select distinct student_id from k where student_id is not null) dk
  join public.students st on st.id = dk.student_id
)
select jsonb_build_object(
  'totalTeams', (select count(*) from t),
  'totalKids',  (select count(*) from k),
  'byLevel', coalesce((
    select jsonb_agg(jsonb_build_object('level', level, 'teams', teams, 'kids', kids))
    from (
      select t.level, count(distinct t.id) as teams, count(k.id) as kids
      from t left join k on k.team_id = t.id
      group by t.level
    ) q
  ), '[]'::jsonb),
  'byBranch', coalesce((
    select jsonb_agg(jsonb_build_object('branch', branch, 'teams', teams, 'kids', kids) order by kids desc)
    from (
      select coalesce(b.name, 'ไม่ระบุสาขา') as branch,
             count(distinct t.id) as teams, count(k.id) as kids
      from t
      left join public.branches b on b.id = t.branch_id
      left join k on k.team_id = t.id
      group by coalesce(b.name, 'ไม่ระบุสาขา')
    ) q
  ), '[]'::jsonb),
  'schools', coalesce((
    select jsonb_agg(jsonb_build_object('school', school, 'count', cnt, 'names', names) order by cnt desc)
    from (
      select school, count(*) as cnt, jsonb_agg(display order by display) as names
      from s group by school
    ) q
  ), '[]'::jsonb),
  'ages', coalesce((
    select jsonb_agg(jsonb_build_object('age', years, 'count', cnt, 'names', names) order by years)
    from (
      select years, count(*) as cnt, jsonb_agg(display order by display) as names
      from s
      where birthdate is not null and years between 0 and 29
      group by years
    ) q
  ), '[]'::jsonb),
  'courses', coalesce((
    select jsonb_agg(jsonb_build_object('name', name, 'color', color, 'students', students, 'names', names) order by students desc)
    from (
      -- "ever taken" = any enrollment row, any status (the enum has no
      -- 'cancelled'); distinct per student per subject
      select su.name, su.color,
             count(distinct s.student_id) as students,
             jsonb_agg(distinct s.display) as names
      from s
      join public.enrollments e on e.student_id = s.student_id
      join public.classes c on c.id = e.class_id
      join public.subjects su on su.id = c.subject_id
      group by su.id, su.name, su.color
    ) q
  ), '[]'::jsonb)
);
$function$;
