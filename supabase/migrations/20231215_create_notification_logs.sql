-- Create notification_logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'class-reminder', 'makeup-reminder', 'makeup-scheduled', etc.
  recipient_type TEXT NOT NULL, -- 'parent', 'student', 'teacher'
  recipient_id UUID, -- parent_id, student_id, or teacher_id
  recipient_name TEXT,
  line_user_id TEXT,
  student_id UUID,
  student_name TEXT,
  class_id UUID,
  class_name TEXT,
  schedule_id UUID,
  makeup_id UUID,
  message_preview TEXT, -- Preview of the message
  status TEXT NOT NULL, -- 'success', 'failed'
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_id ON notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_student_id ON notification_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_class_id ON notification_logs(class_id);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to do everything
CREATE POLICY "Service role can do everything on notification_logs"
  ON notification_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for authenticated users to read
CREATE POLICY "Authenticated users can read notification_logs"
  ON notification_logs
  FOR SELECT
  TO authenticated
  USING (true);
