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

  -- Teachers — ALL of them (this is a name-resolution map for class rows, NOT the
  -- teacher-picker dropdown; that uses getTeachersByBranch separately). No branch /
  -- is_active filter: a teacher can be assigned to a class in a branch they aren't
  -- "available" at (e.g. a พระราม 2 teacher covering a เมืองทอง class), and
  -- soft-deleted teachers must still resolve — filtering either way showed "Unknown"
  -- in the list while the detail page showed the real name.
  -- profile_image falls back to the linked account's Google avatar
  -- (teachers → admin_users.teacher_id → auth.users.email) so badges show a photo
  -- even when no image was uploaded.
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
