-- Migration: Fix schema issues discovered during data migration
-- Date: 2025-12-01

-- ============================================
-- FIX 1: Increase parents.address_house_number length
-- ============================================
-- Some Thai addresses have full address in house_number field (79+ chars)
ALTER TABLE parents ALTER COLUMN address_house_number TYPE VARCHAR(255);

-- ============================================
-- FIX 2: Increase parents.address_street length
-- ============================================
ALTER TABLE parents ALTER COLUMN address_street TYPE VARCHAR(255);

-- ============================================
-- FIX 3: Increase parents.display_name length (for safety)
-- ============================================
ALTER TABLE parents ALTER COLUMN display_name TYPE VARCHAR(200);

-- ============================================
-- FIX 4: Increase teachers.display_name length (for consistency)
-- ============================================
ALTER TABLE teachers ALTER COLUMN display_name TYPE VARCHAR(200);

-- Note: holidays.branches column name is kept as-is
-- The service layer has been updated to use 'branches' instead of 'branch_ids'
