# CodeLab Teaching — Revised Implementation Plan (v1)

> ปรับจาก `codelab-teaching-app-spec.md` ให้ตรงกับโครงสร้างจริงของระบบเดิม
> ตัดสินใจร่วมกัน 2026-06-01 · เจ้าของ: คุณแอม

## Decisions (finalized)

| หัวข้อ | สรุป |
|---|---|
| Slide format | **Canva link เท่านั้น** (เหมือนระบบเดิม) — เก็บ `canva_url`/`embed_url`; viewer embed Canva หลัง login. ตัด HTML deck/Storage/private-route ทิ้งทั้งหมด |
| Hierarchy | **subject → session → workshops/homework** (ไม่มี tracks/courses/levels) |
| "track" | = `subjects.category` เดิม (Coding/Robotics/AI/Other) ใช้จัดกลุ่มใน catalog |
| "level" | subject แยก level อยู่แล้ว (เช่น Python 1 / Python 2 = คนละ subject) |
| session table | **ต่อยอด `teaching_materials` เดิม** (ว่าง 0 แถว) ไม่ต้อง migrate ข้อมูล |
| roles | ใช้ `admin_users.role = teacher` เดิม — ไม่มี `user_roles` ใหม่ |
| spec `classes` (cohort) | **ตัดทิ้ง** — ใช้ class/enrollment เดิม (ไม่ชนกับ `classes` 208 แถว) |
| ของเดิม สื่อการสอน + Slides | **แทนที่** ด้วยระบบใหม่ (เมนูเก่า 2 อันถูกแทน) |
| Phase 1 scope | ครบ MVP ครู: catalog + session detail + slide viewer (hybrid) + workshop download + authoring (admin) |

## Data Model

### Extend `teaching_materials` (= "session")
เพิ่มคอลัมน์:
```sql
alter table public.teaching_materials
  add column if not exists why_this_matters text,
  add column if not exists tools jsonb default '[]';  -- [{name, status:'new'|'recycled', ref}]
```
ใช้ field เดิม: `subject_id`, `session_number`, `title`, `description`, `objectives[]` (= LO), `duration`, `teaching_notes`, `tags[]`, **`canva_url`/`embed_url` (= slide)**, `is_active`.

### New `session_workshops`
```sql
create table public.session_workshops (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.teaching_materials(id) on delete cascade,
  kind text not null check (kind in ('W1','W2','Mini','Project')),
  title text not null,
  description text,
  duration_minutes int,
  files jsonb default '[]',          -- [{filename, url, type, description}] — url = public link (Drive/public file), เด็กเปิดได้ไม่ต้อง login
  expected_output text,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (material_id, kind)
);
```

### New `session_homework`
```sql
create table public.session_homework (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.teaching_materials(id) on delete cascade,
  tier text not null check (tier in ('HW1','HW2','HW3')),
  title text not null,
  brief text,
  criteria text,
  hint text,
  duration_minutes int,
  is_optional boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (material_id, tier)
);
```

### (optional) Extend `subjects` for catalog display
```sql
alter table public.subjects
  add column if not exists total_sessions int default 12,
  add column if not exists hours_per_session numeric(3,1);
```

### Slides + Workshop files
- **Slides:** Canva link (`teaching_materials.canva_url` → `embed_url`). ไม่มี file storage. Viewer embed Canva หลัง login (reuse `secure-slide-viewer.tsx`).
- **Workshop/HW files:** เก็บเป็น URL ใน `session_workshops.files` (Google Drive / public file) — public, เด็กเปิดได้ด้วยลิงก์ ไม่ต้อง login. ไม่มี authed route / private folder / Storage bucket.

### Quizzes / Live = Phase 2-3 (ยังไม่ทำ)

## Routes (อยู่ใต้ (admin) layout เดิม + sidebar เดิม)

| Path | หน้า |
|---|---|
| `/teaching/courses` | Catalog — subjects จัดกลุ่มตาม category |
| `/teaching/courses/[subjectId]` | รายการ session (ตาราง) + "เพิ่ม session" |
| `/teaching/sessions/[materialId]` | Session detail ⭐ — LO, workshops, homework, tools, ปุ่ม "เปิด Slide" |
| `/teaching/sessions/[materialId]/slide` | Slide viewer fullscreen (HTML iframe หรือ Canva) |
| `/teaching/sessions/[materialId]/edit` | Authoring — กรอกเนื้อหา + upload slide/workshop |

แทนที่ `/teaching-materials/*` และ `/teaching/slides/*` เดิม · sidebar: ยุบ "สื่อการสอน" + "Slides & เนื้อหา" → กลุ่ม "การสอน"

## Build Steps (Phase 1)

1. **Migration** — extend teaching_materials (+why_this_matters, +tools) + subjects; create session_workshops + session_homework (ไม่มี storage bucket)
2. **Services** — `lib/services/teaching/` : sessions (extend), workshops, homework + upload helpers
3. **Catalog** `/teaching/courses` — subjects by category (reuse subject card pattern)
4. **Session list** `/teaching/courses/[subjectId]` — table 12 sessions + add
5. **Session detail** `/teaching/sessions/[materialId]` — LO / workshops (2×2) / homework (3 tiers) / tools / "เปิด Slide" + downloads
6. **Slide viewer** `/teaching/sessions/[materialId]/slide` — Canva embed (reuse `secure-slide-viewer`)
7. **Authoring UI** — create/edit session + workshops + homework; ใส่ Canva URL + workshop file links (reuse ฟอร์ม teaching-materials เดิม)
8. **Sidebar** — replace old 2 menu items
9. **(later) Seed** Python F1–F3 จาก V6.xlsx (สคริปต์แยก, ต้องไฟล์ xlsx)

## Open / Later
- Seed pipeline จาก V6.xlsx (Phase 1.5)
- เชื่อม `class_schedules.session_number` → teaching_materials เพื่อโชว์ "คาบนี้สอนอะไร" ในตารางสอน
- Quiz authoring + results (Phase 2), Live quiz (Phase 3)
- RLS policies (teachers read published) — ตอนนี้ใช้ adminMutation/service role เหมือนระบบเดิม
