-- Tag each quiz result with the student's branch (from their latest enrollment),
-- so teachers can measure quiz performance per branch (สาขา).
alter table public.quiz_results add column if not exists branch_id uuid;
alter table public.quiz_results add column if not exists branch_name text;
