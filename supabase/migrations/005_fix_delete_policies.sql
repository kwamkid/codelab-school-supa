-- =====================================================
-- Fix Delete Policies for Students and Parents
-- This migration updates the delete policies to work
-- correctly with super_admin users
-- =====================================================

-- Drop existing delete policies
DROP POLICY IF EXISTS "students_delete_admin" ON students;
DROP POLICY IF EXISTS "parents_delete_admin" ON parents;

-- Create new delete policies that allow super_admin to delete
-- For students: super_admin can delete any student
CREATE POLICY "students_delete_super_admin"
ON students FOR DELETE
TO authenticated
USING (is_super_admin());

-- For parents: super_admin can delete any parent
CREATE POLICY "parents_delete_super_admin"
ON parents FOR DELETE
TO authenticated
USING (is_super_admin());

-- =====================================================
-- Verify the is_super_admin function exists and works
-- =====================================================

-- Make sure the function returns true for super admins
-- This is already defined in 002, but let's ensure it's correct
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
