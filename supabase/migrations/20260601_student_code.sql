-- Human-friendly student code (CL0001, CL0002, ...) so kids can identify
-- themselves in quizzes by code instead of typing their name.
-- Codes run in REGISTRATION ORDER (earliest signup = lowest number).
-- Auto-generated via sequence + BEFORE INSERT trigger (covers all creation paths).

create sequence if not exists public.student_code_seq;

alter table public.students add column if not exists student_code text;
-- students had no timestamp; add one so registration order is unambiguous going forward
alter table public.students add column if not exists created_at timestamptz default now();

-- Backfill existing students in registration order.
-- students has no own timestamp, so use the parent's created_at as the proxy
-- (parent signup time), then older child first, then name/id for stable ties.
with ordered as (
  select s.id,
         row_number() over (
           order by p.created_at asc nulls last, s.birthdate asc, s.name, s.id
         ) as rn
  from public.students s
  left join public.parents p on p.id = s.parent_id
)
update public.students s
set student_code = 'CL' || lpad(o.rn::text, 4, '0')
from ordered o
where s.id = o.id;

select setval('public.student_code_seq',
  greatest(1, (select count(*) from public.students)));

alter table public.students add constraint students_student_code_key unique (student_code);

create or replace function public.set_student_code() returns trigger as $$
begin
  if new.student_code is null then
    new.student_code := 'CL' || lpad(nextval('public.student_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_student_code on public.students;
create trigger trg_set_student_code before insert on public.students
  for each row execute function public.set_student_code();
