-- get_teacher_daily_digest v2 — รวมเรียนชดเชย (makeup) และทดลองเรียน (trial)
-- ให้ตรงกับหน้า /teacher (RPC get_teacher_daily_schedule) ที่แสดงครบ 3 ประเภทอยู่แล้ว
-- เดิม digest ที่ส่งเข้า LINE มีแต่คลาสปกติ ครูจึงไม่รู้ว่าพรุ่งนี้มีชดเชย/ทดลองเรียน
--
-- ครูของแต่ละประเภท: คลาส = actual_teacher_id ของคาบ (ครูสอนแทน) → teacher_id ของคลาส,
-- ชดเชย = makeup_teacher_id, ทดลองเรียน = trial_sessions.teacher_id
-- นับเฉพาะที่ยัง 'scheduled' (พรุ่งนี้ยังไม่เกิดขึ้น)
create or replace function get_teacher_daily_digest(p_date date)
returns jsonb
language sql
stable
as $$
  with sched as (
    select
      s.id as schedule_id,
      coalesce(s.actual_teacher_id, c.teacher_id) as teacher_id,
      c.id as class_id,
      c.name as class_name,
      c.start_time,
      c.end_time,
      s.session_number,
      c.total_sessions,
      subj.name as subject_name,
      b.name as branch_name,
      r.name as room_name
    from class_schedules s
    join classes c on c.id = s.class_id
    left join subjects subj on subj.id = c.subject_id
    left join branches b on b.id = c.branch_id
    left join rooms r on r.id = coalesce(s.actual_room_id, c.room_id)
    where s.session_date = p_date
      and s.status = 'scheduled'
      and c.status = 'started'
      and not (
        c.pause_from is not null
        and p_date >= c.pause_from
        and (c.pause_to is null or p_date <= c.pause_to)
      )
  ),
  enrolled as (
    select sch.schedule_id, count(*)::int as total
    from sched sch
    join enrollments e on e.class_id = sch.class_id and e.status = 'active'
    group by sch.schedule_id
  ),
  leaves as (
    select
      mc.original_schedule_id as schedule_id,
      jsonb_agg(coalesce(st.nickname, st.name) order by coalesce(st.nickname, st.name)) as names
    from makeup_classes mc
    join students st on st.id = mc.student_id
    where mc.status in ('pending', 'scheduled')
      and mc.original_schedule_id in (select schedule_id from sched)
    group by mc.original_schedule_id
  ),
  class_items as (
    select
      sch.teacher_id,
      'class'::text as type,
      sch.start_time,
      sch.end_time,
      sch.class_name,
      sch.subject_name,
      sch.session_number,
      sch.total_sessions,
      sch.branch_name,
      sch.room_name,
      coalesce(en.total, 0) as student_count,
      coalesce(lv.names, '[]'::jsonb) as leave_names,
      null::text as student_name
    from sched sch
    left join enrolled en on en.schedule_id = sch.schedule_id
    left join leaves lv on lv.schedule_id = sch.schedule_id
  ),
  makeup_items as (
    select
      mc.makeup_teacher_id as teacher_id,
      'makeup'::text as type,
      mc.makeup_start_time as start_time,
      mc.makeup_end_time as end_time,
      coalesce(oc.name, 'เรียนชดเชย')::text as class_name,
      coalesce(subj.name, 'เรียนชดเชย')::text as subject_name,
      ocs.session_number,
      oc.total_sessions,
      b.name as branch_name,
      r.name as room_name,
      1 as student_count,
      '[]'::jsonb as leave_names,
      coalesce(st.nickname, st.name)::text as student_name
    from makeup_classes mc
    left join classes oc on oc.id = mc.original_class_id
    left join subjects subj on subj.id = oc.subject_id
    left join class_schedules ocs on ocs.id = mc.original_schedule_id
    left join branches b on b.id = mc.makeup_branch_id
    left join rooms r on r.id = mc.makeup_room_id
    left join students st on st.id = mc.student_id
    where mc.makeup_date = p_date
      and mc.status = 'scheduled'
      and mc.makeup_teacher_id is not null
  ),
  trial_items as (
    select
      ts.teacher_id,
      'trial'::text as type,
      ts.start_time,
      ts.end_time,
      'ทดลองเรียน'::text as class_name,
      coalesce(subj.name, 'ทดลองเรียน')::text as subject_name,
      null::int as session_number,
      null::int as total_sessions,
      b.name as branch_name,
      coalesce(r.name, ts.room_name) as room_name,
      1 as student_count,
      '[]'::jsonb as leave_names,
      ts.student_name::text as student_name
    from trial_sessions ts
    left join subjects subj on subj.id = ts.subject_id
    left join branches b on b.id = ts.branch_id
    left join rooms r on r.id = ts.room_id
    where ts.scheduled_date = p_date
      and ts.status = 'scheduled'
      and ts.teacher_id is not null
  ),
  -- ซ้อม VEX ของทีมที่ครูคนนั้นดูแล — รวมมาไว้ในข้อความเดียวกับตารางสอน
  -- (เดิมส่งแยกอีกข้อความจาก cron Part 6) หนึ่งรายการ = ทีม+ช่วงเวลา พร้อมชื่อเด็กทุกคน
  practice_items as (
    select
      vt.coach_teacher_id as teacher_id,
      'practice'::text as type,
      p.start_time,
      p.end_time,
      ('ทีม ' || vt.team_number)::text as class_name,
      'ซ้อม VEX'::text as subject_name,
      null::int as session_number,
      null::int as total_sessions,
      b.name as branch_name,
      null::text as room_name,
      count(*)::int as student_count,
      '[]'::jsonb as leave_names,
      string_agg(coalesce(k.nickname, ''), ', ' order by k.nickname)::text as student_name
    from vex.practices p
    join vex.teams vt on vt.id = p.team_id
    left join vex.kids k on k.id = p.kid_id
    left join branches b on b.id = vt.branch_id
    where p.practice_date = p_date
      and p.status = 'approved'
      and vt.coach_teacher_id is not null
    group by vt.coach_teacher_id, p.start_time, p.end_time, vt.team_number, b.name
  ),
  all_items as (
    select * from class_items
    union all select * from makeup_items
    union all select * from trial_items
    union all select * from practice_items
  )
  select coalesce(jsonb_agg(row_to_json(d)::jsonb order by d.teacher_name), '[]'::jsonb)
  from (
    select
      t.id as teacher_id,
      coalesce(t.nickname, t.name) as teacher_name,
      t.line_user_id,
      jsonb_agg(
        jsonb_build_object(
          'type', i.type,
          'startTime', i.start_time,
          'endTime', i.end_time,
          'className', i.class_name,
          'subjectName', i.subject_name,
          'sessionNumber', i.session_number,
          'totalSessions', i.total_sessions,
          'branchName', i.branch_name,
          'roomName', i.room_name,
          'studentCount', i.student_count,
          'leaveNames', i.leave_names,
          'studentName', i.student_name
        )
        order by i.start_time
      ) as classes
    from all_items i
    join teachers t on t.id = i.teacher_id
    where t.is_active = true
      and t.line_user_id ~ '^U[0-9a-f]{32}$'
    group by t.id, t.nickname, t.name, t.line_user_id
  ) d;
$$;

comment on function get_teacher_daily_digest(date) is
  'ตารางสอนรายวันของครูที่ผูก LINE แล้ว: คลาสปกติ (+ รายชื่อคนลา) + เรียนชดเชย + ทดลองเรียน';
