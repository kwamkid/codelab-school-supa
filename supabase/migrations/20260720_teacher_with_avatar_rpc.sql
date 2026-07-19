-- Single-teacher variant of get_active_teachers_with_avatar: resolves
-- profile_image → linked admin_user's Google avatar (same COALESCE). Needed by
-- getTeacher() — a plain teachers read only sees profile_image, which is empty
-- for everyone, so pages showing ONE teacher (e.g. class detail) had no photo.
-- No is_active filter: detail pages may reference an inactive teacher.
create or replace function public.get_teacher_with_avatar(p_id uuid)
returns table (
  id uuid, name text, name_en text, nickname text, email text, phone text,
  specialties text[], available_branches uuid[], profile_image text,
  hourly_rate numeric, bank_name text, bank_account_number text,
  bank_account_name text, is_active boolean,
  created_at timestamptz, updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.name, t.name_en, t.nickname, t.email, t.phone,
    t.specialties, t.available_branches,
    coalesce(nullif(t.profile_image, ''), au_u.avatar_url) as profile_image,
    t.hourly_rate, t.bank_name, t.bank_account_number, t.bank_account_name,
    t.is_active, t.created_at, t.updated_at
  from teachers t
  left join lateral (
    select coalesce(
             u.raw_user_meta_data->>'avatar_url',
             u.raw_user_meta_data->>'picture'
           ) as avatar_url
    from admin_users au
    left join auth.users u on lower(u.email) = lower(au.email)
    where au.teacher_id = t.id
      and coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') is not null
    limit 1
  ) au_u on true
  where t.id = p_id;
$$;
