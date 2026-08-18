-- Engineering Notebook ของแต่ละทีม VEX — เก็บลิงก์เดียวต่อทีม
-- (Canva / Google Drive / อะไรก็ได้ที่เปิดดูได้) เพื่อให้ครูและแอดมินเปิดดูจากที่เดียว
-- แทนที่จะกระจายอยู่ในแชทของแต่ละบ้าน
alter table vex.teams add column if not exists notebook_url text;

comment on column vex.teams.notebook_url is
  'ลิงก์ Engineering Notebook ของทีม (Canva/Drive/ฯลฯ) — 1 ทีม 1 ลิงก์';
