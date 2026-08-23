-- get_liff_makeup: ส่งกลับด้วยว่าใครเป็นคนแจ้งลา + แจ้งผ่านช่องทางไหน
-- (พ่อกับแม่อยู่ครอบครัวเดียวกันแต่คนละ LINE — หน้า LIFF ต้องโชว์ว่าใครกด
--  และใช้ requestedVia='liff' แทนการเดาจาก requested_by ที่เป็น uuid)
CREATE OR REPLACE FUNCTION public.get_liff_makeup(p_line_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_parent_id uuid;
  v_ids uuid[];
  v_students jsonb;
  v_makeups jsonb;
  v_enrollments jsonb;
  v_absences jsonb;
  v_empty jsonb := jsonb_build_object('students','[]'::jsonb,'makeups','[]'::jsonb,'enrollments','[]'::jsonb,'absences','[]'::jsonb);
begin
  select id into v_parent_id from parents where line_user_id = p_line_user_id limit 1;
  if v_parent_id is null then return v_empty; end if;

  select array_agg(id) into v_ids from students where parent_id = v_parent_id and is_active = true;
  if v_ids is null then return v_empty; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'nickname',nickname)),'[]'::jsonb)
    into v_students from students where id = any(v_ids);

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_makeups from (
    select m.id, m.student_id as "studentId",
      m.original_class_id as "originalClassId", m.original_schedule_id as "originalScheduleId",
      m.original_session_number as "originalSessionNumber", m.original_session_date as "originalSessionDate",
      m.status, m.type, m.requested_by as "requestedBy", m.reason,
      m.requested_via as "requestedVia", m.requested_by_name as "requestedByName",
      m.requested_by_role as "requestedByRole",
      m.counts_toward_quota as "countsTowardQuota",
      case when m.makeup_date is not null
        then jsonb_build_object('date',m.makeup_date,'startTime',m.makeup_start_time,'endTime',m.makeup_end_time)
        else null end as "makeupSchedule",
      mb.name as "makeupBranchName", mr.name as "makeupRoomName",
      case when m.makeup_teacher_id is not null
        then jsonb_build_object('nickname',mt.nickname,'name',mt.name) else null end as "makeupTeacher",
      case when m.attendance_status is not null
        then jsonb_build_object('status',m.attendance_status) else null end as attendance
    from makeup_classes m
    left join branches mb on mb.id = m.makeup_branch_id
    left join rooms mr on mr.id = m.makeup_room_id
    left join teachers mt on mt.id = m.makeup_teacher_id
    where m.student_id = any(v_ids)
    order by m.original_session_date asc nulls last
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_enrollments from (
    select e.student_id as "studentId", e.class_id as "classId",
      c.name as "className", coalesce(su.name,'') as "subjectName", su.color as "subjectColor"
    from enrollments e
    join classes c on c.id = e.class_id
    left join subjects su on su.id = c.subject_id
    where e.student_id = any(v_ids) and e.status = 'active'
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object('studentId',t.student_id,'classId',t.class_id,'cnt',t.cnt)),'[]'::jsonb)
    into v_absences from (
    select a.student_id, cs.class_id, count(*) as cnt
    from attendance a
    join class_schedules cs on cs.id = a.schedule_id
    where a.student_id = any(v_ids) and a.status = 'absent'
      and not exists (
        select 1 from makeup_classes mk
        where mk.student_id = a.student_id and mk.original_schedule_id = a.schedule_id and mk.status <> 'cancelled'
      )
    group by a.student_id, cs.class_id
  ) t;

  return jsonb_build_object('students',v_students,'makeups',v_makeups,'enrollments',v_enrollments,'absences',v_absences);
end;
$function$
