-- LIFF portal visual consistency:
-- 1) get_liff_home: subjectColor on next_classes + latest_feedback (home cards
--    show the subject color dot like the schedule tab, instead of generic icons)
-- 2) get_liff_feedback: subjectColor per feedback card
-- 3) get_liff_schedule: teacherImage on sessions + makeups (schedule tab shows
--    the teacher's photo; same fallback-to-Google-avatar formula as elsewhere)

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
    select distinct on (s.id, c.id)
           su.name as "subjectName", su.color as "subjectColor", c.name as "className",
           cs.session_number as "sessionNumber", c.total_sessions as "totalSessions",
           cs.session_date as "sessionDate",
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
           coalesce(su.name, '') as "subjectName", su.color as "subjectColor",
           cs.session_number as "sessionNumber", cs.session_date as "sessionDate",
           a.feedback as feedback, coalesce(array_length(a.photos, 1), 0) as "photoCount"
    from attendance a
    join class_schedules cs on cs.id = a.schedule_id
    join classes c on c.id = cs.class_id
    join students s on s.id = a.student_id
    left join subjects su on su.id = c.subject_id
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
      su.color as "subjectColor",
      cs.session_number as "sessionNumber",
      cs.session_date as "sessionDate",
      coalesce(a.feedback, '') as feedback,
      coalesce(a.photos, '{}') as photos,
      coalesce(t.nickname, t.name, '') as "teacherName",
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

create or replace function public.get_liff_schedule(p_line_user_id text, p_start date, p_end date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_parent_id uuid;
  v_student_ids uuid[];
  v_students jsonb;
  v_sessions jsonb;
  v_makeups jsonb;
  v_stats jsonb;
  v_empty jsonb := jsonb_build_object('students','[]'::jsonb,'sessions','[]'::jsonb,'makeups','[]'::jsonb,'stats','[]'::jsonb);
begin
  select id into v_parent_id from parents where line_user_id = p_line_user_id limit 1;
  if v_parent_id is null then return v_empty; end if;

  select array_agg(id) into v_student_ids from students where parent_id = v_parent_id and is_active = true;
  if v_student_ids is null then return v_empty; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'nickname',nickname,'profileImage',profile_image)),'[]'::jsonb)
    into v_students from students where id = any(v_student_ids);

  -- class sessions within the date range
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_sessions from (
    select
      e.student_id as "studentId",
      s.name as "studentName", s.nickname as "studentNickname",
      c.id as "classId", c.name as "className",
      su.name as "subjectName", su.color as "subjectColor",
      coalesce(t.nickname, t.name) as "teacherName",
      coalesce(
        nullif(t.profile_image, ''),
        (select u.raw_user_meta_data->>'avatar_url'
           from admin_users au join auth.users u on lower(u.email) = lower(au.email)
          where au.teacher_id = t.id
            and coalesce(u.raw_user_meta_data->>'avatar_url','') <> ''
          limit 1)
      ) as "teacherImage",
      b.name as "branchName", r.name as "roomName",
      c.start_time as "startTime", c.end_time as "endTime",
      cs.id as "scheduleId", cs.session_number as "sessionNumber",
      cs.session_date as "sessionDate", cs.status as "scheduleStatus",
      att.status as "attendanceStatus",
      (mk.id is not null) as "hasMakeup",
      mk.status as "makeupStatus", mk.makeup_date as "makeupDate",
      mk.makeup_start_time as "makeupStartTime", mk.makeup_end_time as "makeupEndTime"
    from enrollments e
    join students s on s.id = e.student_id
    join classes c on c.id = e.class_id
    join class_schedules cs on cs.class_id = c.id
    left join subjects su on su.id = c.subject_id
    left join teachers t on t.id = c.teacher_id
    left join branches b on b.id = c.branch_id
    left join rooms r on r.id = c.room_id
    left join attendance att on att.schedule_id = cs.id and att.student_id = e.student_id
    left join makeup_classes mk on mk.original_class_id = c.id and mk.original_schedule_id = cs.id
         and mk.student_id = e.student_id and mk.status <> 'cancelled'
    where e.student_id = any(v_student_ids) and e.status = 'active'
      and c.status not in ('draft','cancelled')
      and cs.session_date >= p_start and cs.session_date <= p_end
      and cs.status <> 'cancelled'
  ) x;

  -- scheduled makeups (with a date) within the range
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_makeups from (
    select m.id, m.student_id as "studentId",
      s.name as "studentName", s.nickname as "studentNickname",
      m.original_class_id as "classId", m.original_session_number as "sessionNumber",
      oc.name as "className", su.name as "subjectName", su.color as "subjectColor",
      m.status,
      m.makeup_date as "makeupDate", m.makeup_start_time as "startTime", m.makeup_end_time as "endTime",
      coalesce(mt.nickname, mt.name) as "teacherName",
      coalesce(
        nullif(mt.profile_image, ''),
        (select u.raw_user_meta_data->>'avatar_url'
           from admin_users au join auth.users u on lower(u.email) = lower(au.email)
          where au.teacher_id = mt.id
            and coalesce(u.raw_user_meta_data->>'avatar_url','') <> ''
          limit 1)
      ) as "teacherImage",
      mb.name as "branchName", mr.name as "roomName"
    from makeup_classes m
    join students s on s.id = m.student_id
    left join classes oc on oc.id = m.original_class_id
    left join subjects su on su.id = oc.subject_id
    left join teachers mt on mt.id = m.makeup_teacher_id
    left join branches mb on mb.id = m.makeup_branch_id
    left join rooms mr on mr.id = m.makeup_room_id
    where m.student_id = any(v_student_ids) and m.status <> 'cancelled'
      and m.makeup_date is not null
      and m.makeup_date >= p_start and m.makeup_date <= p_end
  ) x;

  -- overall stats per student (all sessions, not range-limited)
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_stats from (
    select sid as "studentId",
      coalesce(sc.total,0) as "totalClasses",
      coalesce(sc.completed,0) as "completedClasses",
      coalesce(sc.upcoming,0) as "upcomingClasses",
      coalesce(mc.cnt,0) as "makeupClasses"
    from unnest(v_student_ids) as sid
    left join lateral (
      select count(*) as total,
        count(*) filter (where cs.session_date < current_date or cs.status = 'completed') as completed,
        count(*) filter (where not (cs.session_date < current_date or cs.status = 'completed')) as upcoming
      from enrollments e
      join classes c on c.id = e.class_id
      join class_schedules cs on cs.class_id = c.id
      where e.student_id = sid and e.status = 'active'
        and c.status not in ('draft','cancelled') and cs.status <> 'cancelled'
    ) sc on true
    left join lateral (
      select count(*) as cnt from makeup_classes
      where student_id = sid and status in ('scheduled','completed')
    ) mc on true
  ) x;

  return jsonb_build_object('students',v_students,'sessions',v_sessions,'makeups',v_makeups,'stats',v_stats);
end;
$function$;
