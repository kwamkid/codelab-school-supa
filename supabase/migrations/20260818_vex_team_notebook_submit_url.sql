-- Engineering Notebook มี 2 ลิงก์ต่อทีม (เจ้าของยืนยัน 18 ส.ค. 26):
--   notebook_url        = ฉบับที่กำลังทำอยู่ (Canva / Google Slides — แก้ไขได้เรื่อย ๆ)
--   notebook_submit_url = ฉบับที่ส่งจริง (export PDF แล้วอัปขึ้น Google Drive)
-- แยกกันเพราะเล่มที่ใช้ส่งต้องนิ่ง ห้ามแก้หลังส่ง ส่วนเล่มร่างยังทำต่อได้
alter table vex.teams add column if not exists notebook_submit_url text;

comment on column vex.teams.notebook_url is
  'ลิงก์ Engineering Notebook ฉบับกำลังทำ (Canva/Slides)';
comment on column vex.teams.notebook_submit_url is
  'ลิงก์ Engineering Notebook ฉบับส่งจริง (PDF บน Google Drive)';
