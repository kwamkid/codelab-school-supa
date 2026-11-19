-- Ad attribution: remember which Meta ad a customer came from (no 7-day window),
-- and give the Conversions API the identifiers it needs to match purchases back
-- to ads (click-to-Messenger PSID, fbc/fbp click ids).

-- 1) One row per (chat contact, ad). Filled by the FB/IG webhook from the
--    `referral` object Meta attaches when someone opens a chat from an ad.
create table if not exists public.ad_referrals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.chat_contacts(id) on delete cascade,
  platform text not null,                    -- facebook | instagram
  ad_id text not null,
  ad_title text,                             -- ads_context_data.ad_title (what the person saw)
  ad_name text,                              -- resolved from Marketing API (best effort)
  adset_name text,
  campaign_id text,
  campaign_name text,
  photo_url text,
  ref text,
  first_referred_at timestamptz not null default now(),
  last_referred_at timestamptz not null default now(),
  hits int not null default 1,
  raw jsonb,
  unique (contact_id, ad_id)
);
create index if not exists ad_referrals_contact_idx on public.ad_referrals (contact_id, first_referred_at);
create index if not exists ad_referrals_campaign_idx on public.ad_referrals (campaign_id);

alter table public.ad_referrals enable row level security;
drop policy if exists ad_referrals_staff_read on public.ad_referrals;
create policy ad_referrals_staff_read on public.ad_referrals
  for select to authenticated using ((select public.is_staff()));

-- 2) Click ids captured on the online trial booking form (?fbclid → fbc, _fbp cookie).
alter table public.trial_bookings
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists client_user_agent text;

-- 3) Phones written in chat get stored on chat_contacts.phone (already exists) and
--    used to link FB/IG contacts to parents by phone. Index the digits for that.
create index if not exists chat_contacts_phone_idx on public.chat_contacts (phone) where phone is not null;

-- 4) Ad source of a parent: every ad any of their chat contacts came from, oldest first.
--    Matches by explicit link (chat_contacts.parent_id) OR same phone digits.
create or replace function public.get_parent_ad_sources(p_parent_id uuid)
returns table (
  ad_id text, ad_title text, ad_name text, adset_name text, campaign_name text,
  platform text, first_referred_at timestamptz, last_referred_at timestamptz,
  contact_id uuid, contact_name text
)
language sql stable security definer set search_path = public as $$
  with p as (
    select id, regexp_replace(coalesce(phone, ''), '\D', '', 'g') as digits
    from parents where id = p_parent_id
      and (auth.role() = 'service_role' or (select public.is_staff()))
  ),
  c as (
    select cc.id, cc.display_name
    from chat_contacts cc, p
    where cc.parent_id = p.id
       or (length(p.digits) >= 9 and regexp_replace(coalesce(cc.phone, ''), '\D', '', 'g') = p.digits)
  )
  select r.ad_id, r.ad_title, r.ad_name, r.adset_name, r.campaign_name, r.platform,
         r.first_referred_at, r.last_referred_at, c.id, c.display_name
  from ad_referrals r join c on c.id = r.contact_id
  order by r.first_referred_at;
$$;
revoke execute on function public.get_parent_ad_sources(uuid) from public, anon;
grant execute on function public.get_parent_ad_sources(uuid) to authenticated, service_role;
