-- No-emoji: store lucide icon names instead of emoji on quizzes/categories.
-- Also add competency tag on questions for future per-indicator analytics (B1).
alter table public.quizzes add column if not exists icon text;
alter table public.quiz_categories add column if not exists icon text;
alter table public.quiz_questions add column if not exists competency text;

update public.quiz_categories
  set icon = case name when 'Coding' then 'Code2' when 'Robotics' then 'Bot' else 'Sparkles' end
  where icon is null;
update public.quizzes set icon = 'Code2' where icon is null;
