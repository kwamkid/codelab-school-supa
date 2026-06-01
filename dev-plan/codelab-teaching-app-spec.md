# CodeLab Thailand — Teaching App Spec

> เอกสารสำหรับนำไปต่อยอด/พัฒนาบน `app.codelabthailand.com` (Next.js + Supabase ของเดิม)
> เวอร์ชัน: v0.1 · 2026-06-01 · เจ้าของ: คุณแอม (AMGO)

---

## 1. Overview

### 1.1 Purpose

CodeLab Teaching เป็นส่วนขยายของ `app.codelabthailand.com` ที่ใช้ภายในสำหรับ **ครูของ CodeLab Thailand** เปิดสอนในห้องเรียน — แสดง slide deck บนจอใหญ่, แจกไฟล์ workshop, รัน quiz ในคาบ และเก็บผลลัพธ์เป็นข้อมูล analytic ของห้อง

ในระยะยาว ระบบจะขยายออกสู่ student/parent portal เพื่อให้เด็กดู progress ตัวเอง และผู้ปกครองเห็นผลงานลูก

### 1.2 Primary Users (Phase 1 MVP)

- **ครู** — primary user · เปิด slide ในห้อง · แจก workshop file · host live quiz · ดู quiz results

ใน phase ถัดไปจะรองรับ student, parent, admin

### 1.3 Scope ที่ครอบคลุม

10 หลักสูตรหลักของ CodeLab Thailand (3 tracks):

| Track | Course | Levels | Sessions/Level | Hours/Session |
|---|---|---|---|---|
| Robotics | VEX GO | 3 | 12 | 2 |
| Robotics | VEX IQ | 3 + Pre-Comp + Comp | 12 / 16 / 30 | 2 / 3 / 4 |
| Robotics | VEX V5 | 3 + Pre-Comp + Comp | 12 / 16 / 30 | 3 / 3 / 4 |
| Coding | **Python** ✅ | 3 (F1/F2/F3) | 12 | 2 |
| Coding | MakerZero | 3 (microBlock/Python/C++) | 12 | 2 |
| Drone | Drone Coding | หลาย Levels | 8 | 2 |
| Camp | Seasonal Workshops | ตามรอบ | varies | varies |

**Content พร้อมใช้ใน MVP:** Python F1/F2/F3 (36 sessions ครบ Topic + LO + Workshops + HW + Tools + Onboarding)

### 1.4 ไม่อยู่ใน scope (Phase 1)

- Student dashboard / Parent dashboard
- HW submission
- Live quiz (Phase 3)
- Admin CMS
- Billing / Booking (ใช้ของเดิม `app.codelabthailand.com`)

---

## 2. Tech Stack

### 2.1 Frontend

| Layer | Tool | หมายเหตุ |
|---|---|---|
| Framework | **Next.js 14+** App Router | เหมือนระบบเดิม |
| Language | TypeScript (strict mode) | |
| Styling | Tailwind CSS | |
| UI components | shadcn/ui (Radix-based) | |
| Icons | **Tabler Icons** ผ่าน `@tabler/icons-react` หรือ `lucide-react` | ไม่ใช้ emoji ใน UI |
| Forms | React Hook Form + Zod | |
| Data fetching | TanStack Query (React Query) | client-side cache |
| Slide rendering | iframe (Phase 1) → React component (Phase 2+) | |

### 2.2 Backend / Infra

| Layer | Tool | หมายเหตุ |
|---|---|---|
| Database | **Supabase Postgres** (shared กับ app เดิม) | |
| Auth | **Supabase Auth** | email + Google OAuth |
| Session sharing | `@supabase/ssr` + cookie domain `.codelabthailand.com` | SSO |
| File storage | Supabase Storage | slide HTML + workshop .py |
| Realtime (Phase 3) | Supabase Realtime channels | live quiz |
| RLS | Supabase Row Level Security | role-based access |
| Migrations | Supabase CLI (SQL files in repo) | |
| Deploy | Vercel | |

### 2.3 Typography

ใช้ font 4 ตัวตาม CodeLab brand guideline:

```css
--font-display: "Space Grotesk"      /* Heading EN — hero, title */
--font-sans-th: "IBM Plex Sans Thai" /* Body หลัก (ไทย) */
--font-sans-en: "IBM Plex Sans"      /* Body Latin */
--font-mono:    "JetBrains Mono"     /* Code, eyebrow, label */
```

โหลดผ่าน `next/font/google` หรือ `@fontsource/*` (pin version)

### 2.4 Color Palette

ตาม `06-Design-System/assets/tokens.css` ของ CodeLab:

```css
--red:    #ef443a   /* Primary — CTA, cover slide, brand */
--ink:    #0a0a0b   /* Text หลัก, parent slide bg */
--cream:  #fff8f3   /* Background หลัก */
--yellow: #ffc94a   /* Highlight, HW2 (เก่ง) */
--mint:   #5dd49e   /* Success, HW1 (บังคับ) */
--sky:    #2563eb   /* Quiz slide, info */
--plum:   #8b5cf6   /* Workshop slide */
--pink:   #ff7ac6   /* Accent น้อยมาก */
```

ทุกสีต้อง map กับ Tailwind theme + รองรับ dark mode (TBD)

---

## 3. System Architecture

### 3.1 Domain Plan

ปัจจุบันรับ scope ใหม่ที่จะ embed เข้า `app.codelabthailand.com` แทนการแยก subdomain:

```
app.codelabthailand.com/teach/...  ← teaching pages (new)
app.codelabthailand.com/liff/...   ← trial booking (existing)
app.codelabthailand.com/...        ← dashboard, profile (existing)
```

**ทุกอย่างอยู่ใน Next.js app เดียวกัน + Supabase project เดียวกัน → ไม่มีปัญหา cross-domain auth**

### 3.2 Route Group Structure (Next.js App Router)

```
app/
├── (marketing)/              ← public pages
├── (auth)/
│   ├── login/
│   └── callback/
├── (app)/                    ← existing — user portal
│   ├── liff/trial/
│   └── dashboard/
└── (teach)/                  ← NEW — teaching pages
    ├── teach/
    │   ├── page.tsx          → /teach (teacher dashboard)
    │   ├── courses/
    │   │   ├── page.tsx      → /teach/courses
    │   │   └── [courseSlug]/
    │   │       ├── page.tsx  → /teach/courses/python
    │   │       └── [levelSlug]/
    │   │           └── sessions/[sessionId]/
    │   │               ├── page.tsx          → session detail
    │   │               ├── slide/page.tsx    → slide viewer
    │   │               └── live/page.tsx     → live quiz host
    │   └── quiz/[quizId]/results/
```

### 3.3 Auth Flow

```
User on app.codelabthailand.com → Login (email/Google)
   │
   ▼
Supabase Auth → set cookie (domain: .codelabthailand.com, httpOnly, secure)
   │
   ▼
User navigates to /teach/...
   │
   ▼
Middleware reads cookie → Supabase getSession() server-side
   │
   ▼
ถ้า role.teacher → allow
ถ้า role.student → redirect /dashboard
ถ้าไม่มี role → ขอ admin assign
```

Implementation:
- `middleware.ts` ตรวจ session + role ก่อนเข้า `/teach/*`
- `@supabase/ssr` สำหรับ SSR cookie handling
- Role เก็บใน `user_roles` table (ไม่ใช่ `auth.users.user_metadata`)

---

## 4. Data Model

### 4.1 Schema overview

7 tables ใหม่ที่ต้องเพิ่มใน Supabase project:

```sql
-- ========= 1. tracks =========
create table public.tracks (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,        -- 'robotics' | 'coding' | 'drone' | 'camp'
  name          text not null,               -- 'Robotics', 'Coding & Maker', ...
  color         text not null,               -- hex color
  icon          text not null,               -- tabler icon name e.g. 'robot'
  sort_order    int default 0,
  created_at    timestamptz default now()
);

-- ========= 2. courses =========
create table public.courses (
  id                    uuid primary key default gen_random_uuid(),
  track_id              uuid not null references public.tracks(id) on delete restrict,
  slug                  text unique not null,           -- 'python', 'vex-go', 'vex-iq-pre-comp'
  name                  text not null,                  -- 'Python'
  name_en               text,
  age_min               int,
  age_max               int,
  course_type           text not null check (course_type in ('level_based','pre_comp','competition','short')),
  total_levels          int default 1,                  -- Python = 3, Pre-Comp = 1
  sessions_per_level    int not null,                   -- Python = 12, Pre-Comp = 16
  hours_per_session     numeric(3,1),                   -- Python = 2.0
  price_per_level       int,                            -- THB
  color                 text,                           -- override track color
  description           text,
  is_published          boolean default false,
  created_at            timestamptz default now()
);

-- ========= 3. levels =========
create table public.levels (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  number        int not null,                  -- 1, 2, 3
  slug          text not null,                 -- 'f1', 'f2', 'f3'
  name          text not null,                 -- 'The Commander'
  name_en       text,
  short_label   text,                          -- 'F1'
  color         text,
  description   text,
  goal          text,
  unique (course_id, number)
);

-- ========= 4. sessions =========
create table public.sessions (
  id                       uuid primary key default gen_random_uuid(),
  level_id                 uuid not null references public.levels(id) on delete cascade,
  number                   int not null,            -- 1..12
  topic                    text not null,
  learning_objectives      text,                    -- bullets (newline-separated)
  why_this_matters         text,
  prerequisites            text,
  knowledge                text,
  skills_trained           text,
  tools_list               jsonb,                   -- array of {name, status, ref}
  tool_onboarding          jsonb,                   -- array of {name, intro, setup, cost, prep}
  duration_minutes         int default 120,
  slide_storage_path       text,                    -- '/slides/python/f1/ss01/session-01.html'
  workshop_dir_storage_path text,                   -- '/workshops/python/f1/ss01/'
  is_published             boolean default false,
  unique (level_id, number)
);

-- ========= 5. workshops =========
create table public.workshops (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.sessions(id) on delete cascade,
  kind                text not null check (kind in ('W1','W2','Mini','Project')),
  title               text not null,
  description         text,
  duration_minutes    int,
  template_file_path  text,                  -- path ใน storage
  files               jsonb,                 -- array of {filename, type, description}
  expected_output     text,
  unique (session_id, kind)
);

-- ========= 6. homework =========
create table public.homework (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  tier            text not null check (tier in ('HW1','HW2','HW3')),
  title           text not null,
  brief           text,
  criteria        text,
  hint            text,
  duration_minutes int,
  is_optional     boolean default false,        -- HW2 = true
  unique (session_id, tier)
);

-- ========= 7. quizzes =========
create table public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  slide_position  int,                          -- ลำดับใน slide deck
  kind            text default 'mcq',           -- 'mcq' | 'short' | 'code'
  question        text not null,
  choices         jsonb,                        -- array of {label, value}
  answer_key      jsonb,                        -- correct answer(s)
  explanation     text,
  points          int default 10,
  time_limit_sec  int default 30
);

-- ========= 8. quiz_responses =========
create table public.quiz_responses (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  live_session_id uuid references public.live_sessions(id) on delete set null,
  answer          jsonb,
  is_correct      boolean,
  response_time_ms int,
  submitted_at    timestamptz default now()
);

-- ========= 9. live_sessions (Phase 3) =========
create table public.live_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions(id),
  host_user_id    uuid not null references auth.users(id),
  join_code       text unique not null,         -- 4-digit code
  started_at      timestamptz default now(),
  ended_at        timestamptz
);

-- ========= 10. user_roles =========
create table public.user_roles (
  user_id       uuid references auth.users(id) on delete cascade,
  role          text not null check (role in ('teacher','student','parent','admin')),
  created_at    timestamptz default now(),
  primary key (user_id, role)
);

-- ========= 11. classes (กลุ่มเรียน) =========
create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id),
  level_id      uuid references public.levels(id),
  name          text not null,                -- 'Saturday Aft', 'Sunday Morning'
  branch        text,                         -- 'พระราม 2', 'เมืองทองธานี'
  schedule_text text,
  created_at    timestamptz default now()
);

create table public.class_members (
  class_id      uuid references public.classes(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text check (role in ('teacher','student')),
  primary key (class_id, user_id)
);
```

### 4.2 RLS Policies (สำคัญ — กัน data leak)

```sql
-- Teachers อ่าน sessions ทุก published ได้
create policy "teachers read published sessions" on public.sessions
  for select using (
    is_published = true
    and exists (select 1 from user_roles where user_id = auth.uid() and role = 'teacher')
  );

-- Teachers ดู quiz_responses ของห้องตัวเอง
create policy "teachers read own class responses" on public.quiz_responses
  for select using (
    exists (
      select 1 from class_members cm
      join class_members cm2 on cm.class_id = cm2.class_id
      where cm.user_id = auth.uid() and cm.role = 'teacher'
        and cm2.user_id = quiz_responses.user_id
    )
  );

-- Students เขียน quiz_responses ของตัวเองได้ + อ่านได้
create policy "students self responses" on public.quiz_responses
  for all using (user_id = auth.uid());
```

### 4.3 Storage Buckets

```
slides/        — public read (signed URL ก็ได้ ถ้าต้อง gated)
  python/f1/ss01/session-01.html
  python/f1/ss01/deck-stage.js
  python/f1/ss01/assets/...

workshops/     — public read
  python/f1/ss01/template_hello.py
  python/f1/ss01/boss_hero.py
  python/f1/ss01/README.md

design-system/ — public read (shared)
  decks/v1-quieter.html
  assets/tokens.css
```

---

## 5. URL/Routes Map

| Path | หน้า | Auth |
|---|---|---|
| `/login` | Login (email + Google) | public |
| `/teach` | Teacher Dashboard (home หลังล็อกอิน) | teacher |
| `/teach/courses` | Course Catalog (10 หลักสูตร) | teacher |
| `/teach/courses/[courseSlug]` | Course Detail (list levels) | teacher |
| `/teach/courses/[courseSlug]/[levelSlug]` | Level Detail (list 12 sessions) | teacher |
| `/teach/sessions/[sessionId]` | Session Detail (หน้าหลัก) | teacher |
| `/teach/sessions/[sessionId]/slide` | Slide Viewer (fullscreen) | teacher |
| `/teach/sessions/[sessionId]/live` | Live Quiz Host (Phase 3) | teacher |
| `/join` | Student join via code (Phase 3) | public/student |
| `/teach/quiz/[quizId]/results` | Quiz Results Dashboard | teacher |
| `/teach/workshops/[filePath]` | Workshop file viewer/download | teacher |

---

## 6. UI Specs per Page

แต่ละหน้ามี: **Purpose · Layout · Components · Data fetched · Actions · Tabler icons ที่ใช้**

### 6.1 Login (`/login`)

**Purpose:** เข้าสู่ระบบครู (เหมือนระบบเดิมของ `app`)

**Layout:** Two-column

| Column | เนื้อหา |
|---|---|
| Left (50%) | Brand panel · "For Teachers" eyebrow · headline "เปิดสอน Python ได้ทันที 36 sessions" · 3 chips ของ tracks |
| Right (50%) | Login form |

**Components:**
- `<GoogleLoginButton />` — primary CTA at top
- Divider "หรือ"
- Email input + Password input
- "เข้าสู่ระบบ" primary button (red)
- SSO note: ถ้ามี session ที่ `/dashboard` อยู่ → "เข้าใช้ทันที" link

**Data fetched:** none (just form)

**Actions:**
- `signInWithOAuth({ provider: 'google' })`
- `signInWithPassword({ email, password })`
- ตรวจ session existing → auto-redirect to `/teach`

**Tabler icons:** none (ใช้ Google logo SVG)

---

### 6.2 Teacher Dashboard (`/teach`)

**Purpose:** home หลังล็อกอิน · ดูสรุปวันนี้ + quick actions

**Layout:** Single column, max-width 1024px

**Components (เรียงบน-ล่าง):**

1. **Top nav:** logo + nav items (Home, Courses, Stats) + user profile
2. **Greeting hero:**
   - eyebrow date (Mono) "วันจันทร์ที่ 1 มิ.ย."
   - headline (Display) "สวัสดีครูเอิร์น"
   - subtitle "วันนี้สอน X คาบ · กลุ่ม Saturday กำลังจะเข้ามา"
3. **Stat cards (4 cards grid):**
   - คาบวันนี้ (`ti-calendar-event`)
   - นักเรียน (`ti-users`)
   - HW ส่ง % (`ti-clipboard-check`)
   - Quiz เฉลี่ย (`ti-trophy`)
4. **Today's schedule (list cards):**
   - แสดง 3-5 คาบของวัน
   - คาบใกล้สุด (ปัจจุบัน/ต่อไป) highlight ด้วย `border: 2px solid #ef443a`
   - แต่ละ row: เวลา + course badge + topic + group/room + ปุ่ม "เริ่มสอน" (`ti-player-play`) / "เตรียม"
5. **Two-column footer:**
   - Recent activity (`ti-activity`)
   - Quick Links (`ti-bolt`)

**Data fetched:**
```typescript
- todayClasses(teacherId, date)        // จาก classes + sessions + branch schedule
- statsToday(teacherId, date)          // calculated
- recentActivity(teacherId, limit: 5)  // events log
```

**Actions:**
- คลิก "เริ่มสอน" → `/teach/sessions/[sessionId]`
- คลิก "เตรียม" → `/teach/sessions/[sessionId]?prep=true`
- คลิก stat card → `/teach/stats?metric=...`

**Tabler icons:**
`ti-home`, `ti-books`, `ti-chart-bar`, `ti-user`, `ti-calendar-event`, `ti-users`, `ti-clipboard-check`, `ti-trophy`, `ti-clock`, `ti-player-play`, `ti-activity`, `ti-bolt`, `ti-circle-check`, `ti-message-circle`, `ti-target`, `ti-arrow-right`

---

### 6.3 Course Catalog (`/teach/courses`)

**Purpose:** เลือกคอร์สที่จะสอน (รองรับ 10 หลักสูตร × 3 tracks)

**Layout:** Single column with track sections

**Components:**

1. **Top nav** (เหมือนเดิม)
2. **Hero:**
   - eyebrow "Course Library"
   - headline "เลือกหลักสูตรที่จะสอน"
   - subtitle "10 หลักสูตร · 3 tracks · Camp seasonal"
3. **Filter chips:** ทั้งหมด · Robotics · Coding · Drone · Camp
4. **Track sections (sticky header):**
   - **Robotics Track:** Grid 3 cols → VEX GO, VEX IQ, VEX V5
   - **Coding & Maker Track:** Grid 2 cols → Python, MakerZero
   - **Drone Track:** Grid 1 col → Drone Coding
5. **Course card structure:**
   - top: level badge + age range
   - title (Display, 14px)
   - subtitle (1 line description)
   - bottom: stats (sessions × hours)
   - Card highlight (`border: 2px solid red`) + badge "PUBLISHED" สำหรับ Python (เท่านั้นใน MVP)

**Data fetched:**
```typescript
- tracks()                  // ordered by sort_order
- coursesByTrack()          // grouped, filter is_published
```

**Actions:**
- คลิก course card → `/teach/courses/[courseSlug]`
- Filter chip → client-side filter (no nav)

**Tabler icons:** `ti-robot`, `ti-code`, `ti-drone`, `ti-confetti` (track icons)

---

### 6.4 Course Detail (`/teach/courses/[courseSlug]`)

**Purpose:** เลือก level ของคอร์ส (เช่น Python → F1/F2/F3)

**Layout:** Single column

**Components:**

1. **Top nav** + breadcrumb (Courses / Python)
2. **Course hero:**
   - eyebrow course name + age range
   - Display title "Python"
   - description 1-2 บรรทัด
3. **Levels grid (3 cards):**
   - แต่ละ card: level badge (F1) + name (The Commander) + 12 sessions · 2 ชม.
   - bullet topics 3 ข้อ (เช่น "variables, loops, lists")
   - tag tools หลักของ level
4. **CTA bar:** "ดูสรุปทั้งคอร์ส" (link to overview PDF) + "ตารางสอน"

**Data fetched:**
```typescript
- course(courseSlug)
- levels(courseId) ordered by number
- toolsByLevel(levelIds) — aggregate distinct tools across sessions
```

**Actions:**
- คลิก level card → `/teach/courses/[courseSlug]/[levelSlug]`

---

### 6.5 Level Detail (`/teach/courses/[courseSlug]/[levelSlug]`)

**Purpose:** ดู 12 sessions ของ level นั้น (table)

**Layout:** Table-like, Excel-style preview

**Components:**

1. **Top nav** + breadcrumb (Courses / Python / F2 The Data Master)
2. **Level hero:** F2 badge + The Data Master + goal sentence
3. **Sessions table:** 12 rows, columns: # · Topic · Goal · Tools · Status
4. **Filter:** by tools used / by published status
5. **Quick actions:** "ดาวน์โหลดทั้ง Level เป็น ZIP" / "Print overview"

**Data fetched:**
```typescript
- level(levelSlug)
- sessions(levelId) ordered by number
  - include: topic, why_this_matters (short), tools_list, is_published
```

**Actions:**
- คลิก row → `/teach/sessions/[sessionId]`

---

### 6.6 Session Detail (`/teach/sessions/[sessionId]`) ⭐ หน้าหลัก

**Purpose:** หน้าใช้บ่อยที่สุด · ครูเปิดก่อนเข้าสอนทุกครั้ง · ดู workshops/HW/tools + ปุ่ม "เปิด Slide"

**Layout:** Two-column (main + sidebar 220px)

**Components:**

**Main column:**

1. **Breadcrumb:** ← /courses / Python F2 / SS1 Lists Level Up
2. **Hero card:**
   - badges: "F2 · SS1" + "Concept · 120 นาที"
   - Display title: "Lists Level Up"
   - subtitle: "in + Logic + Multi-list"
3. **Learning Objectives** section (`ti-target`)
   - bullets with inline `<code>` highlighting
4. **Workshops** section (`ti-tool`)
   - 4 cards (W1, W2, Mini, Project) ใน grid 2×2
   - Project card highlighted (border-red)
   - แต่ละ card: kind + duration + title + description
5. **Homework — 3 Tier** section (`ti-home`)
   - 3 cards stacked, color-coded:
     - HW1 → mint (success)
     - HW2 → yellow (optional)
     - HW3 → sky (family)

**Sidebar:**

1. **Primary CTA:** "เปิด Slide สอน" button (red, full-width, `ti-player-play`)
2. **Workshop Files** card:
   - List files with download icons
   - "ZIP ทั้งหมด" secondary button
3. **Tools card:**
   - List tools with status (✨ ใหม่ / ♻️ ใช้แล้ว)
   - ขยาย onboarding section ถ้ามี ✨

**Data fetched:**
```typescript
- session(sessionId) — all fields
- workshops(sessionId) ordered by kind
- homework(sessionId) ordered by tier
- workshopFiles(sessionId) — list from storage
- slideMetadata(sessionId) — slide count, file size
```

**Actions:**
- "เปิด Slide สอน" → `/teach/sessions/[sessionId]/slide` (fullscreen)
- Download file → signed URL จาก Supabase Storage
- "ZIP ทั้งหมด" → generate on-the-fly (edge function) หรือ pre-built ZIP

**Tabler icons:**
`ti-arrow-left`, `ti-target`, `ti-tool`, `ti-home`, `ti-player-play`, `ti-folder`, `ti-download`, `ti-refresh` (recycled), `ti-sparkles` (new tool)

---

### 6.7 Slide Viewer (`/teach/sessions/[sessionId]/slide`)

**Purpose:** เปิด slide deck บนจอใหญ่ในห้องเรียน · ครูคลิกปุ่ม "เปิด template_X.py" จาก slide → เด็กได้ link

**Layout:** Fullscreen mode (dark)

**Components:**

1. **Top bar (dark):**
   - left: `← back` + breadcrumb "Python F2 / SS1 Lists Level Up"
   - right: slide counter "5 / 14" + `⛶ Fullscreen` toggle
2. **Slide stage:**
   - iframe load `slide_storage_path` (HTML จาก Supabase Storage)
   - aspect-ratio 16:9
   - shadow + rounded corners
3. **Bottom control bar (dark):**
   - left: ◀ Prev + Next ▶ (red CTA)
   - center: slide thumbnails (mini colored boxes by slide type — cover/agenda/concept/workshop/quiz/recap/homework/parent)
   - right: workshop files count + "ZIP" button

**Slide HTML embedded behavior:**
- slide HTML มี `<a class="file-btn" href="../workshops/template_X.py">` (จาก design system)
- iframe `sandbox="allow-scripts allow-popups"` — click ปุ่ม "เปิดไฟล์" → open new tab ของ workshop file viewer

**Data fetched:**
```typescript
- session(sessionId) — slide_storage_path + workshop list
- slideManifest(sessionId) — array of {position, kind, title}
```

**Actions:**
- Prev/Next → postMessage to iframe → trigger `deck-stage.js` navigation
- Click thumbnail → jump to slide
- "ZIP" → bundled download

**Tabler icons:**
`ti-arrow-left`, `ti-maximize`, `ti-chevron-left`, `ti-chevron-right`, `ti-folder`, `ti-download`

---

### 6.8 Quiz Slide (embedded in deck — Phase 2)

**Purpose:** quiz ที่ฝังใน slide deck · ครูคลิก → reveal answer + แสดง live count

**Layout:** Slide aspect-ratio 16:9 (sky blue bg `#2563eb`)

**Components:**

1. Chrome top: CodeLab badge + breadcrumb mono "F2 · SS1 · Quiz 1/3"
2. Eyebrow "Quick Quiz"
3. Question (large text)
4. 4 Choices grid 2×2:
   - default state: translucent white bg
   - revealed correct: `mint #5dd49e`
   - revealed wrong: stays muted
5. Bottom bar:
   - left: live count "ตอบแล้ว 8/10" + per-choice tally
   - right: "Next →" button (white)

**Data fetched:**
```typescript
- quiz(quizId)                       // question, choices, answer_key
- quizResponses(quizId, liveSessionId)  // live count
```

**Actions (host side):**
- Click "Reveal" → broadcast to clients via Supabase Realtime (Phase 3)
- "Next" → move to next slide

**Actions (student side — Phase 3):**
- Tap choice → insert into `quiz_responses`
- See own answer indicator

**Tabler icons:** `ti-circle-check` (reveal correct)

---

### 6.9 Live Mode (`/teach/sessions/[sessionId]/live` — Phase 3)

**Purpose:** Kahoot-style live quiz · ครู host + เด็ก join via code

**Layout:** Two views

**Host view (main screen):**

1. Top bar: `LIVE` badge red + breadcrumb + countdown timer
2. **Join code card (large):**
   - "เด็ก join ที่" `teach.codelabthailand.com/join`
   - CODE (large mono red) `7392`
3. Question (large)
4. **4 colored choices (Kahoot-style shapes):**
   - ▲ red (`#ef443a`)
   - ◆ blue (`#2563eb`)
   - ● yellow (`#ffc94a`)
   - ■ green (`#5dd49e`)
   - แต่ละ choice แสดง live count
5. **Leaderboard sidebar:** top 3 by score
6. Footer: "ตอบแล้ว 10/12 · realtime via Supabase"

**Student view (mobile):**

1. Phone frame mockup
2. Header: ROUND X/Y + nickname + countdown
3. 4 large color buttons (no text, just shapes — encourages looking at host screen)
4. After answer: feedback "ถูก! +800" or "ผิด · -"

**Data fetched:**
```typescript
// Host
- liveSession(liveSessionId)
- currentQuiz(liveSessionId)
- responses(currentQuizId)            // realtime channel subscription
- leaderboard(liveSessionId)          // ordered by score

// Student
- liveSessionByCode(code)
- currentQuiz(liveSessionId)          // realtime push
```

**Realtime channels:**
- `live:{liveSessionId}` — host broadcasts: current_quiz_id, reveal, next
- `live:{liveSessionId}:responses` — students push answers

**Tabler icons:**
`ti-broadcast` (LIVE), `ti-clock`, `ti-triangle`, `ti-diamond`, `ti-circle`, `ti-square`, `ti-trophy`, `ti-medal`

---

### 6.10 Quiz Results (`/teach/quiz/[quizId]/results`)

**Purpose:** ครูดูสรุปหลัง quiz · เห็น common mistakes + action items

**Layout:** Single column

**Components:**

1. Top nav + breadcrumb (Python F2 / SS1 / Quiz Results)
2. **Hero:**
   - eyebrow "Quiz Summary"
   - Display title "Lists Level Up · 3 ข้อ"
   - 4 stat cards: เข้าร่วม · เฉลี่ย · เก่งสุด · ยากสุด
3. **Accuracy per question (`ti-chart-bar`):**
   - แต่ละ row: question (with inline code) + accuracy bar (mint/yellow/coral based on %) + "X/Y · Z%"
4. **Two-column grid:**
   - **Leaderboard (`ti-list-numbers`):** top medals + ranked list
   - **Insights + Action (`ti-bulb`):**
     - แต่ละ insight: severity color + icon + headline + action ("ทบทวน X อีกครั้ง")
5. **Export bar:** "CSV" button + "Share" button

**Data fetched:**
```typescript
- quiz(quizId)
- responses(quizId)                  // join with users
- aggregatesByQuestion(quizId)       // % correct per question
- leaderboard(quizId)                // sorted by score
- insights(quizId)                   // generated: low-accuracy questions, struggling students
```

**Actions:**
- "CSV" → generate CSV with students × questions
- "Share" → copy link / send to LINE

**Tabler icons:**
`ti-arrow-left`, `ti-chevron-right`, `ti-users`, `ti-target`, `ti-trophy`, `ti-alert-triangle`, `ti-chart-bar`, `ti-list-numbers`, `ti-medal`, `ti-medal-2`, `ti-bulb`, `ti-alert-circle`, `ti-user-question`, `ti-download`, `ti-share`

---

## 7. Phasing Roadmap

### Phase 1 — MVP Teacher (4-6 สัปดาห์)

**Scope:**
- Auth + role check
- Course Catalog (multi-subject) + Course Detail + Level Detail + Session Detail
- Slide Viewer (iframe-based)
- Workshop file download
- Teacher Dashboard (without quiz stats)
- Seed: Python F1/F2/F3 ครบ 36 sessions

**Deliverables:**
- DB migrations (5 tables: tracks, courses, levels, sessions, workshops, homework + user_roles)
- Seed script Python: `seed_python_v6.py` (อ่าน V6.xlsx → upsert Supabase)
- Storage upload script: slide HTML + workshop files
- Next.js routes + components

**Success metric:**
- ครูเปิด slide จาก app ในห้องเรียนได้ 100% ของคาบ
- 0 ครู print PDF เหมือนเดิม (สัญญาณว่าระบบใช้ได้)

### Phase 2 — Quiz Async (2-3 สัปดาห์)

**Scope:**
- Quiz table + admin to seed quiz questions
- Quiz component embedded in slide (postMessage protocol)
- Quiz results dashboard (per session)
- Export CSV

**Deliverables:**
- Quiz schema migration
- Quiz authoring UI (admin)
- Slide integration spec for quiz position
- Results dashboard UI

### Phase 3 — Live Quiz (3-4 สัปดาห์)

**Scope:**
- `live_sessions` + Supabase Realtime channels
- Join code page (`/join`)
- Host view + Student mobile view
- Leaderboard live update

**Deliverables:**
- Realtime channel design
- Join flow + nickname assignment
- Anti-cheat (basic): one device per nickname per session

### Phase 4 — Student/Parent Portal (TBD)

**Scope:**
- Student progress page
- HW submission
- Parent dashboard (read-only)
- Notification (LINE LIFF push)

---

## 8. Implementation Notes

### 8.1 Repo Decision

หลังจาก revise scope แล้ว — embed ใน app เดิม:
- Route group `(teach)` ใน existing Next.js app
- ไม่ต้องสร้าง repo ใหม่
- Shared `lib/supabase`, `lib/auth`, components

### 8.2 V6.xlsx → Supabase Seed Flow

```
1. อ่าน V6.xlsx ผ่าน openpyxl
2. แปลงทุก sheet (Py_core_1, Py_core_2, Py_core_3) → JSON records
3. Upsert ตาม order: tracks → courses → levels → sessions → workshops → homework
4. Upload slide HTML + workshop files ขึ้น Supabase Storage
5. Update sessions.slide_storage_path
```

Script จะอยู่ใน repo เดิม: `scripts/seed_python_v6.py`

### 8.3 Slide HTML Integration

Current slide deck (`hosting/python/foundation-X/ssXX/session-XX.html`) ใช้ `deck-stage.js` ของ design system แล้ว — แค่:

1. Upload HTML + assets ขึ้น Storage
2. Slide HTML reference asset ผ่าน relative path (working อยู่แล้ว)
3. Slide Viewer embed ผ่าน iframe
4. Host page communicate กับ iframe ผ่าน `postMessage`:
   ```js
   // Host → iframe
   iframe.contentWindow.postMessage({ type: 'nav', dir: 'next' }, '*')
   // iframe → Host
   parent.postMessage({ type: 'slide-change', position: 5, kind: 'workshop' }, '*')
   ```

ต้องแก้ `deck-stage.js` รับ message events (1 patch · ~20 บรรทัด)

### 8.4 SEO / Public Access

หน้า `/teach/*` ทั้งหมด:
- Set `<meta name="robots" content="noindex">`
- Middleware require auth + teacher role
- ไม่มี public catalog (เพื่อกัน student ส่อง content)

### 8.5 Mobile Responsive

- Phase 1: desktop-first (ครูใช้บนจอใหญ่/notebook)
- Phase 3 student view: mobile-first (Kahoot pattern)
- Session Detail responsive: sidebar → collapse to top accordion on mobile

---

## 9. Open Questions (รอ confirm)

| # | คำถาม | ผลกระทบ |
|---|---|---|
| Q1 | Roles seed initial — ครูทุกคนใส่ใน DB ตอนไหน? | บล็อก Phase 1 — ต้อง admin assign |
| Q2 | Branch (พระราม 2 / เมืองทองธานี) ต้องแยก data ไหม? | data isolation policy |
| Q3 | สื่อ slide เดิม (ที่ทำใน `hosting/python/`) จะ migrate ขึ้น Storage หรือ serve จาก `public/` ใน Next.js? | deployment complexity |
| Q4 | Live Quiz device limit per nickname — บังคับ 1 device หรือ 1 nickname? | UX trade-off |
| Q5 | Workshop file viewer in-browser (syntax highlight) หรือ download อย่างเดียว? | extra dev work ~3 วัน |
| Q6 | Quiz authoring — ใส่ใน V6.xlsx column ใหม่ หรือ separate spreadsheet/UI? | content workflow |

---

## 10. References

- หลักสูตร Python: `01-Working/01-Python/CodeLab-python-course-v6.xlsx` (36 sessions ครบ)
- Plan: `01-Working/01-Python/codelab_python_plan.md` (13 principles + design system)
- Design system: `06-Design-System/decks/v1-quieter.html`
- Brand: `00-Context/Brand/`
- Curriculum overview: `00-Context/curriculum.md`

---

*end of spec*
