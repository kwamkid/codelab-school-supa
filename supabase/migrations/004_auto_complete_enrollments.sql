-- =====================================================
-- Auto Complete Enrollments When Class Completes
-- This trigger automatically updates enrollment status
-- when a class is marked as completed or cancelled
-- =====================================================

-- Function to update enrollment status when class status changes
CREATE OR REPLACE FUNCTION update_enrollments_on_class_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When class is marked as completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE enrollments
    SET status = 'completed',
        updated_at = NOW()
    WHERE class_id = NEW.id
      AND status = 'active';

    RAISE NOTICE 'Updated enrollments to completed for class %', NEW.id;
  END IF;

  -- When class is marked as cancelled, mark active enrollments as dropped
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE enrollments
    SET status = 'dropped',
        notes = COALESCE(notes, '') || ' [คลาสถูกยกเลิก]',
        updated_at = NOW()
    WHERE class_id = NEW.id
      AND status = 'active';

    RAISE NOTICE 'Updated enrollments to dropped for cancelled class %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on classes table
DROP TRIGGER IF EXISTS trigger_update_enrollments_on_class_complete ON classes;

CREATE TRIGGER trigger_update_enrollments_on_class_complete
  AFTER UPDATE OF status ON classes
  FOR EACH ROW
  EXECUTE FUNCTION update_enrollments_on_class_status_change();

-- =====================================================
-- Also create a function to manually sync all enrollments
-- (useful for fixing existing data)
-- =====================================================

CREATE OR REPLACE FUNCTION sync_all_enrollment_statuses()
RETURNS TABLE (
  updated_count INT,
  class_id UUID,
  class_name TEXT,
  new_status TEXT
) AS $$
DECLARE
  rec RECORD;
  count_updated INT;
BEGIN
  -- Update enrollments for completed classes
  FOR rec IN
    SELECT c.id, c.name
    FROM classes c
    WHERE c.status = 'completed'
  LOOP
    UPDATE enrollments e
    SET status = 'completed',
        updated_at = NOW()
    WHERE e.class_id = rec.id
      AND e.status = 'active';

    GET DIAGNOSTICS count_updated = ROW_COUNT;

    IF count_updated > 0 THEN
      RETURN QUERY SELECT count_updated, rec.id, rec.name, 'completed'::TEXT;
    END IF;
  END LOOP;

  -- Update enrollments for cancelled classes
  FOR rec IN
    SELECT c.id, c.name
    FROM classes c
    WHERE c.status = 'cancelled'
  LOOP
    UPDATE enrollments e
    SET status = 'dropped',
        notes = COALESCE(e.notes, '') || ' [คลาสถูกยกเลิก]',
        updated_at = NOW()
    WHERE e.class_id = rec.id
      AND e.status = 'active';

    GET DIAGNOSTICS count_updated = ROW_COUNT;

    IF count_updated > 0 THEN
      RETURN QUERY SELECT count_updated, rec.id, rec.name, 'dropped'::TEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Add updated_at column to enrollments if not exists
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE enrollments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- =====================================================
-- Run sync once to fix existing data
-- =====================================================

-- Uncomment to run manually:
-- SELECT * FROM sync_all_enrollment_statuses();
