-- Outbox queue for LINE notifications. Rows are enqueued on save (reliable),
-- then sent by a processor (immediate best-effort + hourly cron safety net).
CREATE TABLE IF NOT EXISTS line_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'feedback',     -- feedback | makeup | custom (extensible)
  schedule_id uuid,                          -- feedback: the session
  student_id uuid,                           -- feedback: the student
  ref_id uuid,                               -- generic ref (e.g. makeup id)
  payload jsonb,                             -- generic params (e.g. {kind} or {to, messages})
  status text NOT NULL DEFAULT 'pending',    -- pending | sent | failed
  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_line_queue_status_created
  ON line_notification_queue (status, created_at);

CREATE INDEX IF NOT EXISTS idx_line_queue_feedback_target
  ON line_notification_queue (type, schedule_id, student_id, status);

ALTER TABLE line_notification_queue ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) touches this table.
