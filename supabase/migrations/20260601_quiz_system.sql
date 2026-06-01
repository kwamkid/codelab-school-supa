-- Quiz system — migrated from the existing Firestore quiz app per dev-plan/quiz.md.
-- Adaptations for integration with this school-management app:
--   * student identity = student_code + school_name (not just name); link to students.id
--   * no separate `schools` table → use students.school_name (free text)
--   * admin = existing admin_users (teacher/super_admin), not ADMIN_USER/PASS
--   * RLS on, NO public policies → all access via service-role API routes
--     (student pages get questions WITHOUT correct_answer; grading is server-side)

create or replace function public.quiz_set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

create table if not exists public.quiz_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '📚',
  description text,
  color text default 'from-purple-400 to-pink-400',
  icon_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_th text,
  title_en text,
  emoji text default '📝',
  difficulty text check (difficulty in ('ง่าย','ปานกลาง','ยาก')) default 'ปานกลาง',
  category_id uuid references public.quiz_categories(id) on delete set null,
  is_active boolean default true,
  created_by uuid references public.admin_users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  sort_order int default 0,
  question text,
  question_th text,
  question_en text,
  options jsonb default '[]',
  options_th jsonb default '[]',
  options_en jsonb default '[]',
  correct_answer int not null check (correct_answer between 0 and 3),
  points int default 10,
  created_at timestamptz default now()
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, sort_order);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  student_code text,
  student_name text not null,
  school_name text,
  quiz_id uuid references public.quizzes(id) on delete set null,
  quiz_title text,
  quiz_title_th text,
  quiz_title_en text,
  emoji text,
  difficulty text,
  score int default 0,
  max_score int default 0,
  percentage numeric(5,2) default 0,
  total_questions int default 0,
  selected_question_count int,
  original_total_questions int,
  total_time int default 0,
  answers jsonb default '[]',
  quiz_data jsonb,
  created_at timestamptz default now()
);
create index if not exists quiz_results_student_idx on public.quiz_results(student_id);
create index if not exists quiz_results_quiz_idx on public.quiz_results(quiz_id);
create index if not exists quiz_results_created_idx on public.quiz_results(created_at desc);

drop trigger if exists quizzes_updated_at on public.quizzes;
create trigger quizzes_updated_at before update on public.quizzes
  for each row execute function public.quiz_set_updated_at();
drop trigger if exists quiz_categories_updated_at on public.quiz_categories;
create trigger quiz_categories_updated_at before update on public.quiz_categories
  for each row execute function public.quiz_set_updated_at();

alter table public.quiz_categories enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_results enable row level security;
