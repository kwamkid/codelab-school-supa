-- RPC: get_weekly_timetable
-- Returns all regular classes, makeup classes, and trial sessions for a week,
-- shaped for the weekly schedule report grid. Single query instead of many round trips.
-- Mirrors get_daily_timetable but for a date range, and groups by day-of-week + time slot client-side.

CREATE OR REPLACE FUNCTION get_weekly_timetable(
  p_week_start date,
  p_week_end date,
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
  -- 1. Regular classes that overlap the week (recur on days_of_week)
  class_items AS (
    SELECT
      c.id::text AS id,
      'class'::text AS type,
      c.name::text AS name,
      c.days_of_week::int[] AS days_of_week,
      substring(c.start_time::text, 1, 5) AS start_time,
      substring(c.end_time::text, 1, 5) AS end_time,
      COALESCE(t.id::text, '') AS teacher_id,
      COALESCE(t.nickname, t.name, '')::text AS teacher_nickname,
      COALESCE(t.name, '')::text AS teacher_name,
      COALESCE(s.name, '')::text AS subject_name,
      COALESCE(s.color, '#6B7280')::text AS subject_color,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', st.id::text,
          'nickname', COALESCE(st.nickname, ''),
          'name', COALESCE(st.name, '')
        ))
        FROM enrollments e
        JOIN students st ON st.id = e.student_id
        WHERE e.class_id = c.id AND e.status = 'active'
      ), '[]'::jsonb) AS students
    FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    JOIN subjects s ON s.id = c.subject_id
    WHERE c.status IN ('published', 'started')
      AND c.start_date <= p_week_end
      AND c.end_date >= p_week_start
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
  ),

  -- 2. Makeup classes within the week (date-specific → single day-of-week)
  makeup_items AS (
    SELECT
      ('makeup-' || mc.id::text) AS id,
      'makeup'::text AS type,
      COALESCE(oc.name, 'Makeup')::text AS name,
      ARRAY[EXTRACT(DOW FROM mc.makeup_date)::int] AS days_of_week,
      substring(mc.makeup_start_time::text, 1, 5) AS start_time,
      substring(mc.makeup_end_time::text, 1, 5) AS end_time,
      COALESCE(t.id::text, '') AS teacher_id,
      COALESCE(t.nickname, t.name, '')::text AS teacher_nickname,
      COALESCE(t.name, '')::text AS teacher_name,
      COALESCE(s.name, oc.name, 'เรียนชดเชย')::text AS subject_name,
      '#9333EA'::text AS subject_color,
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
    JOIN teachers t ON t.id = mc.makeup_teacher_id
    LEFT JOIN students st ON st.id = mc.student_id
    WHERE mc.makeup_date >= p_week_start
      AND mc.makeup_date <= p_week_end
      AND mc.status IN ('scheduled', 'completed')
      AND (p_branch_id IS NULL OR mc.makeup_branch_id = p_branch_id)
  ),

  -- 3. Trial sessions within the week (date-specific → single day-of-week)
  trial_items AS (
    SELECT
      ('trial-' || ts.id::text) AS id,
      'trial'::text AS type,
      'ทดลองเรียน'::text AS name,
      ARRAY[EXTRACT(DOW FROM ts.scheduled_date)::int] AS days_of_week,
      substring(ts.start_time::text, 1, 5) AS start_time,
      substring(ts.end_time::text, 1, 5) AS end_time,
      COALESCE(t.id::text, '') AS teacher_id,
      COALESCE(t.nickname, t.name, '')::text AS teacher_nickname,
      COALESCE(t.name, '')::text AS teacher_name,
      COALESCE(s.name, 'ทดลองเรียน')::text AS subject_name,
      '#F97316'::text AS subject_color,
      CASE WHEN COALESCE(ts.student_name, '') <> '' THEN
        jsonb_build_array(jsonb_build_object(
          'id', '',
          'nickname', '',
          'name', ts.student_name
        ))
      ELSE '[]'::jsonb END AS students
    FROM trial_sessions ts
    LEFT JOIN subjects s ON s.id = ts.subject_id
    JOIN teachers t ON t.id = ts.teacher_id
    WHERE ts.scheduled_date >= p_week_start
      AND ts.scheduled_date <= p_week_end
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
    'id', id,
    'type', type,
    'name', name,
    'days_of_week', days_of_week,
    'start_time', start_time,
    'end_time', end_time,
    'teacher_id', teacher_id,
    'teacher_nickname', teacher_nickname,
    'teacher_name', teacher_name,
    'subject_name', subject_name,
    'subject_color', subject_color,
    'students', students
  ) ORDER BY start_time), '[]'::jsonb)
  INTO result
  FROM all_items;

  RETURN result;
END;
$$;
