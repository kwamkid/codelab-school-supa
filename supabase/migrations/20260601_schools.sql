-- Schools master table: canonical name + English/abbreviation/aliases so quiz login
-- and forms accept full Thai names AND short/English forms (resolve alias -> canonical).
-- students.school_name keeps the CANONICAL name (no FK migration).
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  name_en text,
  abbreviation text,
  aliases text[] default '{}',
  province text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists schools_name_idx on public.schools (name);

insert into public.schools (name)
select distinct trim(school_name) from public.students
where school_name is not null and trim(school_name) <> ''
on conflict (name) do nothing;

alter table public.schools enable row level security;
