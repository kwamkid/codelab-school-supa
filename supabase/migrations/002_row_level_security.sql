-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_transfer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_booking_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_reschedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE makeup_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registration_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registration_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users
        WHERE id = auth.uid()
        AND role = 'super_admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get admin's branch IDs
CREATE OR REPLACE FUNCTION get_admin_branch_ids()
RETURNS UUID[] AS $$
DECLARE
    branch_ids UUID[];
    admin_role admin_role;
BEGIN
    SELECT role, a.branch_ids INTO admin_role, branch_ids
    FROM admin_users a
    WHERE a.id = auth.uid()
    AND a.is_active = true;

    -- Super admin or empty array means all branches
    IF admin_role = 'super_admin' OR branch_ids = '{}' THEN
        RETURN NULL; -- NULL means all branches
    END IF;

    RETURN branch_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if admin has access to branch
CREATE OR REPLACE FUNCTION admin_has_branch_access(target_branch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_branches UUID[];
BEGIN
    admin_branches := get_admin_branch_ids();

    -- NULL means all branches access
    IF admin_branches IS NULL THEN
        RETURN true;
    END IF;

    RETURN target_branch_id = ANY(admin_branches);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get parent ID from auth
CREATE OR REPLACE FUNCTION get_parent_id_from_line()
RETURNS UUID AS $$
BEGIN
    -- ดึง parent_id จาก LINE user ID ที่เก็บใน auth.users.raw_user_meta_data
    RETURN (
        SELECT id FROM parents
        WHERE line_user_id = (auth.jwt()->>'sub')
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- BRANCHES Policies
-- =====================================================

-- Anyone can read active branches
CREATE POLICY "branches_select_public"
ON branches FOR SELECT
USING (is_active = true);

-- Only admins can manage branches
CREATE POLICY "branches_all_admin"
ON branches FOR ALL
USING (is_admin());

-- =====================================================
-- ROOMS Policies
-- =====================================================

-- Anyone can read active rooms
CREATE POLICY "rooms_select_public"
ON rooms FOR SELECT
USING (is_active = true);

-- Admin can manage rooms in their branches
CREATE POLICY "rooms_all_admin"
ON rooms FOR ALL
USING (is_admin() AND admin_has_branch_access(branch_id));

-- =====================================================
-- PARENTS Policies
-- =====================================================

-- Parents can read/update their own data
CREATE POLICY "parents_select_own"
ON parents FOR SELECT
USING (id = get_parent_id_from_line());

CREATE POLICY "parents_update_own"
ON parents FOR UPDATE
USING (id = get_parent_id_from_line());

-- Admin can read all parents
CREATE POLICY "parents_select_admin"
ON parents FOR SELECT
USING (is_admin());

-- Admin can manage all parents
CREATE POLICY "parents_all_admin"
ON parents FOR ALL
USING (is_admin());

-- =====================================================
-- STUDENTS Policies
-- =====================================================

-- Parents can read their own students
CREATE POLICY "students_select_own"
ON students FOR SELECT
USING (parent_id = get_parent_id_from_line());

-- Parents can update their own students
CREATE POLICY "students_update_own"
ON students FOR UPDATE
USING (parent_id = get_parent_id_from_line());

-- Admin can manage all students
CREATE POLICY "students_all_admin"
ON students FOR ALL
USING (is_admin());

-- =====================================================
-- TEACHERS Policies
-- =====================================================

-- Anyone can read active teachers (for display)
CREATE POLICY "teachers_select_public"
ON teachers FOR SELECT
USING (is_active = true);

-- Admin can manage teachers
CREATE POLICY "teachers_all_admin"
ON teachers FOR ALL
USING (is_admin());

-- =====================================================
-- ADMIN_USERS Policies
-- =====================================================

-- Admin can read their own data
CREATE POLICY "admin_users_select_own"
ON admin_users FOR SELECT
USING (id = auth.uid());

-- Super admin can manage all admin users
CREATE POLICY "admin_users_all_super_admin"
ON admin_users FOR ALL
USING (is_super_admin());

-- =====================================================
-- SUBJECTS Policies
-- =====================================================

-- Anyone can read active subjects
CREATE POLICY "subjects_select_public"
ON subjects FOR SELECT
USING (is_active = true);

-- Admin can manage subjects
CREATE POLICY "subjects_all_admin"
ON subjects FOR ALL
USING (is_admin());

-- =====================================================
-- CLASSES Policies
-- =====================================================

-- Anyone can read published/started classes
CREATE POLICY "classes_select_public"
ON classes FOR SELECT
USING (status IN ('published', 'started'));

-- Admin can manage classes in their branches
CREATE POLICY "classes_all_admin"
ON classes FOR ALL
USING (is_admin() AND admin_has_branch_access(branch_id));

-- Super admin can manage all classes
CREATE POLICY "classes_all_super_admin"
ON classes FOR ALL
USING (is_super_admin());

-- =====================================================
-- CLASS_SCHEDULES Policies
-- =====================================================

-- Parents can read schedules of classes their children enrolled in
CREATE POLICY "class_schedules_select_parent"
ON class_schedules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM enrollments e
        JOIN students s ON e.student_id = s.id
        WHERE e.class_id = class_schedules.class_id
        AND s.parent_id = get_parent_id_from_line()
        AND e.status = 'active'
    )
);

-- Admin can manage schedules
CREATE POLICY "class_schedules_all_admin"
ON class_schedules FOR ALL
USING (is_admin());

-- =====================================================
-- ATTENDANCE Policies
-- =====================================================

-- Parents can read attendance of their children
CREATE POLICY "attendance_select_parent"
ON attendance FOR SELECT
USING (
    student_id IN (
        SELECT id FROM students WHERE parent_id = get_parent_id_from_line()
    )
);

-- Admin can manage attendance
CREATE POLICY "attendance_all_admin"
ON attendance FOR ALL
USING (is_admin());

-- =====================================================
-- ENROLLMENTS Policies
-- =====================================================

-- Parents can read their children's enrollments
CREATE POLICY "enrollments_select_parent"
ON enrollments FOR SELECT
USING (parent_id = get_parent_id_from_line());

-- Admin can manage enrollments in their branches
CREATE POLICY "enrollments_all_admin"
ON enrollments FOR ALL
USING (is_admin() AND admin_has_branch_access(branch_id));

-- Super admin can manage all enrollments
CREATE POLICY "enrollments_all_super_admin"
ON enrollments FOR ALL
USING (is_super_admin());

-- =====================================================
-- ENROLLMENT_TRANSFER_HISTORY Policies
-- =====================================================

-- Parents can read their transfer history
CREATE POLICY "transfer_history_select_parent"
ON enrollment_transfer_history FOR SELECT
USING (
    enrollment_id IN (
        SELECT id FROM enrollments WHERE parent_id = get_parent_id_from_line()
    )
);

-- Admin can manage transfer history
CREATE POLICY "transfer_history_all_admin"
ON enrollment_transfer_history FOR ALL
USING (is_admin());

-- =====================================================
-- TRIAL_BOOKINGS Policies
-- =====================================================

-- Admin can manage trial bookings in their branches
CREATE POLICY "trial_bookings_all_admin"
ON trial_bookings FOR ALL
USING (
    is_admin() AND (
        branch_id IS NULL OR admin_has_branch_access(branch_id)
    )
);

-- =====================================================
-- TRIAL_BOOKING_STUDENTS Policies
-- =====================================================

-- Admin can manage trial booking students
CREATE POLICY "trial_booking_students_all_admin"
ON trial_booking_students FOR ALL
USING (is_admin());

-- =====================================================
-- TRIAL_SESSIONS Policies
-- =====================================================

-- Admin can manage trial sessions in their branches
CREATE POLICY "trial_sessions_all_admin"
ON trial_sessions FOR ALL
USING (is_admin() AND admin_has_branch_access(branch_id));

-- Super admin can manage all trial sessions
CREATE POLICY "trial_sessions_all_super_admin"
ON trial_sessions FOR ALL
USING (is_super_admin());

-- =====================================================
-- TRIAL_RESCHEDULE_HISTORY Policies
-- =====================================================

-- Admin can manage reschedule history
CREATE POLICY "trial_reschedule_all_admin"
ON trial_reschedule_history FOR ALL
USING (is_admin());

-- =====================================================
-- MAKEUP_CLASSES Policies
-- =====================================================

-- Parents can read makeup classes for their children
CREATE POLICY "makeup_classes_select_parent"
ON makeup_classes FOR SELECT
USING (parent_id = get_parent_id_from_line());

-- Admin can manage makeup classes in their branches
CREATE POLICY "makeup_classes_all_admin"
ON makeup_classes FOR ALL
USING (is_admin() AND admin_has_branch_access(branch_id));

-- Super admin can manage all makeup classes
CREATE POLICY "makeup_classes_all_super_admin"
ON makeup_classes FOR ALL
USING (is_super_admin());

-- =====================================================
-- NOTIFICATIONS Policies
-- =====================================================

-- Users can read their own notifications
CREATE POLICY "notifications_select_own"
ON notifications FOR SELECT
USING (
    (user_type = 'parent' AND user_id = get_parent_id_from_line())
    OR (user_type = 'admin' AND user_id = auth.uid())
);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own"
ON notifications FOR UPDATE
USING (
    (user_type = 'parent' AND user_id = get_parent_id_from_line())
    OR (user_type = 'admin' AND user_id = auth.uid())
);

-- Admin can create notifications
CREATE POLICY "notifications_insert_admin"
ON notifications FOR INSERT
WITH CHECK (is_admin());

-- Super admin can manage all notifications
CREATE POLICY "notifications_all_super_admin"
ON notifications FOR ALL
USING (is_super_admin());

-- =====================================================
-- PROMOTIONS Policies
-- =====================================================

-- Anyone can read active promotions
CREATE POLICY "promotions_select_public"
ON promotions FOR SELECT
USING (is_active = true AND start_date <= NOW() AND end_date >= NOW());

-- Admin can read all promotions
CREATE POLICY "promotions_select_admin"
ON promotions FOR SELECT
USING (is_admin());

-- Super admin can manage promotions
CREATE POLICY "promotions_all_super_admin"
ON promotions FOR ALL
USING (is_super_admin());

-- =====================================================
-- HOLIDAYS Policies
-- =====================================================

-- Anyone can read holidays
CREATE POLICY "holidays_select_public"
ON holidays FOR SELECT
USING (true);

-- Admin can manage holidays
CREATE POLICY "holidays_all_admin"
ON holidays FOR ALL
USING (is_admin());

-- =====================================================
-- TEACHING_MATERIALS Policies
-- =====================================================

-- Teachers can read active materials for subjects they teach
CREATE POLICY "teaching_materials_select_teacher"
ON teaching_materials FOR SELECT
USING (
    is_active = true AND EXISTS (
        SELECT 1 FROM teachers t
        JOIN admin_users au ON au.teacher_id = t.id
        WHERE au.id = auth.uid()
        AND subject_id = ANY(t.specialties)
    )
);

-- Admin can manage teaching materials
CREATE POLICY "teaching_materials_all_admin"
ON teaching_materials FOR ALL
USING (is_admin());

-- =====================================================
-- EVENTS Policies
-- =====================================================

-- Anyone can read published/active events
CREATE POLICY "events_select_public"
ON events FOR SELECT
USING (status = 'published' AND is_active = true);

-- Admin can manage events
CREATE POLICY "events_all_admin"
ON events FOR ALL
USING (is_admin());

-- =====================================================
-- EVENT_SCHEDULES Policies
-- =====================================================

-- Anyone can read available schedules
CREATE POLICY "event_schedules_select_public"
ON event_schedules FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_schedules.event_id
        AND events.status = 'published'
        AND events.is_active = true
    )
);

-- Admin can manage event schedules
CREATE POLICY "event_schedules_all_admin"
ON event_schedules FOR ALL
USING (is_admin());

-- =====================================================
-- EVENT_REGISTRATIONS Policies
-- =====================================================

-- Users can read their own registrations
CREATE POLICY "event_registrations_select_own"
ON event_registrations FOR SELECT
USING (
    parent_id = get_parent_id_from_line()
    OR line_user_id = (auth.jwt()->>'sub')
);

-- Users can create registrations
CREATE POLICY "event_registrations_insert_public"
ON event_registrations FOR INSERT
WITH CHECK (true);

-- Users can update/cancel their own registrations
CREATE POLICY "event_registrations_update_own"
ON event_registrations FOR UPDATE
USING (
    parent_id = get_parent_id_from_line()
    OR line_user_id = (auth.jwt()->>'sub')
);

-- Admin can manage all registrations
CREATE POLICY "event_registrations_all_admin"
ON event_registrations FOR ALL
USING (is_admin());

-- =====================================================
-- EVENT_REGISTRATION_PARENTS Policies
-- =====================================================

-- Users can manage their own registration parents
CREATE POLICY "event_reg_parents_select_own"
ON event_registration_parents FOR SELECT
USING (
    registration_id IN (
        SELECT id FROM event_registrations
        WHERE parent_id = get_parent_id_from_line()
        OR line_user_id = (auth.jwt()->>'sub')
    )
);

-- Admin can manage all
CREATE POLICY "event_reg_parents_all_admin"
ON event_registration_parents FOR ALL
USING (is_admin());

-- =====================================================
-- EVENT_REGISTRATION_STUDENTS Policies
-- =====================================================

-- Users can manage their own registration students
CREATE POLICY "event_reg_students_select_own"
ON event_registration_students FOR SELECT
USING (
    registration_id IN (
        SELECT id FROM event_registrations
        WHERE parent_id = get_parent_id_from_line()
        OR line_user_id = (auth.jwt()->>'sub')
    )
);

-- Admin can manage all
CREATE POLICY "event_reg_students_all_admin"
ON event_registration_students FOR ALL
USING (is_admin());

-- =====================================================
-- LINK_TOKENS Policies
-- =====================================================

-- Only the system/admin can manage link tokens
CREATE POLICY "link_tokens_all_admin"
ON link_tokens FOR ALL
USING (is_admin());

-- =====================================================
-- STUDENT_FEEDBACK Policies
-- =====================================================

-- Parents can read feedback for their children
CREATE POLICY "student_feedback_select_parent"
ON student_feedback FOR SELECT
USING (parent_id = get_parent_id_from_line());

-- Admin can manage feedback
CREATE POLICY "student_feedback_all_admin"
ON student_feedback FOR ALL
USING (is_admin());

-- =====================================================
-- SETTINGS Policies
-- =====================================================

-- Admin can read settings
CREATE POLICY "settings_select_admin"
ON settings FOR SELECT
USING (is_admin());

-- Super admin can manage settings
CREATE POLICY "settings_all_super_admin"
ON settings FOR ALL
USING (is_super_admin());

-- =====================================================
-- Service Role Bypass
-- =====================================================
-- Note: Service role bypasses RLS automatically in Supabase
-- Use service role for server-side operations (API routes, webhooks)
