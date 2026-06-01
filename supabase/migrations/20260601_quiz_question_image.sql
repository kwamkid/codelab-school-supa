-- Optional image attached to a quiz question (shown in the question, not choices).
alter table public.quiz_questions add column if not exists image_url text;
-- public bucket for quiz question images (images are uploaded resized/compressed)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-images','quiz-images', true, 2097152, '{image/jpeg,image/png,image/webp,image/gif}')
on conflict (id) do update set public = true;
