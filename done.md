# Done Log

## 2026-03-18

### Bug Fixes
- **แก้ enrolled_count เบิ้ล** — เปลี่ยนจาก increment/decrement (+1/-1) ที่มี race condition เป็นนับจริงจาก enrollments table ทุกครั้ง (`fixEnrolledCount`) ใน `createEnrollment`, `dropEnrollment`, `transferEnrollment`, `checkAvailableSeats` + auto-fix ในหน้า class detail
- **แก้ Login ไม่ได้หลังเปิด RLS** — สร้าง API route `/api/auth/lookup` ใช้ service role key แทน anon key ที่โดน RLS block ใน `useSupabaseAuth`

### Security
- **เปิด RLS** บน 11 tables ที่ Supabase เตือน: `admin_users`, `payment_transactions`, `branch_payment_settings`, `invoice_companies`, `receipts`, `chat_channels`, `chat_contacts`, `chat_conversations`, `chat_quick_replies`, `chat_messages`, `backup_logs`
- เพิ่ม policy: `authenticated` = SELECT, `service_role` = ALL

### Meta App Review
- **อัพเดท Privacy Policy** (`/privacy-policy`) — เพิ่มชื่อบริษัท KID POWER COMPANY LIMITED, Tax ID, ที่อยู่, section Facebook/Instagram Data, Data Deletion, Changes to Policy
- **สร้างหน้า Data Deletion** (`/data-deletion`) — ขั้นตอนขอลบข้อมูล, วิธีติดต่อ, เวลาดำเนินการ 30 วัน
- **แนะนำลด permission** จาก 6 → 3 ตัว (`pages_show_list`, `pages_manage_metadata`, `pages_messaging`) เพื่อให้ review ผ่านง่ายขึ้น
- **แนะนำขั้นตอน** กรอก reviewer instructions, test credentials, screencast

### Feature Changes
- **แก้ flow ออกใบกำกับภาษี** — บริษัทจด VAT ออกใบกำกับภาษี/ใบเสร็จทุกครั้ง (run เลขชุดเดียวกัน):
  - ติ๊ก "ระบุข้อมูลออกใบกำกับภาษี" → ใช้ข้อมูล billing จากฟอร์ม (ชื่อ, ที่อยู่, taxId, สาขา)
  - ไม่ติ๊ก → ใช้ชื่อ-ที่อยู่ผู้ปกครองอัตโนมัติ ไม่มี taxId
  - บริษัทไม่จด VAT → ออกใบเสร็จรับเงินเหมือนเดิม

### Performance
- **เร่ง Dashboard** — สร้าง RPC `get_dashboard_stats` (1 SQL call แทน 7+ round trips) แก้ปัญหา `getOptimizedDashboardStats` เรียก `getOptimizedCalendarEvents` ซ้ำแค่เพื่อนับคลาสวันนี้
