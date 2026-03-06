-- Fix: Allow re-enrollment after cancellation/transfer
-- Drop the absolute unique constraint and replace with a partial unique index
-- that only enforces uniqueness for active/completed enrollments

-- Drop existing absolute unique constraint
ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_student_id_class_id_key;

-- Create partial unique index: only prevent duplicates for active/completed enrollments
CREATE UNIQUE INDEX enrollments_student_class_active_unique
  ON public.enrollments (student_id, class_id)
  WHERE status IN ('active', 'completed');
