-- ผู้รับแจ้งเตือน LINE เพิ่มเติมของครอบครัว (พ่อ/แม่/ผู้ปกครองคนที่ 2+)
-- parents.line_user_id ยังเป็นผู้รับหลักเหมือนเดิม — ตารางนี้เป็นผู้รับ "พ่วง" เท่านั้น
-- Row เริ่มจากสถานะคำเชิญ (invite_token set, line_user_id null) → คนที่กดลิงก์
-- เชิญใน LINE จะถูกบันทึก line_user_id + โปรไฟล์ลงแถวเดิม (accepted_at set)
create table if not exists parent_line_recipients (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  label text,                         -- 'พ่อ' | 'แม่' | ข้อความอิสระ
  line_user_id varchar,               -- null จนกว่าจะกดรับคำเชิญ
  display_name text,                  -- ชื่อโปรไฟล์ LINE ของผู้รับ
  picture_url text,
  invite_token varchar unique,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- กันผูก LINE เดิมซ้ำในครอบครัวเดียวกัน
create unique index if not exists parent_line_recipients_parent_line_uniq
  on parent_line_recipients (parent_id, line_user_id) where line_user_id is not null;
create index if not exists parent_line_recipients_parent_idx
  on parent_line_recipients (parent_id);

-- service-role เท่านั้น (ไม่มี policy — ทุกอย่างผ่าน /api/liff/* + adminMutation)
alter table parent_line_recipients enable row level security;
