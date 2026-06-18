-- get_class_lookup_data: add a classStats array (class_id → completed_sessions)
-- so the classes list "ความคืบหน้า" progress bar has data. The TS layer
-- (lib/services/lookup.ts) already reads data.classStats; the RPC simply never
-- returned it, so every class showed 0% progress.
CREATE OR REPLACE FUNCTION public.get_class_lookup_data(p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
  v_branches JSON;
  v_subjects JSON;
  v_teachers JSON;
  v_rooms JSON;
  v_class_stats JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(b)), '[]'::json) INTO v_branches
  FROM (
    SELECT id, name, code FROM branches WHERE is_active = true ORDER BY name
  ) b;

  SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) INTO v_subjects
  FROM (
    SELECT id, name, code, color, category, level, age_range_min, age_range_max, icon, is_active
    FROM subjects WHERE is_active = true ORDER BY name
  ) s;

  -- ALL teachers (name-resolution map). profile_image falls back to the linked
  -- account's Google avatar so badges show a photo even when none was uploaded.
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_teachers
  FROM (
    SELECT
      t.id, t.name, t.nickname,
      COALESCE(
        t.profile_image,
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
      ) AS profile_image,
      t.specialties, t.available_branches, t.is_active
    FROM teachers t
    LEFT JOIN admin_users au ON au.teacher_id = t.id
    LEFT JOIN auth.users u ON lower(u.email) = lower(au.email)
    ORDER BY t.name
  ) t;

  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO v_rooms
  FROM (
    SELECT id, branch_id, name, capacity, is_active
    FROM rooms
    WHERE is_active = true AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    ORDER BY name
  ) r;

  -- Completed-session count per class (for the list's progress bar).
  SELECT COALESCE(json_agg(row_to_json(cs)), '[]'::json) INTO v_class_stats
  FROM (
    SELECT cl.id AS class_id, COUNT(sch.id) AS completed_sessions
    FROM classes cl
    JOIN class_schedules sch ON sch.class_id = cl.id AND sch.status = 'completed'
    WHERE (p_branch_id IS NULL OR cl.branch_id = p_branch_id)
    GROUP BY cl.id
  ) cs;

  result := json_build_object(
    'branches', v_branches, 'subjects', v_subjects,
    'teachers', v_teachers, 'rooms', v_rooms,
    'classStats', v_class_stats
  );
  RETURN result;
END;
$function$;
