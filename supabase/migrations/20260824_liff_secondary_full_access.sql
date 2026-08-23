-- ผู้รับ LINE คนที่ 2+ (พ่อ/ย่า/พี่) ใช้ portal ได้เต็มเหมือนผู้ปกครองหลัก
-- → ต้องเก็บข้อมูลติดต่อของ "ตัวเขาเอง" ด้วย ไม่ใช่มีแต่ชื่อ LINE
-- (ข้อมูลครอบครัว/ที่อยู่ยังยึดของผู้ปกครองหลักเป็นหลักเหมือนเดิม)
alter table parent_line_recipients
  add column if not exists full_name  text,
  add column if not exists phone      text,
  add column if not exists email      text,
  add column if not exists updated_at timestamptz;

comment on column parent_line_recipients.full_name is 'ชื่อ-นามสกุลจริงของผู้รับคนนี้ (กรอกเอง ไม่ใช่ชื่อ LINE)';
comment on column parent_line_recipients.phone    is 'เบอร์โทรของผู้รับคนนี้';
comment on column parent_line_recipients.email    is 'อีเมลของผู้รับคนนี้';

-- ใครเป็นคน "กดทำรายการ" นี้ — เดิม requested_by เป็น uuid ของ user/parent
-- อย่างเดียว บอกไม่ได้ว่ามาจากช่องทางไหนหรือคนไหนในครอบครัวเป็นคนกด
-- (พ่อกับแม่ใช้ LINE คนละไอดีแต่ผูกครอบครัวเดียวกัน)
alter table makeup_classes
  add column if not exists requested_via         text,
  add column if not exists requested_by_line_id  varchar,
  add column if not exists requested_by_name     text,
  add column if not exists requested_by_role     text;

comment on column makeup_classes.requested_via        is 'ช่องทางที่แจ้ง: liff | admin | attendance';
comment on column makeup_classes.requested_by_line_id is 'LINE user id ของคนที่กดแจ้ง (เฉพาะช่องทาง liff)';
comment on column makeup_classes.requested_by_name    is 'ชื่อคนที่กดแจ้ง ณ ตอนนั้น (snapshot)';
comment on column makeup_classes.requested_by_role    is 'primary = ผู้ปกครองหลัก, secondary = ผู้รับเพิ่มเติม';

-- log ว่าใครทำอะไรผ่าน portal บ้าง (พ่อ/แม่/ผู้รับเพิ่มเติมคนไหน)
-- ใช้ตอบคำถาม "ใครกดลาให้ลูก" / "ใครแก้เบอร์" ย้อนหลังได้ แม้รายการต้นทางจะถูกลบไปแล้ว
create table if not exists liff_activity_log (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references parents(id) on delete cascade,
  actor_line_id varchar,
  actor_name  text,
  actor_role  text,            -- primary | secondary
  action      text not null,   -- leave.request | leave.cancel | profile.update | recipient.update
  student_id  uuid,
  target_id   uuid,            -- makeup id / recipient id ฯลฯ
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists liff_activity_log_parent_idx on liff_activity_log (parent_id, created_at desc);

alter table liff_activity_log enable row level security;  -- service role only
