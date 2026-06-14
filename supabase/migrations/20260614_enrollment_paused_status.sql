-- "Pause" (freeze) feature: a student can temporarily stop attending (e.g. travel
-- abroad for a month) then resume later. Add a 'paused' enrollment status so it's
-- distinct from 'dropped' (permanent leave). The missed sessions during a pause
-- become makeup-class credits (created in app code, not here).
ALTER TYPE enrollment_status ADD VALUE IF NOT EXISTS 'paused';
