-- Optional per-quiz random draw: how many questions to randomly pull from the
-- question pool each attempt (null/0 = use all). Anti-cheat: different kids get
-- different questions; order + options are also shuffled client-side per attempt.
alter table public.quizzes add column if not exists question_count int;
