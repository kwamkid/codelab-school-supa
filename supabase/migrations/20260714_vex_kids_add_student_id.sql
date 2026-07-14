-- Link a VEX kid to a real public.students row. nickname/full_name stay as a
-- snapshot (so the roster still reads if a student is renamed/deactivated).
-- Plain uuid, no cross-schema FK (same convention as parent_id/branch_id).
alter table vex.kids add column if not exists student_id uuid;

comment on column vex.kids.student_id is 'public.students.id (no cross-schema FK); nickname/full_name are a snapshot';
