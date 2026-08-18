-- แคชสถานะ "เพิ่ม LINE OA เป็นเพื่อนแล้วหรือยัง" ของผู้ปกครอง
--
-- ทำไมต้องแคช: เช็คได้ทางเดียวคือถาม LINE ทีละ userId
-- (GET /v2/bot/profile → 200 = เพื่อน, 404 = ไม่ใช่ ดู lib/line/friendship.ts)
-- หน้ารายชื่อผู้ปกครองมี 200+ แถว จะยิง API สดทุกครั้งไม่ไหว
--
-- ค่า: 'friend' | 'not_friend' | 'unknown' (เช็คไม่ได้ตอนนั้น)
-- null = ยังไม่เคยเช็ค — UI ต้องไม่แสดงว่า "ไม่ได้แอด" กับกรณีนี้
-- อัปเดตโดย cron รายวัน (/api/cron/reminders) และปุ่มสแกนในหน้ารายชื่อผู้ปกครอง
alter table parents add column if not exists line_friend_state text;
alter table parents add column if not exists line_friend_checked_at timestamptz;

comment on column parents.line_friend_state is
  'friend|not_friend|unknown — เพิ่ม LINE OA เป็นเพื่อนแล้วหรือยัง (null = ยังไม่เคยเช็ค)';
