-- Add total_sessions to get_daily_timetable so the dashboard can show
-- "(current/total)" sessions next to the subject name, e.g. (3/12).
CREATE OR REPLACE FUNCTION public.get_daily_timetable(p_date date, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH
  class_events AS (
    SELECT
      cs.id::text AS schedule_id,
      c.id::text AS class_id,
      'class'::text AS event_type,
      s.name::text AS subject_name,
      COALESCE(s.color, '#6B7280')::text AS subject_color,
      c.name::text AS class_name,
      COALESCE(c.code, '')::text AS class_code,
      c.start_time::text,
      c.end_time::text,
      c.enrolled_count::integer,
      c.max_students::integer,
      cs.session_number::integer,
      c.total_sessions::integer AS total_sessions,
      cs.status::text AS schedule_status,
      NULL::jsonb AS attendance,
      COALESCE(r.name, '')::text AS room_name,
      COALESCE(r.id, c.room_id)::text AS room_id,
      COALESCE(t2.nickname, t2.name, '')::text AS teacher_name,
      COALESCE(
        NULLIF(t2.profile_image, ''),
        (SELECT u.raw_user_meta_data->>'avatar_url'
           FROM admin_users au JOIN auth.users u ON u.id = au.id
          WHERE au.teacher_id = t2.id
            AND COALESCE(u.raw_user_meta_data->>'avatar_url','') <> ''
          LIMIT 1)
      )::text AS teacher_image,
      b.name::text AS branch_name,
      c.branch_id::text,
      NULL::text AS student_info,
      NULL::text AS extra_info
    FROM class_schedules cs
    JOIN classes c ON c.id = cs.class_id
    JOIN subjects s ON s.id = c.subject_id
    JOIN teachers t2 ON t2.id = COALESCE(cs.actual_teacher_id, c.teacher_id)
    JOIN branches b ON b.id = c.branch_id
    LEFT JOIN rooms r ON r.id = c.room_id AND r.branch_id = c.branch_id
    WHERE cs.session_date = p_date
      AND c.status IN ('published', 'started')
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
  ),
  makeup_events AS (
    SELECT
      mc.id::text AS schedule_id,
      COALESCE(mc.original_class_id::text, '') AS class_id,
      'makeup'::text AS event_type,
      COALESCE(s.name, 'Makeup')::text AS subject_name,
      '#9333EA'::text AS subject_color,
      COALESCE(oc.name, '')::text AS class_name,
      ''::text AS class_code,
      mc.makeup_start_time::text AS start_time,
      mc.makeup_end_time::text AS end_time,
      NULL::integer AS enrolled_count,
      NULL::integer AS max_students,
      NULL::integer AS session_number,
      NULL::integer AS total_sessions,
      mc.status::text AS schedule_status,
      NULL::jsonb AS attendance,
      COALESCE(r.name, '')::text AS room_name,
      COALESCE(mc.makeup_room_id::text, '') AS room_id,
      COALESCE(t2.nickname, t2.name, '')::text AS teacher_name,
      COALESCE(
        NULLIF(t2.profile_image, ''),
        (SELECT u.raw_user_meta_data->>'avatar_url'
           FROM admin_users au JOIN auth.users u ON u.id = au.id
          WHERE au.teacher_id = t2.id
            AND COALESCE(u.raw_user_meta_data->>'avatar_url','') <> ''
          LIMIT 1)
      )::text AS teacher_image,
      b.name::text AS branch_name,
      mc.makeup_branch_id::text AS branch_id,
      COALESCE(st.nickname, st.name, 'ไม่ระบุ')::text AS student_info,
      COALESCE(oc.name, '')::text AS extra_info
    FROM makeup_classes mc
    LEFT JOIN classes oc ON oc.id = mc.original_class_id
    LEFT JOIN subjects s ON s.id = oc.subject_id
    JOIN teachers t2 ON t2.id = mc.makeup_teacher_id
    JOIN branches b ON b.id = mc.makeup_branch_id
    LEFT JOIN rooms r ON r.id = mc.makeup_room_id AND r.branch_id = mc.makeup_branch_id
    LEFT JOIN students st ON st.id = mc.student_id
    WHERE mc.makeup_date = p_date
      AND mc.status IN ('scheduled', 'completed')
      AND (p_branch_id IS NULL OR mc.makeup_branch_id = p_branch_id)
  ),
  trial_events AS (
    SELECT
      ts.id::text AS schedule_id,
      ''::text AS class_id,
      'trial'::text AS event_type,
      COALESCE(s.name, 'ทดลองเรียน')::text AS subject_name,
      '#F97316'::text AS subject_color,
      ''::text AS class_name,
      ''::text AS class_code,
      ts.start_time::text,
      ts.end_time::text,
      NULL::integer AS enrolled_count,
      NULL::integer AS max_students,
      NULL::integer AS session_number,
      NULL::integer AS total_sessions,
      ts.status::text AS schedule_status,
      NULL::jsonb AS attendance,
      COALESCE(r.name, ts.room_name, '')::text AS room_name,
      COALESCE(ts.room_id::text, '') AS room_id,
      COALESCE(t2.nickname, t2.name, '')::text AS teacher_name,
      COALESCE(
        NULLIF(t2.profile_image, ''),
        (SELECT u.raw_user_meta_data->>'avatar_url'
           FROM admin_users au JOIN auth.users u ON u.id = au.id
          WHERE au.teacher_id = t2.id
            AND COALESCE(u.raw_user_meta_data->>'avatar_url','') <> ''
          LIMIT 1)
      )::text AS teacher_image,
      b.name::text AS branch_name,
      ts.branch_id::text,
      COALESCE(ts.student_name, '')::text AS student_info,
      COALESCE(s.name, '')::text AS extra_info
    FROM trial_sessions ts
    LEFT JOIN subjects s ON s.id = ts.subject_id
    JOIN teachers t2 ON t2.id = ts.teacher_id
    JOIN branches b ON b.id = ts.branch_id
    LEFT JOIN rooms r ON r.id = ts.room_id AND r.branch_id = ts.branch_id
    WHERE ts.scheduled_date = p_date
      AND ts.status IN ('scheduled', 'attended', 'absent')
      AND (p_branch_id IS NULL OR ts.branch_id = p_branch_id)
  ),
  all_events AS (
    SELECT * FROM class_events
    UNION ALL
    SELECT * FROM makeup_events
    UNION ALL
    SELECT * FROM trial_events
  ),
  active_rooms AS (
    SELECT DISTINCT room_id, room_name, branch_id, branch_name
    FROM all_events
    WHERE room_name IS NOT NULL AND room_name != ''
  )
  SELECT jsonb_build_object(
    'events', COALESCE((SELECT jsonb_agg(
      jsonb_build_object(
        'schedule_id', e.schedule_id,
        'class_id', e.class_id,
        'event_type', e.event_type,
        'subject_name', e.subject_name,
        'subject_color', e.subject_color,
        'class_name', e.class_name,
        'class_code', e.class_code,
        'start_time', e.start_time,
        'end_time', e.end_time,
        'enrolled_count', e.enrolled_count,
        'max_students', e.max_students,
        'session_number', e.session_number,
        'total_sessions', e.total_sessions,
        'schedule_status', e.schedule_status,
        'attendance', e.attendance,
        'room_name', e.room_name,
        'room_id', e.room_id,
        'teacher_name', e.teacher_name,
        'teacher_image', e.teacher_image,
        'branch_name', e.branch_name,
        'branch_id', e.branch_id,
        'student_info', e.student_info,
        'extra_info', e.extra_info
      ) ORDER BY e.start_time, e.room_name
    ) FROM all_events e), '[]'::jsonb),
    'rooms', COALESCE((SELECT jsonb_agg(
      jsonb_build_object(
        'room_id', ar.room_id,
        'room_name', ar.room_name,
        'branch_id', ar.branch_id,
        'branch_name', ar.branch_name
      ) ORDER BY ar.room_name
    ) FROM active_rooms ar), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$function$;
