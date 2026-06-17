-- Whole-class pause: window markers on classes + per-session time override.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS pause_from date NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS pause_to   date NULL;

-- Per-session time override (manual resume editor lets admin set time per session).
ALTER TABLE class_schedules ADD COLUMN IF NOT EXISTS actual_start_time time NULL;
ALTER TABLE class_schedules ADD COLUMN IF NOT EXISTS actual_end_time   time NULL;
