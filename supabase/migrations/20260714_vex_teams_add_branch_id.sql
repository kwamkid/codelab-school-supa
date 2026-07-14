-- Add branch scoping to VEX teams. branch_id holds a public.branches.id
-- (plain uuid, no cross-schema FK — same convention as parent_id/reviewed_by).
alter table vex.teams add column if not exists branch_id uuid;

comment on column vex.teams.branch_id is 'public.branches.id (no cross-schema FK)';

-- Backfill existing teams: numbers starting with 3883 → เมืองทองธานี, the rest → พระราม 2.
update vex.teams
set branch_id = (select id from public.branches where name = 'เมืองทองธานี' limit 1)
where team_number like '3883%' and branch_id is null;

update vex.teams
set branch_id = (select id from public.branches where name = 'พระราม 2' limit 1)
where team_number not like '3883%' and branch_id is null;
