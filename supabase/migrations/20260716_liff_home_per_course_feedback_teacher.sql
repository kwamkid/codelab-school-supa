-- LIFF portal follow-ups:
-- 1) get_liff_home.next_classes: one upcoming session per ENROLLED COURSE
--    (distinct on student+class), not per student — a kid in 2 courses shows both.
-- 2) get_liff_feedback: add "teacherImage" (teachers.profile_image, falling back
--    to the linked login's Google avatar — same formula as get_daily_timetable).

create or replace function public.get_liff_home(p_line_user_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_parent parents%rowtype;
  v_student_ids uuid[];
  v_pending int;
  v_next jsonb;
  v_next_list jsonb;
  v_feedback jsonb;
  v_bkk_date date := (now() at time zone 'Asia/Bangkok')::date;
  v_bkk_time time := (now() at time zone 'Asia/Bangkok')::time;
begin
  select * into v_parent from parents where line_user_id = p_line_user_id limit 1;
  if v_parent.id is null then
    return jsonb_build_object('has_parent', false, 'parent_name', '',
      'pending_makeup_count', 0, 'next_class', null, 'next_classes', '[]'::jsonb,
      'latest_feedback', null);
  end if;

  select array_agg(id) into v_student_ids
  from students where parent_id = v_parent.id and is_active = true;

  if v_student_ids is null then
    return jsonb_build_object('has_parent', true,
      'parent_name', coalesce(v_parent.display_name, v_parent.line_display_name, ''),
      'pending_makeup_count', 0, 'next_class', null, 'next_classes', '[]'::jsonb,
      'latest_feedback', null);
  end if;

  select count(*) into v_pending
  from makeup_classes where student_id = any(v_student_ids) and status = 'pending';

  select coalesce(jsonb_agg(to_jsonb(q) order by q."sessionDate", q."startTime"), '[]'::jsonb)
  into v_next_list
  from (
    -- one row per (student, course): the next upcoming session of every
    -- enrollment, so a kid taking 2 courses shows 2 cards
    select distinct on (s.id, c.id)
           su.name as "subjectName", c.name as "className",
           cs.session_number as "sessionNumber", cs.session_date as "sessionDate",
           c.start_time as "startTime", c.end_time as "endTime",
           b.name as "branchName", coalesce(s.nickname, s.name) as "studentName"
    from enrollments e
    join students s on s.id = e.student_id
    join classes c on c.id = e.class_id
    join class_schedules cs on cs.class_id = c.id
    left join subjects su on su.id = c.subject_id
    left join branches b on b.id = c.branch_id
    where e.student_id = any(v_student_ids) and e.status = 'active'
      and cs.status <> 'cancelled'
      and (cs.session_date > v_bkk_date
           or (cs.session_date = v_bkk_date and c.end_time > v_bkk_time))
    order by s.id, c.id, cs.session_date asc, c.start_time asc
  ) q;

  v_next := case when jsonb_array_length(v_next_list) > 0 then v_next_list->0 else null end;

  select to_jsonb(t) into v_feedback from (
    select coalesce(s.nickname, s.name) as "studentName", c.name as "className",
           cs.session_number as "sessionNumber", cs.session_date as "sessionDate",
           a.feedback as feedback, coalesce(array_length(a.photos, 1), 0) as "photoCount"
    from attendance a
    join class_schedules cs on cs.id = a.schedule_id
    join classes c on c.id = cs.class_id
    join students s on s.id = a.student_id
    where a.student_id = any(v_student_ids)
      and ((a.feedback is not null and btrim(a.feedback) <> '')
           or coalesce(array_length(a.photos, 1), 0) > 0)
    order by cs.session_date desc
    limit 1
  ) t;

  return jsonb_build_object(
    'has_parent', true,
    'parent_name', coalesce(v_parent.display_name, v_parent.line_display_name, ''),
    'pending_makeup_count', coalesce(v_pending, 0),
    'next_class', v_next,
    'next_classes', v_next_list,
    'latest_feedback', v_feedback
  );
end;
$function$;

create or replace function public.get_liff_feedback(p_line_user_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_parent_id uuid;
  v_ids uuid[];
  v_students jsonb;
  v_feedbacks jsonb;
begin
  select id into v_parent_id from parents where line_user_id = p_line_user_id limit 1;
  if v_parent_id is null then
    return jsonb_build_object('students','[]'::jsonb,'feedbacks','[]'::jsonb);
  end if;

  select array_agg(id) into v_ids from students where parent_id = v_parent_id and is_active = true;
  if v_ids is null then
    return jsonb_build_object('students','[]'::jsonb,'feedbacks','[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'nickname',nickname,'is_active',true)),'[]'::jsonb)
    into v_students from students where id = any(v_ids);

  select coalesce(jsonb_agg(to_jsonb(x) order by x."sessionDate" desc), '[]'::jsonb) into v_feedbacks from (
    select a.id,
      a.student_id as "studentId",
      coalesce(s.nickname, s.name) as "studentName",
      c.name as "className",
      coalesce(su.name, '') as "subjectName",
      cs.session_number as "sessionNumber",
      cs.session_date as "sessionDate",
      coalesce(a.feedback, '') as feedback,
      coalesce(a.photos, '{}') as photos,
      coalesce(t.nickname, t.name, '') as "teacherName",
      -- teacher photo; fall back to the linked login's Google avatar
      coalesce(
        nullif(t.profile_image, ''),
        (select u.raw_user_meta_data->>'avatar_url'
           from admin_users au join auth.users u on lower(u.email) = lower(au.email)
          where au.teacher_id = t.id
            and coalesce(u.raw_user_meta_data->>'avatar_url','') <> ''
          limit 1)
      ) as "teacherImage"
    from attendance a
    join class_schedules cs on cs.id = a.schedule_id
    join classes c on c.id = cs.class_id
    join students s on s.id = a.student_id
    left join subjects su on su.id = c.subject_id
    left join teachers t on t.id = coalesce(cs.actual_teacher_id, c.teacher_id)
    where a.student_id = any(v_ids)
      and ((a.feedback is not null and btrim(a.feedback) <> '') or coalesce(array_length(a.photos,1),0) > 0)
  ) x;

  return jsonb_build_object('students', v_students, 'feedbacks', v_feedbacks);
end;
$function$;
