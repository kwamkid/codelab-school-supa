-- =====================================================
-- Relax RLS Policies for Easier Insert/Update
-- This migration allows authenticated users to perform
-- insert/update operations more easily
-- Also allows anon (public) users to register via LINE LIFF
-- =====================================================

-- =====================================================
-- Drop restrictive policies and create more permissive ones
-- =====================================================

-- PARENTS - Allow anyone to insert (for LINE LIFF registration)
DROP POLICY IF EXISTS "parents_all_admin" ON parents;
DROP POLICY IF EXISTS "parents_update_own" ON parents;
DROP POLICY IF EXISTS "parents_select_own" ON parents;
DROP POLICY IF EXISTS "parents_select_admin" ON parents;

-- Allow public/anon to insert (LINE LIFF registration)
CREATE POLICY "parents_insert_anon"
ON parents FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "parents_insert_authenticated"
ON parents FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow public/anon to update (LINE LIFF profile update)
CREATE POLICY "parents_update_anon"
ON parents FOR UPDATE
TO anon
USING (true);

CREATE POLICY "parents_update_authenticated"
ON parents FOR UPDATE
TO authenticated
USING (true);

-- Allow public/anon to select (for checking existing registration)
CREATE POLICY "parents_select_anon"
ON parents FOR SELECT
TO anon
USING (true);

CREATE POLICY "parents_delete_admin"
ON parents FOR DELETE
USING (is_admin());

-- STUDENTS - Allow anyone to insert (for LINE LIFF registration with children)
DROP POLICY IF EXISTS "students_all_admin" ON students;
DROP POLICY IF EXISTS "students_update_own" ON students;
DROP POLICY IF EXISTS "students_select_own" ON students;

-- Allow public/anon to insert (LINE LIFF registration)
CREATE POLICY "students_insert_anon"
ON students FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "students_insert_authenticated"
ON students FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow public/anon to update
CREATE POLICY "students_update_anon"
ON students FOR UPDATE
TO anon
USING (true);

CREATE POLICY "students_update_authenticated"
ON students FOR UPDATE
TO authenticated
USING (true);

-- Allow public/anon to select
CREATE POLICY "students_select_anon"
ON students FOR SELECT
TO anon
USING (true);

CREATE POLICY "students_delete_admin"
ON students FOR DELETE
USING (is_admin());

-- TEACHERS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "teachers_all_admin" ON teachers;

CREATE POLICY "teachers_insert_authenticated"
ON teachers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "teachers_update_authenticated"
ON teachers FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "teachers_delete_admin"
ON teachers FOR DELETE
USING (is_admin());

-- BRANCHES - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "branches_all_admin" ON branches;

CREATE POLICY "branches_insert_authenticated"
ON branches FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "branches_update_authenticated"
ON branches FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "branches_delete_admin"
ON branches FOR DELETE
USING (is_admin());

-- ROOMS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "rooms_all_admin" ON rooms;

CREATE POLICY "rooms_insert_authenticated"
ON rooms FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "rooms_update_authenticated"
ON rooms FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "rooms_delete_admin"
ON rooms FOR DELETE
USING (is_admin());

-- SUBJECTS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "subjects_all_admin" ON subjects;

CREATE POLICY "subjects_insert_authenticated"
ON subjects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "subjects_update_authenticated"
ON subjects FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "subjects_delete_admin"
ON subjects FOR DELETE
USING (is_admin());

-- CLASSES - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "classes_all_admin" ON classes;
DROP POLICY IF EXISTS "classes_all_super_admin" ON classes;

CREATE POLICY "classes_insert_authenticated"
ON classes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "classes_update_authenticated"
ON classes FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "classes_delete_admin"
ON classes FOR DELETE
USING (is_admin());

-- CLASS_SCHEDULES - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "class_schedules_all_admin" ON class_schedules;

CREATE POLICY "class_schedules_insert_authenticated"
ON class_schedules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "class_schedules_update_authenticated"
ON class_schedules FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "class_schedules_delete_admin"
ON class_schedules FOR DELETE
USING (is_admin());

-- ATTENDANCE - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "attendance_all_admin" ON attendance;

CREATE POLICY "attendance_insert_authenticated"
ON attendance FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "attendance_update_authenticated"
ON attendance FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "attendance_delete_admin"
ON attendance FOR DELETE
USING (is_admin());

-- ENROLLMENTS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "enrollments_all_admin" ON enrollments;
DROP POLICY IF EXISTS "enrollments_all_super_admin" ON enrollments;

CREATE POLICY "enrollments_insert_authenticated"
ON enrollments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "enrollments_update_authenticated"
ON enrollments FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "enrollments_delete_admin"
ON enrollments FOR DELETE
USING (is_admin());

-- ENROLLMENT_TRANSFER_HISTORY - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "transfer_history_all_admin" ON enrollment_transfer_history;

CREATE POLICY "transfer_history_insert_authenticated"
ON enrollment_transfer_history FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "transfer_history_update_authenticated"
ON enrollment_transfer_history FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "transfer_history_delete_admin"
ON enrollment_transfer_history FOR DELETE
USING (is_admin());

-- TRIAL_BOOKINGS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "trial_bookings_all_admin" ON trial_bookings;

CREATE POLICY "trial_bookings_insert_authenticated"
ON trial_bookings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "trial_bookings_update_authenticated"
ON trial_bookings FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "trial_bookings_delete_admin"
ON trial_bookings FOR DELETE
USING (is_admin());

-- TRIAL_BOOKING_STUDENTS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "trial_booking_students_all_admin" ON trial_booking_students;

CREATE POLICY "trial_booking_students_insert_authenticated"
ON trial_booking_students FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "trial_booking_students_update_authenticated"
ON trial_booking_students FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "trial_booking_students_delete_admin"
ON trial_booking_students FOR DELETE
USING (is_admin());

-- TRIAL_SESSIONS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "trial_sessions_all_admin" ON trial_sessions;
DROP POLICY IF EXISTS "trial_sessions_all_super_admin" ON trial_sessions;

CREATE POLICY "trial_sessions_insert_authenticated"
ON trial_sessions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "trial_sessions_update_authenticated"
ON trial_sessions FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "trial_sessions_delete_admin"
ON trial_sessions FOR DELETE
USING (is_admin());

-- TRIAL_RESCHEDULE_HISTORY - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "trial_reschedule_all_admin" ON trial_reschedule_history;

CREATE POLICY "trial_reschedule_insert_authenticated"
ON trial_reschedule_history FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "trial_reschedule_update_authenticated"
ON trial_reschedule_history FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "trial_reschedule_delete_admin"
ON trial_reschedule_history FOR DELETE
USING (is_admin());

-- MAKEUP_CLASSES - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "makeup_classes_all_admin" ON makeup_classes;
DROP POLICY IF EXISTS "makeup_classes_all_super_admin" ON makeup_classes;

CREATE POLICY "makeup_classes_insert_authenticated"
ON makeup_classes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "makeup_classes_update_authenticated"
ON makeup_classes FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "makeup_classes_delete_admin"
ON makeup_classes FOR DELETE
USING (is_admin());

-- NOTIFICATIONS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "notifications_insert_admin" ON notifications;
DROP POLICY IF EXISTS "notifications_all_super_admin" ON notifications;

CREATE POLICY "notifications_insert_authenticated"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "notifications_update_authenticated"
ON notifications FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "notifications_delete_admin"
ON notifications FOR DELETE
USING (is_admin());

-- PROMOTIONS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "promotions_all_super_admin" ON promotions;

CREATE POLICY "promotions_insert_authenticated"
ON promotions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "promotions_update_authenticated"
ON promotions FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "promotions_delete_admin"
ON promotions FOR DELETE
USING (is_admin());

-- HOLIDAYS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "holidays_all_admin" ON holidays;

CREATE POLICY "holidays_insert_authenticated"
ON holidays FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "holidays_update_authenticated"
ON holidays FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "holidays_delete_admin"
ON holidays FOR DELETE
USING (is_admin());

-- TEACHING_MATERIALS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "teaching_materials_all_admin" ON teaching_materials;

CREATE POLICY "teaching_materials_insert_authenticated"
ON teaching_materials FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "teaching_materials_update_authenticated"
ON teaching_materials FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "teaching_materials_delete_admin"
ON teaching_materials FOR DELETE
USING (is_admin());

-- EVENTS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "events_all_admin" ON events;

CREATE POLICY "events_insert_authenticated"
ON events FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "events_update_authenticated"
ON events FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "events_delete_admin"
ON events FOR DELETE
USING (is_admin());

-- EVENT_SCHEDULES - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "event_schedules_all_admin" ON event_schedules;

CREATE POLICY "event_schedules_insert_authenticated"
ON event_schedules FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "event_schedules_update_authenticated"
ON event_schedules FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "event_schedules_delete_admin"
ON event_schedules FOR DELETE
USING (is_admin());

-- EVENT_REGISTRATIONS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "event_registrations_all_admin" ON event_registrations;

CREATE POLICY "event_registrations_update_authenticated"
ON event_registrations FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "event_registrations_delete_admin"
ON event_registrations FOR DELETE
USING (is_admin());

-- EVENT_REGISTRATION_PARENTS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "event_reg_parents_all_admin" ON event_registration_parents;

CREATE POLICY "event_reg_parents_insert_authenticated"
ON event_registration_parents FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "event_reg_parents_update_authenticated"
ON event_registration_parents FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "event_reg_parents_delete_admin"
ON event_registration_parents FOR DELETE
USING (is_admin());

-- EVENT_REGISTRATION_STUDENTS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "event_reg_students_all_admin" ON event_registration_students;

CREATE POLICY "event_reg_students_insert_authenticated"
ON event_registration_students FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "event_reg_students_update_authenticated"
ON event_registration_students FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "event_reg_students_delete_admin"
ON event_registration_students FOR DELETE
USING (is_admin());

-- LINK_TOKENS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "link_tokens_all_admin" ON link_tokens;

CREATE POLICY "link_tokens_insert_authenticated"
ON link_tokens FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "link_tokens_update_authenticated"
ON link_tokens FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "link_tokens_delete_admin"
ON link_tokens FOR DELETE
USING (is_admin());

-- STUDENT_FEEDBACK - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "student_feedback_all_admin" ON student_feedback;

CREATE POLICY "student_feedback_insert_authenticated"
ON student_feedback FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "student_feedback_update_authenticated"
ON student_feedback FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "student_feedback_delete_admin"
ON student_feedback FOR DELETE
USING (is_admin());

-- SETTINGS - Allow authenticated users to insert/update
DROP POLICY IF EXISTS "settings_all_super_admin" ON settings;

CREATE POLICY "settings_insert_authenticated"
ON settings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "settings_update_authenticated"
ON settings FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "settings_delete_admin"
ON settings FOR DELETE
USING (is_admin());

-- ADMIN_USERS - Allow authenticated users to insert/update (for self-registration)
DROP POLICY IF EXISTS "admin_users_all_super_admin" ON admin_users;

CREATE POLICY "admin_users_insert_authenticated"
ON admin_users FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "admin_users_update_authenticated"
ON admin_users FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "admin_users_delete_super_admin"
ON admin_users FOR DELETE
USING (is_super_admin());

-- =====================================================
-- Add SELECT policies for authenticated users
-- =====================================================

-- Allow authenticated users to read all data (for admin dashboard)
CREATE POLICY "parents_select_authenticated"
ON parents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "students_select_authenticated"
ON students FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "teachers_select_authenticated"
ON teachers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "branches_select_authenticated"
ON branches FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "rooms_select_authenticated"
ON rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "subjects_select_authenticated"
ON subjects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "classes_select_authenticated"
ON classes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "class_schedules_select_authenticated"
ON class_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "attendance_select_authenticated"
ON attendance FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "enrollments_select_authenticated"
ON enrollments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "transfer_history_select_authenticated"
ON enrollment_transfer_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "trial_bookings_select_authenticated"
ON trial_bookings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "trial_booking_students_select_authenticated"
ON trial_booking_students FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "trial_sessions_select_authenticated"
ON trial_sessions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "trial_reschedule_select_authenticated"
ON trial_reschedule_history FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "makeup_classes_select_authenticated"
ON makeup_classes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "notifications_select_authenticated"
ON notifications FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "promotions_select_authenticated"
ON promotions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "teaching_materials_select_authenticated"
ON teaching_materials FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "events_select_authenticated"
ON events FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "event_schedules_select_authenticated"
ON event_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "event_registrations_select_authenticated"
ON event_registrations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "event_reg_parents_select_authenticated"
ON event_registration_parents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "event_reg_students_select_authenticated"
ON event_registration_students FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "link_tokens_select_authenticated"
ON link_tokens FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "student_feedback_select_authenticated"
ON student_feedback FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "settings_select_authenticated"
ON settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin_users_select_authenticated"
ON admin_users FOR SELECT
TO authenticated
USING (true);
