-- RPC function to check room & teacher availability in a single query
-- Replaces multiple client-side queries with one server-side call

CREATE OR REPLACE FUNCTION check_availability(
  p_check_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_branch_id UUID,
  p_room_id UUID,
  p_teacher_id UUID,
  p_exclude_id UUID DEFAULT NULL,
  p_exclude_type TEXT DEFAULT NULL -- 'class', 'makeup', 'trial'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_day_of_week INT;
  v_start TIME;
  v_end TIME;
  v_room_name TEXT;
  rec RECORD;
BEGIN
  -- Normalize time strings
  v_start := p_start_time::TIME;
  v_end := p_end_time::TIME;
  v_day_of_week := EXTRACT(DOW FROM p_check_date)::INT;

  -- Get room name
  SELECT name INTO v_room_name FROM rooms WHERE id = p_room_id;

  -- 1. Check holidays (single date column, branches array, type='national' applies to all)
  IF EXISTS (
    SELECT 1 FROM holidays
    WHERE date = p_check_date
      AND (type = 'national' OR p_branch_id::TEXT = ANY(branches))
  ) THEN
    SELECT v_result || jsonb_build_object(
      'type', 'holiday',
      'message', 'วันที่เลือกเป็นวันหยุด (' || COALESCE(h.name, 'วันหยุด') || ')',
      'conflict_type', 'holiday',
      'conflict_name', COALESCE(h.name, 'วันหยุด'),
      'conflict_time', ''
    )
    INTO v_result
    FROM holidays h
    WHERE h.date = p_check_date
      AND (h.type = 'national' OR p_branch_id::TEXT = ANY(h.branches))
    LIMIT 1;
  END IF;

  -- 2. Check room conflicts from classes (with active schedules on that date)
  FOR rec IN
    SELECT c.id, c.name, SUBSTRING(c.start_time::TEXT, 1, 5) AS st, SUBSTRING(c.end_time::TEXT, 1, 5) AS et, 'class' AS src, 'room' AS check_type
    FROM classes c
    JOIN class_schedules cs ON cs.class_id = c.id
    WHERE c.branch_id = p_branch_id
      AND c.room_id = p_room_id
      AND c.status IN ('published', 'started')
      AND v_day_of_week = ANY(c.days_of_week)
      AND c.start_date <= p_check_date
      AND c.end_date >= p_check_date
      AND cs.session_date = p_check_date
      AND cs.status != 'cancelled'
      AND NOT (p_exclude_type = 'class' AND c.id = p_exclude_id)
      AND v_start < c.end_time AND v_end > c.start_time
    GROUP BY c.id, c.name, c.start_time, c.end_time
  LOOP
    v_result := v_result || jsonb_build_object(
      'type', 'room_conflict',
      'message', 'ห้อง ' || COALESCE(v_room_name, '') || ' ไม่ว่าง - คลาส ' || rec.name || ' เวลา ' || rec.st || '-' || rec.et,
      'conflict_type', 'class',
      'conflict_name', rec.name,
      'conflict_time', rec.st || '-' || rec.et
    );
  END LOOP;

  -- 3. Check room conflicts from makeup classes
  IF p_exclude_type IS DISTINCT FROM 'makeup' THEN
    FOR rec IN
      SELECT m.id,
        COALESCE(s.nickname, s.name, 'นักเรียน') AS student_name,
        SUBSTRING(m.makeup_start_time::TEXT, 1, 5) AS st,
        SUBSTRING(m.makeup_end_time::TEXT, 1, 5) AS et
      FROM makeup_classes m
      LEFT JOIN students s ON s.id = m.student_id
      WHERE m.status = 'scheduled'
        AND m.makeup_branch_id = p_branch_id
        AND m.makeup_room_id = p_room_id
        AND m.makeup_date = p_check_date
        AND m.id != COALESCE(p_exclude_id, '00000000-0000-0000-0000-000000000000')
        AND v_start < m.makeup_end_time AND v_end > m.makeup_start_time
    LOOP
      v_result := v_result || jsonb_build_object(
        'type', 'room_conflict',
        'message', 'ห้อง ' || COALESCE(v_room_name, '') || ' มี Makeup ของ ' || rec.student_name || ' เวลา ' || rec.st || '-' || rec.et,
        'conflict_type', 'makeup',
        'conflict_name', rec.student_name,
        'conflict_time', rec.st || '-' || rec.et
      );
    END LOOP;
  END IF;

  -- 4. Check room conflicts from trial sessions
  IF p_exclude_type IS DISTINCT FROM 'trial' THEN
    FOR rec IN
      SELECT ts.id, ts.student_name,
        SUBSTRING(ts.start_time::TEXT, 1, 5) AS st,
        SUBSTRING(ts.end_time::TEXT, 1, 5) AS et
      FROM trial_sessions ts
      WHERE ts.status = 'scheduled'
        AND ts.branch_id = p_branch_id
        AND ts.room_id = p_room_id
        AND ts.scheduled_date = p_check_date
        AND ts.id != COALESCE(p_exclude_id, '00000000-0000-0000-0000-000000000000')
        AND v_start < ts.end_time AND v_end > ts.start_time
    LOOP
      v_result := v_result || jsonb_build_object(
        'type', 'room_conflict',
        'message', 'ห้อง ' || COALESCE(v_room_name, '') || ' มีทดลองเรียนของ ' || rec.student_name || ' เวลา ' || rec.st || '-' || rec.et,
        'conflict_type', 'trial',
        'conflict_name', rec.student_name,
        'conflict_time', rec.st || '-' || rec.et
      );
    END LOOP;
  END IF;

  -- 5. Check teacher conflicts from classes
  FOR rec IN
    SELECT c.id, c.name, SUBSTRING(c.start_time::TEXT, 1, 5) AS st, SUBSTRING(c.end_time::TEXT, 1, 5) AS et
    FROM classes c
    JOIN class_schedules cs ON cs.class_id = c.id
    WHERE c.teacher_id = p_teacher_id
      AND c.status IN ('published', 'started')
      AND v_day_of_week = ANY(c.days_of_week)
      AND c.start_date <= p_check_date
      AND c.end_date >= p_check_date
      AND cs.session_date = p_check_date
      AND cs.status != 'cancelled'
      AND NOT (p_exclude_type = 'class' AND c.id = p_exclude_id)
      AND v_start < c.end_time AND v_end > c.start_time
    GROUP BY c.id, c.name, c.start_time, c.end_time
  LOOP
    v_result := v_result || jsonb_build_object(
      'type', 'teacher_conflict',
      'message', 'ครูไม่ว่าง - คลาส ' || rec.name || ' เวลา ' || rec.st || '-' || rec.et,
      'conflict_type', 'class',
      'conflict_name', rec.name,
      'conflict_time', rec.st || '-' || rec.et
    );
  END LOOP;

  -- 6. Check teacher conflicts from makeup classes
  IF p_exclude_type IS DISTINCT FROM 'makeup' THEN
    FOR rec IN
      SELECT m.id,
        COALESCE(s.nickname, s.name, 'นักเรียน') AS student_name,
        SUBSTRING(m.makeup_start_time::TEXT, 1, 5) AS st,
        SUBSTRING(m.makeup_end_time::TEXT, 1, 5) AS et
      FROM makeup_classes m
      LEFT JOIN students s ON s.id = m.student_id
      WHERE m.status = 'scheduled'
        AND m.makeup_teacher_id = p_teacher_id
        AND m.makeup_date = p_check_date
        AND m.id != COALESCE(p_exclude_id, '00000000-0000-0000-0000-000000000000')
        AND v_start < m.makeup_end_time AND v_end > m.makeup_start_time
    LOOP
      v_result := v_result || jsonb_build_object(
        'type', 'teacher_conflict',
        'message', 'ครูไม่ว่าง - Makeup ของ ' || rec.student_name || ' เวลา ' || rec.st || '-' || rec.et,
        'conflict_type', 'makeup',
        'conflict_name', rec.student_name,
        'conflict_time', rec.st || '-' || rec.et
      );
    END LOOP;
  END IF;

  -- 7. Check teacher conflicts from trial sessions
  IF p_exclude_type IS DISTINCT FROM 'trial' THEN
    FOR rec IN
      SELECT ts.id, ts.student_name,
        SUBSTRING(ts.start_time::TEXT, 1, 5) AS st,
        SUBSTRING(ts.end_time::TEXT, 1, 5) AS et
      FROM trial_sessions ts
      WHERE ts.status = 'scheduled'
        AND ts.teacher_id = p_teacher_id
        AND ts.scheduled_date = p_check_date
        AND ts.id != COALESCE(p_exclude_id, '00000000-0000-0000-0000-000000000000')
        AND v_start < ts.end_time AND v_end > ts.start_time
    LOOP
      v_result := v_result || jsonb_build_object(
        'type', 'teacher_conflict',
        'message', 'ครูไม่ว่าง - ทดลองเรียนของ ' || rec.student_name || ' เวลา ' || rec.st || '-' || rec.et,
        'conflict_type', 'trial',
        'conflict_name', rec.student_name,
        'conflict_time', rec.st || '-' || rec.et
      );
    END LOOP;
  END IF;

  RETURN v_result;
END;
$$;
