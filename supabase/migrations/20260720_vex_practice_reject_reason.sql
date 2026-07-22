-- เหตุผลที่แอดมินไม่อนุมัติคำขอซ้อม — บังคับกรอกใน UI/route ตอน reject,
-- แนบไปกับ LINE noti และแสดงในลิสต์คำขอ + หน้า team ของผู้ปกครอง.
-- เคลียร์เป็น null เมื่อสถานะถูกเปลี่ยนกลับ (approved/proposed).
alter table vex.practices add column if not exists reject_reason text;
