-- Backfill admin_users.teacher_id for teacher accounts.
-- Historically teacher login accounts (admin_users.role = 'teacher') were created
-- without linking to their teachers profile row, so admin_users.teacher_id was NULL
-- for every teacher. This broke any feature relying on the link (teacher profile load,
-- the teacher home page). Link by matching email (verified 1:1, no ambiguous matches).
UPDATE admin_users au
SET teacher_id = t.id
FROM teachers t
WHERE au.role = 'teacher'
  AND au.teacher_id IS NULL
  AND lower(t.email) = lower(au.email);
