-- RPC: get_class_lookup_data
-- รวม branches + subjects + teachers + rooms ใน 1 query
-- ใช้ในหน้า Classes, Trial, Attendance ที่ต้อง load lookup data 4 ตัวพร้อมกัน
-- ลด 4 round trips เหลือ 1

CREATE OR REPLACE FUNCTION get_class_lookup_data(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_branches JSON;
  v_subjects JSON;
  v_teachers JSON;
  v_rooms JSON;
BEGIN
  -- Active branches
  SELECT COALESCE(json_agg(row_to_json(b)), '[]'::json) INTO v_branches
  FROM (
    SELECT id, name, code
    FROM branches
    WHERE is_active = true
    ORDER BY name
  ) b;

  -- Active subjects
  SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) INTO v_subjects
  FROM (
    SELECT id, name, code, color, category, level, age_range_min, age_range_max, icon, is_active
    FROM subjects
    WHERE is_active = true
    ORDER BY name
  ) s;

  -- Active teachers (filter by branch if provided)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_teachers
  FROM (
    SELECT id, name, nickname, specialties, available_branches, is_active
    FROM teachers
    WHERE is_active = true
      AND (p_branch_id IS NULL OR available_branches @> ARRAY[p_branch_id::text])
    ORDER BY name
  ) t;

  -- Rooms (filter by branch if provided)
  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO v_rooms
  FROM (
    SELECT id, branch_id, name, capacity, is_active
    FROM rooms
    WHERE is_active = true
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    ORDER BY name
  ) r;

  result := json_build_object(
    'branches', v_branches,
    'subjects', v_subjects,
    'teachers', v_teachers,
    'rooms', v_rooms
  );

  RETURN result;
END;
$$;
