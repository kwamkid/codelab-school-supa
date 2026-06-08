-- RPC: get_teacher_daily_schedule
-- Returns the classes / makeup / trial sessions a specific teacher must teach on a date,
-- including the student list per slot. Single query for the teacher home page.
-- Honors class_schedules.actual_teacher_id (substitute teacher) for regular classes.
--
-- Teacher-change handling (both refresh and show up automatically):
--   * Per-session substitute → class_schedules.actual_teacher_id is set; COALESCE picks it
--   * Permanent change → classes.teacher_id + future actual_teacher_id are set; COALESCE picks it
--
-- Slide linking: each regular class session is matched to its teaching material by
--   (subject_id, session_number). material_id is null when no slide exists yet → button disabled.

CREATE OR REPLACE FUNCTION get_teacher_daily_schedule(
  p_teacher_id uuid,
  p_date date,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
  -- 1. Regular classes scheduled on the date where this teacher is the effective teacher
  class_items AS (
    SELECT
      cs.id::text AS schedule_id,
      c.id::text AS class_id,
      'class'::text AS type,
      s.name::text AS subject_name,
      COALESCE(s.color, '#6B7280')::text AS subject_color,
      c.name::text AS class_name,
      COALESCE(c.code, '')::text AS class_code,
      substring(c.start_time::text, 1, 5) AS start_time,
      substring(c.end_time::text, 1, 5) AS end_time,
      c.enrolled_count::int AS enrolled_count,
      c.max_students::int AS max_students,
      cs.session_number::int AS session_number,
      cs.status::text AS schedule_status,
      COALESCE(r.name, '')::text AS room_name,
      b.name::text AS branch_name,
      c.subject_id::text AS subject_id,
      c.total_sessions::int AS total_sessions,
      tm.id::text AS material_id,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', st.id::text,
          'nickname', COALESCE(st.nickname, ''),
          'name', COALESCE(st.name, ''),
          -- absent = student has a (non-cancelled) makeup/leave request for THIS session
          'is_absent', EXISTS(
            SELECT 1 FROM makeup_classes mc
            WHERE mc.student_id = e.student_id
              AND mc.original_schedule_id = cs.id
              AND mc.status <> 'cancelled'
          )
        ) ORDER BY st.nickname)
        FROM enrollments e
        JOIN students st ON st.id = e.student_id
        WHERE e.class_id = c.id AND e.status = 'active'
      ), '[]'::jsonb) AS students
    FROM class_schedules cs
    JOIN classes c ON c.id = cs.class_id
    JOIN subjects s ON s.id = c.subject_id
    JOIN branches b ON b.id = c.branch_id
    LEFT JOIN rooms r ON r.id = c.room_id AND r.branch_id = c.branch_id
    -- Match the slide for this session by subject + session number (active only)
    LEFT JOIN teaching_materials tm
      ON tm.subject_id = c.subject_id
      AND tm.session_number = cs.session_number
      AND tm.is_active = true
    WHERE cs.session_date = p_date
      AND c.status IN ('published', 'started')
      AND COALESCE(cs.status, 'scheduled') <> 'cancelled'
      AND COALESCE(cs.actual_teacher_id, c.teacher_id) = p_teacher_id
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
  ),

  -- 2. Makeup classes this teacher runs on the date
  makeup_items AS (
    SELECT
      mc.id::text AS schedule_id,
      COALESCE(mc.original_class_id::text, '') AS class_id,
      'makeup'::text AS type,
      COALESCE(s.name, 'เรียนชดเชย')::text AS subject_name,
      COALESCE(s.color, '#9333EA')::text AS subject_color,
      COALESCE(oc.name, 'Makeup')::text AS class_name,
      ''::text AS class_code,
      substring(mc.makeup_start_time::text, 1, 5) AS start_time,
      substring(mc.makeup_end_time::text, 1, 5) AS end_time,
      NULL::int AS enrolled_count,
      NULL::int AS max_students,
      ocs.session_number::int AS session_number,
      mc.status::text AS schedule_status,
      COALESCE(r.name, '')::text AS room_name,
      b.name::text AS branch_name,
      oc.subject_id::text AS subject_id,
      oc.total_sessions::int AS total_sessions,
      tm.id::text AS material_id,
      CASE WHEN st.id IS NOT NULL THEN
        jsonb_build_array(jsonb_build_object(
          'id', st.id::text,
          'nickname', COALESCE(st.nickname, ''),
          'name', COALESCE(st.name, '')
        ))
      ELSE '[]'::jsonb END AS students
    FROM makeup_classes mc
    LEFT JOIN classes oc ON oc.id = mc.original_class_id
    LEFT JOIN subjects s ON s.id = oc.subject_id
    -- Original missed session → its session number → matching slide
    LEFT JOIN class_schedules ocs ON ocs.id = mc.original_schedule_id
    LEFT JOIN teaching_materials tm
      ON tm.subject_id = oc.subject_id
      AND tm.session_number = ocs.session_number
      AND tm.is_active = true
    JOIN branches b ON b.id = mc.makeup_branch_id
    LEFT JOIN rooms r ON r.id = mc.makeup_room_id AND r.branch_id = mc.makeup_branch_id
    LEFT JOIN students st ON st.id = mc.student_id
    WHERE mc.makeup_date = p_date
      AND mc.makeup_teacher_id = p_teacher_id
      AND mc.status IN ('scheduled', 'completed')
      AND (p_branch_id IS NULL OR mc.makeup_branch_id = p_branch_id)
  ),

  -- 3. Trial sessions this teacher runs on the date
  trial_items AS (
    SELECT
      ts.id::text AS schedule_id,
      ''::text AS class_id,
      'trial'::text AS type,
      COALESCE(s.name, 'ทดลองเรียน')::text AS subject_name,
      COALESCE(s.color, '#F97316')::text AS subject_color,
      'ทดลองเรียน'::text AS class_name,
      ''::text AS class_code,
      substring(ts.start_time::text, 1, 5) AS start_time,
      substring(ts.end_time::text, 1, 5) AS end_time,
      NULL::int AS enrolled_count,
      NULL::int AS max_students,
      NULL::int AS session_number,
      ts.status::text AS schedule_status,
      COALESCE(r.name, ts.room_name, '')::text AS room_name,
      b.name::text AS branch_name,
      ts.subject_id::text AS subject_id,
      NULL::int AS total_sessions,
      NULL::text AS material_id,
      CASE WHEN COALESCE(ts.student_name, '') <> '' THEN
        jsonb_build_array(jsonb_build_object(
          'id', '',
          'nickname', '',
          'name', ts.student_name
        ))
      ELSE '[]'::jsonb END AS students
    FROM trial_sessions ts
    LEFT JOIN subjects s ON s.id = ts.subject_id
    JOIN branches b ON b.id = ts.branch_id
    LEFT JOIN rooms r ON r.id = ts.room_id AND r.branch_id = ts.branch_id
    WHERE ts.scheduled_date = p_date
      AND ts.teacher_id = p_teacher_id
      AND ts.status IN ('scheduled', 'attended', 'absent')
      AND (p_branch_id IS NULL OR ts.branch_id = p_branch_id)
  ),

  all_items AS (
    SELECT * FROM class_items
    UNION ALL
    SELECT * FROM makeup_items
    UNION ALL
    SELECT * FROM trial_items
  )

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'schedule_id', schedule_id,
    'class_id', class_id,
    'type', type,
    'subject_name', subject_name,
    'subject_color', subject_color,
    'class_name', class_name,
    'class_code', class_code,
    'start_time', start_time,
    'end_time', end_time,
    'enrolled_count', enrolled_count,
    'max_students', max_students,
    'session_number', session_number,
    'schedule_status', schedule_status,
    'room_name', room_name,
    'branch_name', branch_name,
    'subject_id', subject_id,
    'total_sessions', total_sessions,
    'material_id', material_id,
    'students', students
  ) ORDER BY start_time, subject_name), '[]'::jsonb)
  INTO result
  FROM all_items;

  RETURN result;
END;
$$;
