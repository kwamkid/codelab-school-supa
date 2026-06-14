-- RPC: check_range_availability
-- For the "scheduling assistant" (suggest when a NEW class can open). Given a set
-- of candidate session dates + a room + teacher + time window, returns, per date,
-- whether the room/teacher is free or which existing class/makeup/trial/holiday
-- blocks it — all in ONE query (vs calling check_availability per date).
--
-- Input p_dates: array of DATE (the generated session dates, holidays already
-- excluded by the caller OR flagged here too). Output: JSONB array, one element
-- per input date that has a conflict:
--   { "date": "YYYY-MM-DD", "conflicts": [ {type,message,conflict_type,conflict_name,conflict_time}, ... ] }
-- Dates with no conflict are omitted, so an empty array => the whole range is free.

CREATE OR REPLACE FUNCTION check_range_availability(
  p_dates DATE[],
  p_start_time TEXT,
  p_end_time TEXT,
  p_branch_id UUID,
  p_room_id UUID,
  p_teacher_id UUID,
  p_exclude_class_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_start TIME := p_start_time::TIME;
  v_end TIME := p_end_time::TIME;
  v_room_name TEXT;
  d DATE;
  v_dow INT;
  v_day JSONB;
  rec RECORD;
BEGIN
  SELECT name INTO v_room_name FROM rooms WHERE id = p_room_id;

  FOREACH d IN ARRAY p_dates LOOP
    v_day := '[]'::JSONB;
    v_dow := EXTRACT(DOW FROM d)::INT;

    -- Holiday
    SELECT v_day || jsonb_build_object(
      'type', 'holiday',
      'message', 'วันหยุด (' || COALESCE(h.name, 'วันหยุด') || ')',
      'conflict_type', 'holiday',
      'conflict_name', COALESCE(h.name, 'วันหยุด'),
      'conflict_time', ''
    ) INTO v_day
    FROM holidays h
    WHERE h.date = d
      AND (h.type = 'national' OR p_branch_id = ANY(h.branches))
    LIMIT 1;
    IF v_day IS NULL THEN v_day := '[]'::JSONB; END IF;

    -- Room conflict: classes
    FOR rec IN
      SELECT c.name, SUBSTRING(c.start_time::TEXT,1,5) AS st, SUBSTRING(c.end_time::TEXT,1,5) AS et
      FROM classes c JOIN class_schedules cs ON cs.class_id = c.id
      WHERE c.branch_id = p_branch_id AND c.room_id = p_room_id
        AND c.status IN ('published','started')
        AND v_dow = ANY(c.days_of_week)
        AND cs.session_date = d AND cs.status <> 'cancelled'
        AND (p_exclude_class_id IS NULL OR c.id <> p_exclude_class_id)
        AND v_start < c.end_time AND v_end > c.start_time
      GROUP BY c.name, c.start_time, c.end_time
    LOOP
      v_day := v_day || jsonb_build_object(
        'type','room_conflict',
        'message','ห้อง ' || COALESCE(v_room_name,'') || ' ไม่ว่าง - คลาส ' || rec.name || ' ' || rec.st || '-' || rec.et,
        'conflict_type','class','conflict_name',rec.name,'conflict_time',rec.st || '-' || rec.et);
    END LOOP;

    -- Room conflict: makeup
    FOR rec IN
      SELECT COALESCE(s.nickname,s.name,'นักเรียน') AS nm,
        SUBSTRING(m.makeup_start_time::TEXT,1,5) AS st, SUBSTRING(m.makeup_end_time::TEXT,1,5) AS et
      FROM makeup_classes m LEFT JOIN students s ON s.id = m.student_id
      WHERE m.status='scheduled' AND m.makeup_branch_id=p_branch_id AND m.makeup_room_id=p_room_id
        AND m.makeup_date = d AND v_start < m.makeup_end_time AND v_end > m.makeup_start_time
    LOOP
      v_day := v_day || jsonb_build_object(
        'type','room_conflict',
        'message','ห้อง ' || COALESCE(v_room_name,'') || ' มี Makeup ของ ' || rec.nm || ' ' || rec.st || '-' || rec.et,
        'conflict_type','makeup','conflict_name',rec.nm,'conflict_time',rec.st || '-' || rec.et);
    END LOOP;

    -- Room conflict: trial
    FOR rec IN
      SELECT ts.student_name AS nm, SUBSTRING(ts.start_time::TEXT,1,5) AS st, SUBSTRING(ts.end_time::TEXT,1,5) AS et
      FROM trial_sessions ts
      WHERE ts.status='scheduled' AND ts.branch_id=p_branch_id AND ts.room_id=p_room_id
        AND ts.scheduled_date = d AND v_start < ts.end_time AND v_end > ts.start_time
    LOOP
      v_day := v_day || jsonb_build_object(
        'type','room_conflict',
        'message','ห้อง ' || COALESCE(v_room_name,'') || ' มีทดลองเรียนของ ' || rec.nm || ' ' || rec.st || '-' || rec.et,
        'conflict_type','trial','conflict_name',rec.nm,'conflict_time',rec.st || '-' || rec.et);
    END LOOP;

    -- Teacher conflict: classes (honor per-session substitute via actual_teacher_id)
    FOR rec IN
      SELECT c.name, SUBSTRING(c.start_time::TEXT,1,5) AS st, SUBSTRING(c.end_time::TEXT,1,5) AS et
      FROM classes c JOIN class_schedules cs ON cs.class_id = c.id
      WHERE COALESCE(cs.actual_teacher_id, c.teacher_id) = p_teacher_id
        AND c.status IN ('published','started')
        AND cs.session_date = d AND cs.status <> 'cancelled'
        AND (p_exclude_class_id IS NULL OR c.id <> p_exclude_class_id)
        AND v_start < c.end_time AND v_end > c.start_time
      GROUP BY c.name, c.start_time, c.end_time
    LOOP
      v_day := v_day || jsonb_build_object(
        'type','teacher_conflict',
        'message','ครูไม่ว่าง - คลาส ' || rec.name || ' ' || rec.st || '-' || rec.et,
        'conflict_type','class','conflict_name',rec.name,'conflict_time',rec.st || '-' || rec.et);
    END LOOP;

    -- Teacher conflict: makeup
    FOR rec IN
      SELECT COALESCE(s.nickname,s.name,'นักเรียน') AS nm,
        SUBSTRING(m.makeup_start_time::TEXT,1,5) AS st, SUBSTRING(m.makeup_end_time::TEXT,1,5) AS et
      FROM makeup_classes m LEFT JOIN students s ON s.id = m.student_id
      WHERE m.status='scheduled' AND m.makeup_teacher_id=p_teacher_id
        AND m.makeup_date = d AND v_start < m.makeup_end_time AND v_end > m.makeup_start_time
    LOOP
      v_day := v_day || jsonb_build_object(
        'type','teacher_conflict',
        'message','ครูไม่ว่าง - Makeup ของ ' || rec.nm || ' ' || rec.st || '-' || rec.et,
        'conflict_type','makeup','conflict_name',rec.nm,'conflict_time',rec.st || '-' || rec.et);
    END LOOP;

    -- Teacher conflict: trial
    FOR rec IN
      SELECT ts.student_name AS nm, SUBSTRING(ts.start_time::TEXT,1,5) AS st, SUBSTRING(ts.end_time::TEXT,1,5) AS et
      FROM trial_sessions ts
      WHERE ts.status='scheduled' AND ts.teacher_id=p_teacher_id
        AND ts.scheduled_date = d AND v_start < ts.end_time AND v_end > ts.start_time
    LOOP
      v_day := v_day || jsonb_build_object(
        'type','teacher_conflict',
        'message','ครูไม่ว่าง - ทดลองเรียนของ ' || rec.nm || ' ' || rec.st || '-' || rec.et,
        'conflict_type','trial','conflict_name',rec.nm,'conflict_time',rec.st || '-' || rec.et);
    END LOOP;

    -- Only record dates that have at least one conflict
    IF jsonb_array_length(v_day) > 0 THEN
      v_result := v_result || jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'conflicts', v_day);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;
