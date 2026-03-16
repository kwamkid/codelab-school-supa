-- RPC function for dashboard stats - replaces multiple round-trip queries with a single call
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_today DATE := CURRENT_DATE;
  v_total_students BIGINT;
  v_total_classes BIGINT;
  v_today_classes BIGINT;
  v_upcoming_makeups BIGINT;
  v_pending_makeups BIGINT;
  v_upcoming_trials BIGINT;
BEGIN
  -- Total students
  SELECT COUNT(*) INTO v_total_students FROM students;

  -- Active classes (published or started)
  IF p_branch_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_total_classes
    FROM classes
    WHERE status IN ('published', 'started') AND branch_id = p_branch_id;
  ELSE
    SELECT COUNT(*) INTO v_total_classes
    FROM classes
    WHERE status IN ('published', 'started');
  END IF;

  -- Today's classes (distinct classes with schedules today)
  IF p_branch_id IS NOT NULL THEN
    SELECT COUNT(DISTINCT cs.class_id) INTO v_today_classes
    FROM class_schedules cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.session_date = v_today
      AND c.status IN ('published', 'started')
      AND c.branch_id = p_branch_id
      AND cs.status NOT IN ('cancelled');
  ELSE
    SELECT COUNT(DISTINCT cs.class_id) INTO v_today_classes
    FROM class_schedules cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.session_date = v_today
      AND c.status IN ('published', 'started')
      AND cs.status NOT IN ('cancelled');
  END IF;

  -- Makeup stats
  IF p_branch_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN mc.status = 'pending' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN mc.status = 'scheduled' AND mc.makeup_date >= v_today THEN 1 ELSE 0 END), 0)
    INTO v_pending_makeups, v_upcoming_makeups
    FROM makeup_classes mc
    LEFT JOIN classes c ON c.id = mc.original_class_id
    WHERE mc.status IN ('pending', 'scheduled')
      AND COALESCE(mc.makeup_branch_id, c.branch_id) = p_branch_id;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'scheduled' AND makeup_date >= v_today THEN 1 ELSE 0 END), 0)
    INTO v_pending_makeups, v_upcoming_makeups
    FROM makeup_classes
    WHERE status IN ('pending', 'scheduled');
  END IF;

  -- Upcoming trials
  IF p_branch_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_upcoming_trials
    FROM trial_sessions
    WHERE status = 'scheduled'
      AND scheduled_date >= v_today
      AND branch_id = p_branch_id;
  ELSE
    SELECT COUNT(*) INTO v_upcoming_trials
    FROM trial_sessions
    WHERE status = 'scheduled'
      AND scheduled_date >= v_today;
  END IF;

  result := json_build_object(
    'totalStudents', v_total_students,
    'totalClasses', v_total_classes,
    'activeClasses', v_total_classes,
    'todayClasses', v_today_classes,
    'upcomingMakeups', v_upcoming_makeups,
    'pendingMakeups', v_pending_makeups,
    'upcomingTrials', v_upcoming_trials
  );

  RETURN result;
END;
$$;
