-- สรุปตารางสอนของครูสำหรับวันหนึ่ง ๆ (ใช้ส่ง LINE แจ้งครูล่วงหน้า 1 วัน).
-- คืนครูเฉพาะคนที่ "ส่งถึงได้จริง": ยังใช้งานอยู่ + ผูก LINE แล้ว
-- (teachers.line_user_id มีของเก่าที่คนกรอกเป็นอีเมล/LINE ID ปนอยู่ จึงกรองด้วย
--  รูปแบบ userId จริง U+32hex ตั้งแต่ใน SQL — ตรงกับ lib/line/line-user-id.ts)
--
-- กติกาเดียวกับ get_class_reminders: เฉพาะคาบ scheduled ของคลาส started,
-- ข้ามช่วงที่คลาสถูกพัก, ครูผู้สอน = actual_teacher_id ของคาบนั้นถ้ามี (ครูสอนแทน)
-- "ลา" = มี makeup_classes (pending/scheduled) ผูกกับคาบนั้น — ตัวเดียวกับที่
-- ระบบใช้ตัดผู้ปกครองออกจาก class reminder
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
  )
  select coalesce(jsonb_agg(row_to_json(d)::jsonb order by d.teacher_name), '[]'::jsonb)
  from (
    select
      t.id as teacher_id,
      coalesce(t.nickname, t.name) as teacher_name,
      t.line_user_id,
      jsonb_agg(
        jsonb_build_object(
          'startTime', sch.start_time,
          'endTime', sch.end_time,
          'className', sch.class_name,
          'subjectName', sch.subject_name,
          'sessionNumber', sch.session_number,
          'totalSessions', sch.total_sessions,
          'branchName', sch.branch_name,
          'roomName', sch.room_name,
          'studentCount', coalesce(en.total, 0),
          'leaveNames', coalesce(lv.names, '[]'::jsonb)
        )
        order by sch.start_time
      ) as classes
    from sched sch
    join teachers t on t.id = sch.teacher_id
    left join enrolled en on en.schedule_id = sch.schedule_id
    left join leaves lv on lv.schedule_id = sch.schedule_id
    where t.is_active = true
      and t.line_user_id ~ '^U[0-9a-f]{32}$'
    group by t.id, t.nickname, t.name, t.line_user_id
  ) d;
$$;

comment on function get_teacher_daily_digest(date) is
  'ตารางสอนรายวันของครูที่ผูก LINE แล้ว (+ รายชื่อนักเรียนที่ลาแต่ละคาบ) สำหรับ cron แจ้งเตือนครู';
