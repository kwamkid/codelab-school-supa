-- ครูผู้ดูแลทีม VEX — ครูหลัก 1 คนต่อทีม (เจ้าของยืนยัน: เอาแค่คนหลัก).
-- เก็บ public.teachers.id แบบไม่มี cross-schema FK (แนวเดียวกับ vex.kids.student_id
-- และ vex.practices.parent_id ที่อ้าง public.* อยู่แล้ว).
-- ใช้ใน 2 ที่: แสดงบนตารางซ้อม/ลิสต์ทีม (ครูรู้ว่าวันไหนมีเด็กของตัวเองมาซ้อม)
-- และเป็นปลายทางของ LINE noti ครู (เฟสถัดไป).
alter table vex.teams add column if not exists coach_teacher_id uuid;

create index if not exists teams_coach_teacher_id_idx on vex.teams (coach_teacher_id);
