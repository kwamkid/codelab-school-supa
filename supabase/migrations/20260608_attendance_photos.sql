-- Attendance feedback photos
-- Teachers can attach photos (e.g. student work) to each attendance record.
-- Photos are resized client-side and uploaded only on save (confirm), then their
-- public URLs are stored here.

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}';

-- Public bucket for attendance feedback photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;
