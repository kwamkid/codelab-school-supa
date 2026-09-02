-- ฝึกเขียนโค้ดบน VEX VR (vr.vex.com) — ทุกทีมเข้าลิงก์เดียวกัน แต่ล็อกอินด้วย
--   1) หมายเลขทีม (มีอยู่แล้วที่ team_number)
--   2) Virtual Skills Key ประจำทีม เช่น 24PV9X
alter table vex.teams add column if not exists vr_skills_key text;

comment on column vex.teams.vr_skills_key is
  'Virtual Skills Key สำหรับล็อกอิน vr.vex.com คู่กับ team_number';
