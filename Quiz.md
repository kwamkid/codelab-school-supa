# Migration Plan: Quiz App → Next.js + Supabase

> เอกสารนี้ครอบคลุมทุกรายละเอียดสำหรับการสร้าง Quiz System ใหม่ บน Next.js + Supabase
> เพื่อ integrate เข้ากับระบบ School Management ที่มีอยู่แล้ว

---

## 1. Supabase Migration (SQL)

### 1.1 Tables

```sql
-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE quiz_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📚',
  description TEXT,
  color TEXT DEFAULT 'from-purple-400 to-pink-400', -- Tailwind gradient class
  icon_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- QUIZZES
-- ============================================
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_th TEXT,
  title_en TEXT,
  emoji TEXT DEFAULT '📝',
  difficulty TEXT CHECK (difficulty IN ('ง่าย', 'ปานกลาง', 'ยาก')) DEFAULT 'ปานกลาง',
  category_id UUID REFERENCES quiz_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- QUESTIONS (แยก table แทน array ใน Firestore)
-- ============================================
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  question TEXT,
  question_th TEXT,
  question_en TEXT,
  options JSONB DEFAULT '[]',         -- ["A","B","C","D"]
  options_th JSONB DEFAULT '[]',
  options_en JSONB DEFAULT '[]',
  correct_answer INT NOT NULL CHECK (correct_answer BETWEEN 0 AND 3),
  points INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_quiz ON quiz_questions(quiz_id);

-- ============================================
-- QUIZ RESULTS (student attempts)
-- ============================================
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  school_id UUID,                     -- FK ไปยัง schools table ของระบบเดิม
  school_name TEXT,                   -- denormalized สำหรับ display
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  quiz_title TEXT,
  quiz_title_th TEXT,
  quiz_title_en TEXT,
  emoji TEXT,
  difficulty TEXT,
  score INT DEFAULT 0,
  max_score INT DEFAULT 0,
  percentage NUMERIC(5,2) DEFAULT 0,
  total_questions INT DEFAULT 0,
  selected_question_count INT,
  original_total_questions INT,
  total_time INT DEFAULT 0,           -- seconds
  answers JSONB DEFAULT '[]',         -- array of answer objects
  quiz_data JSONB,                    -- snapshot ของ quiz ตอนทำ
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_results_student ON quiz_results(student_name);
CREATE INDEX idx_results_school ON quiz_results(school_id);
CREATE INDEX idx_results_quiz ON quiz_results(quiz_id);
CREATE INDEX idx_results_created ON quiz_results(created_at DESC);

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON quiz_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 1.2 RLS (Row Level Security)

```sql
ALTER TABLE quiz_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- Public read สำหรับ quizzes, categories, questions
CREATE POLICY "Anyone can read categories"
  ON quiz_categories FOR SELECT USING (true);

CREATE POLICY "Anyone can read quizzes"
  ON quizzes FOR SELECT USING (true);

CREATE POLICY "Anyone can read questions"
  ON quiz_questions FOR SELECT USING (true);

-- Students can insert results
CREATE POLICY "Anyone can insert results"
  ON quiz_results FOR INSERT WITH CHECK (true);

-- Students can read own results
CREATE POLICY "Students can read own results"
  ON quiz_results FOR SELECT USING (true);

-- Admin (ใช้ role จากระบบ school management เดิม)
-- ปรับตาม auth system ที่มี
CREATE POLICY "Admin can manage categories"
  ON quiz_categories FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'teacher'));

CREATE POLICY "Admin can manage quizzes"
  ON quizzes FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'teacher'));

CREATE POLICY "Admin can manage questions"
  ON quiz_questions FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'teacher'));

CREATE POLICY "Admin can manage results"
  ON quiz_results FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin', 'teacher'));
```

### 1.3 Seed Data (Default Categories)

```sql
INSERT INTO quiz_categories (name, emoji, description, color) VALUES
  ('คณิตศาสตร์', '🧮', 'บวก ลบ คูณ หาร และอื่นๆ', 'from-blue-400 to-cyan-400'),
  ('วิทยาศาสตร์', '🔬', 'สำรวจโลกวิทยาศาสตร์', 'from-green-400 to-emerald-400'),
  ('ภาษาไทย', '📖', 'ภาษาไทยน่ารู้', 'from-purple-400 to-pink-400'),
  ('ภาษาอังกฤษ', '🌍', 'English is fun!', 'from-orange-400 to-red-400'),
  ('สังคมศึกษา', '🏛️', 'ประวัติศาสตร์ ภูมิศาสตร์ และสังคม', 'from-amber-400 to-orange-400'),
  ('ทุกวิชา', '🌟', 'รวมทุกวิชา', 'from-indigo-400 to-purple-400');
```

### 1.4 Supabase Views (สำหรับ query ที่ใช้บ่อย)

```sql
-- Quiz พร้อม question count
CREATE VIEW quizzes_with_count AS
SELECT
  q.*,
  COUNT(qq.id) AS question_count
FROM quizzes q
LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
GROUP BY q.id;

-- Attempt stats per student
CREATE VIEW student_stats AS
SELECT
  student_name,
  school_id,
  COUNT(*) AS total_attempts,
  ROUND(AVG(percentage), 1) AS avg_score,
  MAX(percentage) AS best_score,
  SUM(total_time) AS total_time_spent
FROM quiz_results
GROUP BY student_name, school_id;
```

---

## 2. Next.js Project Structure

```
app/
├── (public)/                         # Public routes (no auth)
│   ├── page.tsx                      # Landing page (เลือก นักเรียน/ครู)
│   ├── quiz/
│   │   └── [quizId]/
│   │       └── page.tsx              # Direct quiz access (QR code)
│   └── student/
│       ├── page.tsx                  # Student login (ใส่ชื่อ)
│       ├── schools/
│       │   └── page.tsx              # เลือกโรงเรียน
│       ├── categories/
│       │   └── page.tsx              # เลือกหมวดวิชา
│       ├── quizzes/
│       │   └── page.tsx              # รายการข้อสอบ (?category=xxx)
│       ├── take/
│       │   └── [quizId]/
│       │       └── page.tsx          # ทำข้อสอบ
│       ├── result/
│       │   └── page.tsx              # แสดงผลคะแนน
│       └── history/
│           └── page.tsx              # ประวัติการทำข้อสอบ
│
├── (admin)/                          # Admin routes (ต้อง login)
│   └── admin/
│       ├── page.tsx                  # Admin login
│       ├── dashboard/
│       │   └── page.tsx              # Dashboard + quiz list + pagination
│       ├── quiz/
│       │   ├── new/
│       │   │   └── page.tsx          # สร้างข้อสอบใหม่
│       │   └── [quizId]/
│       │       └── edit/
│       │           └── page.tsx      # แก้ไขข้อสอบ
│       ├── scores/
│       │   └── page.tsx              # ดูคะแนนนักเรียน + filter + export
│       ├── categories/
│       │   └── page.tsx              # จัดการหมวดหมู่
│       └── schools/
│           └── page.tsx              # จัดการโรงเรียน
│
├── api/                              # API Routes (optional, ใช้ server actions แทนก็ได้)
│   └── export-csv/
│       └── route.ts                  # Export CSV
│
├── layout.tsx                        # Root layout
└── globals.css                       # Tailwind + fonts

components/
├── admin/
│   ├── AdminDashboard.tsx
│   ├── AdminLogin.tsx
│   ├── AdminScores.tsx
│   ├── CategoryManager.tsx
│   ├── QRCodeModal.tsx
│   ├── QuizEditor.tsx
│   ├── QuizImport.tsx
│   └── SchoolManager.tsx
├── student/
│   ├── CategorySelection.tsx
│   ├── DirectQuizAccess.tsx
│   ├── QuizList.tsx
│   ├── QuizResultPage.tsx
│   ├── QuizSelectionModal.tsx
│   ├── QuizTaking.tsx
│   ├── SchoolSelection.tsx
│   ├── StudentHistoryPage.tsx
│   └── StudentLogin.tsx
├── common/
│   ├── AnswerReview.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── GlobalHeader.tsx
│   ├── LoadingSpinner.tsx
│   ├── Modal.tsx
│   ├── Pagination.tsx
│   └── SearchableDropdown.tsx
└── layout/
    └── LandingPage.tsx

lib/
├── supabase/
│   ├── client.ts                     # createBrowserClient
│   ├── server.ts                     # createServerClient
│   └── middleware.ts                 # auth middleware
├── services/
│   ├── quiz-service.ts              # CRUD quizzes + questions
│   ├── result-service.ts            # CRUD quiz_results
│   ├── category-service.ts          # CRUD categories
│   └── school-service.ts            # เรียก API ระบบเดิม หรือ query จาก Supabase ตรง
├── audio/
│   ├── audio-service.ts             # Tone.js synth sounds
│   ├── music-service.ts             # Background music (HTML5 Audio)
│   └── simple-audio.ts              # Web Audio API
├── constants.ts
├── translations.ts
├── helpers.ts
└── types.ts                          # TypeScript types

public/
├── favicon.png
├── logo.png
└── quiz-music.mp3
```

---

## 3. รายละเอียด UI ทุกหน้า

### 3.1 Landing Page `/`

```
┌─────────────────────────────────────────┐
│  Floating emojis (📊 👨‍🏫 📚)            │
│  background: gradient purple/orange      │
│                                         │
│  [Logo]                                 │
│  "ยินดีต้อนรับสู่ระบบทำแบบทดสอบ"          │
│  "เลือกบทบาทของคุณ"                      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ 🎓          │  │ 👨‍🏫          │       │
│  │ ฉันเป็น     │  │ ฉันเป็น     │       │
│  │ นักเรียน    │  │ คุณครู      │       │
│  │ gradient    │  │ gradient    │       │
│  │ green       │  │ purple      │       │
│  └─────────────┘  └─────────────┘       │
│                                         │
│  [Language Toggle TH/EN]                │
└─────────────────────────────────────────┘
```

### 3.2 Student Login `/student`

```
┌─────────────────────────────────────────┐
│  [← กลับ]                    [TH/EN]   │
│                                         │
│  "🎮 สวัสดี! พร้อมทำแบบทดสอบกันมั้ย?"     │
│  "ใส่ชื่อเล่นของคุณ"                      │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ 🎯 ชื่อเล่นของคุณ            │      │
│  └───────────────────────────────┘      │
│                                         │
│  [🚀 เริ่มกันเลย!] (gradient green)     │
│                                         │
│  animation: slideUp                     │
└─────────────────────────────────────────┘
```

### 3.3 School Selection `/student/schools`

```
┌─────────────────────────────────────────┐
│  [← กลับ]                    [TH/EN]   │
│                                         │
│  "🏫 เลือกโรงเรียนของคุณ"                │
│                                         │
│  ┌──────────────┐ ┌──────────────┐      │
│  │ 🔍 ค้นหา... │ │📍 จังหวัด ▼  │      │
│  └──────────────┘ └──────────────┘      │
│  (SearchableDropdown: > 7 แสดง search)  │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ 🏫       │ │ 🏫       │ │ 🏫     │  │
│  │ โรงเรียนA│ │ โรงเรียนB│ │ โรงเรียนC│  │
│  │ กรุงเทพ  │ │ เชียงใหม่│ │ ขอนแก่น│  │
│  │ 12 คน    │ │ 8 คน     │ │ 5 คน   │  │
│  └──────────┘ └──────────┘ └────────┘  │
│                                         │
│  (grid responsive 3 cols → 1 col)       │
└─────────────────────────────────────────┘
```

### 3.4 Category Selection `/student/categories`

```
┌─────────────────────────────────────────┐
│  [← กลับ]  "สวัสดี {name}!"   [TH/EN] │
│                                         │
│  "📚 เลือกหมวดวิชา"                     │
│                                         │
│  ┌───────────┐ ┌───────────┐            │
│  │ 🧮        │ │ 🔬        │            │
│  │ คณิตศาสตร์│ │ วิทยาศาสตร์│            │
│  │ 15 ข้อสอบ │ │ 12 ข้อสอบ │            │
│  │ gradient  │ │ gradient  │            │
│  │ blue-cyan │ │ green     │            │
│  └───────────┘ └───────────┘            │
│  ┌───────────┐ ┌───────────┐            │
│  │ 📖 ภาษาไทย│ │ 🌍 English│            │
│  └───────────┘ └───────────┘            │
│  ┌───────────┐                          │
│  │ 🌟 ทุกวิชา│                          │
│  └───────────┘                          │
│                                         │
│  [📊 ดูประวัติคะแนน]                    │
└─────────────────────────────────────────┘
```

### 3.5 Quiz List `/student/quizzes?category=xxx`

```
┌─────────────────────────────────────────┐
│  [← กลับ]  "{category} ({count})"      │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ 🧮 คณิตพื้นฐาน               │      │
│  │ 📊 20 คำถาม  │ 🟢 ง่าย       │      │
│  │ 📅 สร้าง: 15 มี.ค. 2026      │      │
│  │ [▶ เริ่มทำข้อสอบ]            │      │
│  └───────────────────────────────┘      │
│  ┌───────────────────────────────┐      │
│  │ 🧮 คณิตขั้นสูง               │      │
│  │ 📊 50 คำถาม  │ 🔴 ยาก        │      │
│  │ [▶ เริ่มทำข้อสอบ]            │      │
│  └───────────────────────────────┘      │
│                                         │
│  (ถ้ากด quiz ที่มี > 20 ข้อ              │
│   จะแสดง QuizSelectionModal)            │
└─────────────────────────────────────────┘
```

### 3.6 Quiz Selection Modal (popup)

```
┌─────────────────────────────────────────┐
│  "เลือกจำนวนข้อ"                  [✕]  │
│                                         │
│  📝 คณิตขั้นสูง (50 ข้อ)                │
│                                         │
│  "คุณต้องการทำกี่ข้อ?"                   │
│  ┌───────────────────────────────┐      │
│  │ Slider: 1 ──●────────── 50   │      │
│  │ หรือ พิมพ์จำนวน: [20]        │      │
│  └───────────────────────────────┘      │
│  "คำถามจะถูกสุ่มจาก 50 ข้อ"             │
│  "เวลา: 10 นาที (0.5 นาที/ข้อ)"         │
│                                         │
│  [เริ่มทำข้อสอบ] (gradient green)       │
└─────────────────────────────────────────┘
```

### 3.7 Quiz Taking `/student/take/[quizId]`

```
┌─────────────────────────────────────────┐
│  ⏱ 04:32     คะแนน: 30/50    ข้อ 4/10  │
│  ████████░░░░░░░░ (progress bar)        │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ ข้อที่ 4                      │      │
│  │ "2 + 2 × 3 = ?"              │      │
│  │                               │      │
│  │ ○ A. 8                        │      │
│  │ ● B. 12    ← selected (blue) │      │
│  │ ○ C. 10                       │      │
│  │ ○ D. 6                        │      │
│  │                               │      │
│  │ [✓ ส่งคำตอบ] (gradient blue)  │      │
│  └───────────────────────────────┘      │
│                                         │
│  -- หลังกดส่ง --                        │
│  ┌───────────────────────────────┐      │
│  │ ✗ ผิด!                        │      │
│  │ คำตอบที่ถูก: A. 8             │      │
│  │ [→ ข้อถัดไป]                  │      │
│  └───────────────────────────────┘      │
│                                         │
│  Timer colors:                          │
│    > 20s = green                        │
│    > 10s = yellow                       │
│    ≤ 10s = red (pulse animation)        │
│                                         │
│  Audio:                                 │
│    - correctAnswer() on correct         │
│    - wrongAnswer() on incorrect         │
│    - timeWarning() at 60s, 30s, 10s     │
│    - background music (optional)        │
└─────────────────────────────────────────┘
```

### 3.8 Quiz Result `/student/result`

```
┌─────────────────────────────────────────┐
│  animation: confetti / celebration      │
│                                         │
│  🏆 (grade emoji, size 5rem)            │
│  "ยอดเยี่ยม!"                           │
│                                         │
│  ┌─────────┐                            │
│  │  90%    │ (circular progress)        │
│  │  เกรด A │                            │
│  └─────────┘                            │
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │คะแนน │ │ข้อถูก│ │เวลา  │ │จำนวนข้อ│   │
│  │90/100│ │ 9/10 │ │3:45  │ │  10  │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                         │
│  [📋 ดูเฉลย]  [🔄 ทำใหม่]  [🏠 หน้าหลัก] │
│                                         │
│  Grade scale:                           │
│    ≥90% = A 🏆 green                    │
│    ≥80% = B 🌟 blue                     │
│    ≥70% = C 👍 yellow                   │
│    ≥60% = D 💪 orange                   │
│    <60% = F 📚 red                      │
│                                         │
│  Audio: quizComplete() celebration      │
└─────────────────────────────────────────┘
```

### 3.9 Student History `/student/history`

```
┌─────────────────────────────────────────┐
│  [← กลับ]  "📊 ประวัติคะแนน"   [TH/EN]│
│                                         │
│  Stats Cards (grid 2x3):               │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 📝   │ │ 📊   │ │ 🏆   │            │
│  │ 15   │ │ 72%  │ │ 95%  │            │
│  │ครั้ง  │ │เฉลี่ย│ │สูงสุด│            │
│  └──────┘ └──────┘ └──────┘            │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ ✅   │ │ 🔥   │ │ ⏱   │            │
│  │ 12   │ │ 5    │ │ 2ชม  │            │
│  │ผ่าน  │ │streak│ │รวม   │            │
│  └──────┘ └──────┘ └──────┘            │
│                                         │
│  History List + Pagination:             │
│  ┌───────────────────────────────┐      │
│  │ 🧮 คณิตพื้นฐาน               │      │
│  │ 90% │ 90/100 │ 3:45 │ 15มีค │      │
│  │ [📋 ดูเฉลย]                   │      │
│  └───────────────────────────────┘      │
│  ┌───────────────────────────────┐      │
│  │ ...more rows...               │      │
│  └───────────────────────────────┘      │
│                                         │
│  << < [1] [2] [3] ... [9] [10] > >>    │
│  แสดง 1-10 จาก 15    แถว/หน้า: [10]    │
└─────────────────────────────────────────┘
```

### 3.10 Answer Review Modal

```
┌─────────────────────────────────────────┐
│  "📋 เฉลยข้อสอบ"                  [✕]  │
│  📝 คณิตพื้นฐาน │ 👤 สมชาย             │
│  คะแนน: 90/100 (90%)  ⏱ 3:45          │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ ข้อ 1: "2 + 2 = ?"           │      │
│  │ ✅ คำตอบคุณ: A. 4 (ถูกต้อง)  │      │
│  │ ⏱ 12 วินาที                  │      │
│  └───────────────────────────────┘      │
│  ┌───────────────────────────────┐      │
│  │ ข้อ 2: "5 × 3 = ?"           │      │
│  │ ❌ คำตอบคุณ: B. 12            │      │
│  │ ✅ คำตอบถูก: C. 15            │      │
│  │ ⏱ 25 วินาที                  │      │
│  └───────────────────────────────┘      │
│  ... (scrollable)                       │
└─────────────────────────────────────────┘
```

### 3.11 Direct Quiz Access `/quiz/[quizId]`

```
┌─────────────────────────────────────────┐
│  "🎯 เข้าทำแบบทดสอบ"                   │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ 🧮 คณิตพื้นฐาน               │      │
│  │ 📊 20 คำถาม  │ 🟢 ง่าย       │      │
│  │ ⏱ 10 นาที                    │      │
│  └───────────────────────────────┘      │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ 🎯 ใส่ชื่อของคุณ             │      │
│  └───────────────────────────────┘      │
│                                         │
│  [▶ เริ่มทำข้อสอบ] (gradient green)     │
│                                         │
│  Error states:                          │
│    - Quiz not found → error card        │
│    - No questions → alert               │
└─────────────────────────────────────────┘
```

### 3.12 Admin Login `/admin`

```
┌─────────────────────────────────────────┐
│  [← กลับ]                              │
│                                         │
│  🔐 (icon size 4rem)                    │
│  "เข้าสู่ระบบครู"                       │
│                                         │
│  ┌───────────────────────────────┐      │
│  │ 👤 ชื่อผู้ใช้                 │      │
│  └───────────────────────────────┘      │
│  ┌───────────────────────────────┐      │
│  │ 🔒 รหัสผ่าน                  │      │
│  └───────────────────────────────┘      │
│                                         │
│  [🔓 เข้าสู่ระบบ] (gradient purple)     │
│                                         │
│  * ระบบใหม่: ใช้ auth จาก                │
│    school management แทน                │
└─────────────────────────────────────────┘
```

### 3.13 Admin Dashboard `/admin/dashboard`

```
┌─────────────────────────────────────────┐
│  👨‍🏫 "แดชบอร์ดครู"  [🚪ออก] [←กลับ]   │
│  "จัดการข้อสอบและติดตามความก้าวหน้า"      │
│                                         │
│  Action Buttons (flex wrap):            │
│  [✨สร้างข้อสอบ] [📊ดูคะแนน]            │
│  [📂จัดการหมวดหมู่] [🏫จัดการโรงเรียน]    │
│                                         │
│  Stats Cards (grid 3 cols):             │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 📚   │ │ 🎯   │ │ 👥   │            │
│  │ 25   │ │ 500  │ │ 150  │            │
│  │ข้อสอบ│ │คำถาม │ │ครั้ง  │            │
│  └──────┘ └──────┘ └──────┘            │
│                                         │
│  Category Filter:                       │
│  [📚ทั้งหมด(25)] [🧮คณิต(8)] [🔬วิทย์]  │
│                                         │
│  Quiz List:                             │
│  ┌───────────────────────────────┐      │
│  │ 🧮 คณิตพื้นฐาน               │      │
│  │ 🏷️ คณิตศาสตร์ │ 20 คำถาม    │      │
│  │ 📅 15 มี.ค. 2026             │      │
│  │ [QR] [✏️แก้ไข] [🗑️ลบ]       │      │
│  └───────────────────────────────┘      │
│  ... more quizzes ...                   │
│                                         │
│  << < [1] [2] [3] ... [9] [10] > >>    │
│  แสดง 1-10 จาก 25    แถว/หน้า: [10]    │
└─────────────────────────────────────────┘
```

### 3.14 Quiz Editor `/admin/quiz/new` & `/admin/quiz/[id]/edit`

```
┌─────────────────────────────────────────┐
│  [← กลับ] "📝 สร้าง/แก้ไขข้อสอบ"       │
│  [💾 บันทึก] [📥 นำเข้า Excel]          │
│                                         │
│  ── ข้อมูลพื้นฐาน ──                    │
│  (grid 2 cols):                         │
│  ┌──────────────┐ ┌──────────────┐      │
│  │ 🇹🇭 ชื่อ(ไทย)│ │ 🇬🇧 ชื่อ(EN) │      │
│  └──────────────┘ └──────────────┘      │
│                                         │
│  Emoji: [grid 6 emoji buttons]          │
│  ระดับ: [SearchableDropdown ▼]          │
│  หมวด:  [SearchableDropdown ▼]          │
│                                         │
│  ── คำถาม (20 ข้อ) ──                   │
│  ┌───────────────────────────────┐      │
│  │ ข้อ 1                   [🗑️] │      │
│  │ ┌────────────┐ ┌────────────┐│      │
│  │ │คำถาม (TH) │ │คำถาม (EN) ││      │
│  │ └────────────┘ └────────────┘│      │
│  │ A: [__TH__] [__EN__]        │      │
│  │ B: [__TH__] [__EN__]        │      │
│  │ C: [__TH__] [__EN__]        │      │
│  │ D: [__TH__] [__EN__]        │      │
│  │ คำตอบถูก: [A ▼] (green)     │      │
│  │ คะแนน: [10]                 │      │
│  └───────────────────────────────┘      │
│  ... more questions ...                 │
│  [+ เพิ่มคำถาม]                         │
└─────────────────────────────────────────┘
```

### 3.15 Admin Scores `/admin/scores`

```
┌─────────────────────────────────────────┐
│  "📊 ระบบคะแนน"   [📥 Export] [←กลับ]  │
│                                         │
│  Filters (grid 4 cols):                 │
│  [🔍 ค้นหานักเรียน] [🏫 โรงเรียน ▼]    │
│  [📚 ข้อสอบ ▼]     [📅 ช่วงเวลา ▼]     │
│  (SearchableDropdown ทุกตัว)            │
│                                         │
│  Custom date (ถ้าเลือก "กำหนดเอง"):      │
│  [วันเริ่ม] [วันสิ้นสุด]                │
│                                         │
│  Stats Cards (grid 4 cols):             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ 👥   │ │ 🏆   │ │ 🎯   │ │ 📊   │   │
│  │ 50   │ │ 100% │ │ 72%  │ │ 150  │   │
│  │นักเรียน│ │สูงสุด│ │เฉลี่ย│ │ครั้ง  │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                         │
│  Score List:                            │
│  ┌───────────────────────────────┐      │
│  │ 👤 สมชาย │ 🏫 CodeLab       │      │
│  │ 📅 15 มี.ค. 2026             │      │
│  │ 🧮 คณิตพื้นฐาน │ 10 ข้อ     │      │
│  │ [90%] │ 90/100 │ ⏱ 3:45    │      │
│  │ [📋 ดูรายละเอียด]            │      │
│  └───────────────────────────────┘      │
│  ...                                    │
│                                         │
│  << < [1] [2] [3] ... [9] [10] > >>    │
│  แสดง 1-10 จาก 150   แถว/หน้า: [10]    │
└─────────────────────────────────────────┘
```

### 3.16 QR Code Modal (popup)

```
┌─────────────────────────────────────────┐
│  "📱 QR Code"                    [✕]   │
│  🧮 คณิตพื้นฐาน (bounce animation)      │
│                                         │
│  ┌───────────────┐                      │
│  │  ▓▓▓▓▓▓▓▓▓▓  │                      │
│  │  ▓ QR CODE ▓  │  Size: [128][256]    │
│  │  ▓▓▓▓▓▓▓▓▓▓  │        [512]         │
│  └───────────────┘                      │
│                                         │
│  URL: https://domain.com/?quiz=abc123   │
│  [📋 คัดลอก]                            │
│                                         │
│  📊 20 คำถาม │ 🟢 ง่าย                  │
│                                         │
│  [📥 ดาวน์โหลด] [🖨️ พิมพ์] [📤 แชร์]   │
│                                         │
│  วิธีใช้:                               │
│  1. ดาวน์โหลดหรือพิมพ์ QR Code          │
│  2. นักเรียนสแกน QR Code               │
│  3. เลือกจำนวนข้อ                       │
│  4. เริ่มทำแบบทดสอบ                     │
└─────────────────────────────────────────┘
```

### 3.17 Category Manager `/admin/categories`

```
┌─────────────────────────────────────────┐
│  [← กลับ]  "📂 จัดการหมวดหมู่"          │
│  [✨ เพิ่มหมวดหมู่ใหม่]                  │
│                                         │
│  Add Form (เมื่อกดเพิ่ม):               │
│  ┌───────────────────────────────┐      │
│  │ ชื่อ: [________]             │      │
│  │ สีธีม: [SearchableDropdown ▼] │      │
│  │ อีโมจิ: [grid 6 buttons]     │      │
│  │ คำอธิบาย: [________]         │      │
│  │ [💾 บันทึก] [✕ ยกเลิก]      │      │
│  └───────────────────────────────┘      │
│                                         │
│  Category Cards (grid):                 │
│  ┌───────────────────────────────┐      │
│  │ 🧮 คณิตศาสตร์                │      │
│  │ "บวก ลบ คูณ หาร"             │      │
│  │ gradient: blue-cyan           │      │
│  │ [✏️แก้ไข] [🗑️ลบ]            │      │
│  │                               │      │
│  │ Edit mode (inline):           │      │
│  │ [ชื่อ] [สี ▼] [emoji ▼]     │      │
│  │ [คำอธิบาย]                    │      │
│  │ [💾] [✕]                     │      │
│  └───────────────────────────────┘      │
│                                         │
│  Color options (10):                    │
│  บทเรียนเด่น, ธรรมชาติ, พลังงาน,       │
│  ท้องฟ้า, แสงแดด, หวานแหวว, ใบไม้,      │
│  ทองคำ, กลางคืน, คลาสสิค               │
│                                         │
│  Emoji options (12):                    │
│  📚 🧮 🔬 🌍 🎨 🎵 ⚽ 💻 🧪 📖 🎯 🌟    │
└─────────────────────────────────────────┘
```

### 3.18 School Manager `/admin/schools`

```
┌─────────────────────────────────────────┐
│  [← กลับ]  "🏫 จัดการโรงเรียน"          │
│  [➕ เพิ่มโรงเรียน]                      │
│                                         │
│  ┌─────────────┐ ┌─────────────┐        │
│  │ 🔍 ค้นหา... │ │📍 จังหวัด ▼│        │
│  └─────────────┘ └─────────────┘        │
│                                         │
│  School Cards (grid):                   │
│  ┌───────────────────────────────┐      │
│  │ 🏫 CodeLab เมืองทอง          │      │
│  │ 📍 นนทบุรี                    │      │
│  │ 👥 12 นักเรียน                │      │
│  │ [✏️แก้ไข] [🗑️ลบ]            │      │
│  └───────────────────────────────┘      │
│                                         │
│  Transfer Modal (เมื่อลบโรงเรียนที่มีนักเรียน): │
│  ┌───────────────────────────────┐      │
│  │ ⚠️ โรงเรียน "X" มีนักเรียน  │      │
│  │ กรุณาเลือกโรงเรียนปลายทาง    │      │
│  │ [SearchableDropdown ▼]        │      │
│  │ [ย้ายและลบ] [ยกเลิก]         │      │
│  └───────────────────────────────┘      │
└─────────────────────────────────────────┘
```

### 3.19 Quiz Import (ใน QuizEditor)

```
┌─────────────────────────────────────────┐
│  "📥 นำเข้าจาก Excel"             [✕]  │
│                                         │
│  [📄 ดาวน์โหลดเทมเพลต]                  │
│                                         │
│  รูปแบบไฟล์:                            │
│  ┌───────────────────────────────┐      │
│  │ A: คำถาม(TH)  B: คำถาม(EN)   │      │
│  │ C-F: ตัวเลือก(TH)            │      │
│  │ G-J: ตัวเลือก(EN)            │      │
│  │ K: คำตอบ (A/B/C/D)           │      │
│  │ L: คะแนน                      │      │
│  └───────────────────────────────┘      │
│                                         │
│  [📂 เลือกไฟล์ .xlsx]                   │
│                                         │
│  Preview (หลัง upload):                 │
│  ┌───────────────────────────────┐      │
│  │ ✅ ข้อ 1: "2+2=?" → A        │      │
│  │ ✅ ข้อ 2: "5×3=?" → C        │      │
│  │ ❌ ข้อ 3: ไม่มีคำตอบ         │      │
│  └───────────────────────────────┘      │
│                                         │
│  [✅ นำเข้า {n} ข้อ] [✕ ยกเลิก]        │
└─────────────────────────────────────────┘
```

---

## 4. Audio System (ย้ายตรงๆ)

```
ไฟล์ที่ต้องย้าย (client-side only, ไม่ต้องแก้):

lib/audio/
├── audio-service.ts     ← จาก audioService.js
│   ใช้ Tone.js
│   - buttonClick()       → UI click (C5 sine, 100ms)
│   - correctAnswer()     → success melody (C4 E4 G4)
│   - wrongAnswer()       → error (C3, 300ms)
│   - quizComplete()      → celebration (C5 E5 G5 C6)
│   - timeWarning()       → alert (G4)
│   - navigation()        → soft click
│   - achievement()       → two-part celebration
│
├── music-service.ts     ← จาก musicService.js
│   ใช้ HTML5 Audio
│   - initialize()        → setup
│   - playQuizMusic()     → play /quiz-music.mp3 (loop)
│   - pause() / resume()
│   - stop()
│   - setVolume(0-1)      → default 0.3
│   - fadeIn() / fadeOut()
│   - checkMusicFile()    → verify exists
│
└── simple-audio.ts      ← จาก simpleAudio.js
    ใช้ Web Audio API
    - playClickSound()    → 800Hz beep
    - correctAnswer()     → 523, 659, 784 Hz sequence
    - wrongAnswer()       → 200Hz

เมื่อไหร่ที่เสียงจะดัง:
- กดปุ่มใดๆ          → buttonClick()
- ตอบถูก             → correctAnswer()
- ตอบผิด             → wrongAnswer()
- ทำข้อสอบเสร็จ       → quizComplete()
- เหลือเวลา 60/30/10s → timeWarning()
- เปลี่ยนหน้า         → navigation()
- เริ่มทำข้อสอบ       → playQuizMusic() (background)

Asset:
- public/quiz-music.mp3  → background music (loop 30-60s)
```

---

## 5. Shared Features & Behavior

### 5.1 QR Code Sharing

```
Library:   react-qr-code
URL:       ${origin}/quiz/${quizId}
Features:  Download PNG, Print, Web Share API, Copy URL
Sizes:     128, 256, 512 px
```

### 5.2 Excel Import

```
Library:   xlsx (SheetJS)
Template:  Bilingual (TH/EN) columns
Validate:  Question exists, ≥2 options, valid answer A-D, numeric points
Preview:   Show parsed questions before import
```

### 5.3 Bilingual System

```
Languages: Thai (th), English (en)
Storage:   localStorage key "quizLanguage"
Function:  t(key, lang) → string
           getLocalizedField(obj, field, lang) → obj[field+Lang] || obj[field]
Keys:      435+ translation keys
Toggle:    GlobalHeader has TH/EN switch
```

### 5.4 Pagination Component

```
Props:     totalItems, currentPage, rowsPerPage, onPageChange, onRowsPerPageChange, lang
Display:   << < [prev] [current] [next] ... [last-1] [last] > >>
Options:   10, 25, 50, 100 rows/page
Info:      "แสดง 1-10 จาก 150 รายการ"
```

### 5.5 SearchableDropdown Component

```
Props:     value, onChange, options[{value,label}], placeholder, disabled, style, iconLeft, greenTheme
Behavior:  ≤7 options → custom dropdown (no search)
           >7 options → custom dropdown + search input
z-index:   9999
```

### 5.6 Timer Logic

```
Total time    = questionCount × 0.5 minutes (30 seconds/question)
Display       = MM:SS countdown
Color         = green (>20s) → yellow (>10s) → red (≤10s)
Warnings      = sound at 60s, 30s, 10s remaining
Time up       = auto-submit all remaining as unanswered
Per-question  = track time spent per question
```

### 5.7 Scoring

```
Points/question  = 10 (configurable)
Percentage       = (score / maxScore) × 100
Grade: A (≥90%) 🏆 / B (≥80%) 🌟 / C (≥70%) 👍 / D (≥60%) 💪 / F (<60%) 📚
```

### 5.8 Question Randomization

```
- shuffleArray() ใช้ Fisher-Yates algorithm
- ถ้า quiz มี > จำนวนที่เลือก → สุ่ม subset
- ทุกครั้งที่ทำ → คำถามสุ่มใหม่
```

### 5.9 CSV Export

```
Headers:  ชื่อนักเรียน, โรงเรียน, ข้อสอบ, คะแนน, คะแนนเต็ม, เปอร์เซ็นต์, จำนวนข้อ, เวลา(วินาที), วันที่
Encoding: UTF-8 with BOM (\ufeff)
Filename: quiz-scores-YYYY-MM-DD.csv
```

---

## 6. Dependencies (Next.js Project)

```json
{
  "dependencies": {
    "next": "latest",
    "react": "^19",
    "react-dom": "^19",
    "@supabase/supabase-js": "latest",
    "@supabase/ssr": "latest",
    "tone": "^15.1.22",
    "xlsx": "^0.18.5",
    "react-qr-code": "^2.0.12",
    "lucide-react": "latest",
    "tailwindcss": "latest"
  }
}
```

---

## 7. Environment Variables (Next.js)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# ถ้าต้องการ admin credentials แบบเดิม (optional)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

## 8. Integration กับ School Management

```
สิ่งที่ใช้ร่วมกัน:
├── Auth         → ใช้ Supabase Auth / NextAuth ของระบบเดิม
├── schools table → FK quiz_results.school_id → schools.id ของระบบเดิม
├── users table  → admin role check จากระบบเดิม
└── UI Theme     → ใช้ design system เดียวกัน

สิ่งที่เป็นของ quiz system เอง:
├── quiz_categories
├── quizzes
├── quiz_questions
└── quiz_results
```

---

## 9. ลำดับการ Implement

```
Phase 1: Foundation
  ├── สร้าง Supabase tables (migration SQL ด้านบน)
  ├── สร้าง service layer (lib/services/*.ts)
  ├── ย้าย common components (Pagination, SearchableDropdown, Modal)
  └── ย้าย utils, constants, translations

Phase 2: Student Flow
  ├── Landing page
  ├── Student login + school selection
  ├── Category selection + quiz list
  ├── Quiz taking (timer, scoring, audio)
  ├── Result page
  └── Student history + answer review

Phase 3: Admin Flow
  ├── Admin dashboard + quiz list + pagination
  ├── Quiz editor (create/edit) + import
  ├── QR Code modal
  ├── Admin scores + filters + export
  ├── Category manager
  └── School manager (integrate กับระบบเดิม)

Phase 4: Polish
  ├── Audio system (Tone.js, music)
  ├── Animations (slideUp, bounce, pulse)
  ├── Responsive testing
  └── Data migration จาก Firestore (ถ้ามี)
```
