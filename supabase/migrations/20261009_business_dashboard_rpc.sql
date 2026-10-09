-- Business overview dashboard (/reports/business, super_admin only).
-- One round-trip: per month × branch sales / cash / families / trial conversion /
-- attendance-check / feedback, plus per-branch course ranking and per-teacher
-- feedback by month. Computed live on every call (data volume is small: a few
-- thousand rows), so the page is always current without cron or caching.
--
-- Definitions (keep in sync with the page's footnotes)
--  * sales          = sum(enrollments.final_price), month of enrolled_at (Bangkok), status <> 'dropped'
--  * cash           = sum(payment_transactions.amount), month of transaction_date (Bangkok)
--  * collected / unpaid / unrecorded split the SAME enrollments as sales, so
--    sales = collected + unpaid + unrecorded exactly:
--      collected  = least(paid_amount, final_price)
--      unpaid     = final_price - paid_amount where payment_status <> 'paid'  (ค้างชำระ)
--      unrecorded = final_price - paid_amount where payment_status = 'paid'   (สถานะชำระแล้ว
--                   แต่ไม่ได้ลงยอด — legacy rows; listed by get_payment_gaps)
--  * new family     = parent whose FIRST non-dropped enrollment (all time) falls in that month
--                     (per branch in 'monthly'; 'familiesAll' counts each family ONCE across
--                     branches — use it for "ทุกสาขา", summing branches would double-count)
--  * trial attended = trial_sessions.status = 'attended', month of scheduled_date
--  * trial converted= attended AND (ts.converted OR the booking's family — matched by
--                     digits-only phone trial_bookings.parent_phone = parents.phone —
--                     has a non-dropped enrollment on/after the trial date, any course)
--  * sessions       = class_schedules not cancelled, session_date <= today (Bangkok)
--  * checked        = sessions with ≥1 attendance row
--  * attended/feedback = attendance rows present|late / those with non-empty feedback
--  * teacher        = COALESCE(class_schedules.actual_teacher_id, classes.teacher_id)

create or replace function public.get_business_dashboard(
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with bounds as (
  select
    date_trunc('month', coalesce(p_from, (now() at time zone 'Asia/Bangkok')::date - interval '11 months'))::date as m_from,
    date_trunc('month', coalesce(p_to, (now() at time zone 'Asia/Bangkok')::date))::date as m_to,
    (now() at time zone 'Asia/Bangkok')::date as today
),
months as (
  select generate_series(b.m_from, b.m_to, interval '1 month')::date as m from bounds b
),
br as (
  select id, name from branches
),
grid as (
  select months.m, br.id as branch_id from months cross join br
),
enr as (
  select e.id, e.parent_id, e.branch_id, e.class_id, e.final_price, e.paid_amount, e.status, e.payment_status,
         (e.enrolled_at at time zone 'Asia/Bangkok')::date as d,
         date_trunc('month', e.enrolled_at at time zone 'Asia/Bangkok')::date as m
  from enrollments e
  where e.status <> 'dropped'
),
first_fam as (
  select parent_id, min(m) as first_m from enr group by parent_id
),
sales as (
  select e.m, e.branch_id,
         count(*) as enrollments,
         sum(e.final_price) as sales,
         sum(least(e.paid_amount, e.final_price)) as collected,
         sum(greatest(e.final_price - e.paid_amount, 0)) filter (where e.payment_status <> 'paid') as unpaid,
         sum(greatest(e.final_price - e.paid_amount, 0)) filter (where e.payment_status = 'paid') as unrecorded,
         count(*) filter (where e.payment_status = 'paid' and e.final_price > e.paid_amount) as unrecorded_count,
         count(distinct e.parent_id) filter (where f.first_m = e.m) as new_families,
         count(distinct e.parent_id) filter (where f.first_m < e.m) as returning_families
  from enr e join first_fam f using (parent_id)
  group by 1, 2
),
families_all as (
  select e.m,
         count(distinct e.parent_id) filter (where f.first_m = e.m) as new_families,
         count(distinct e.parent_id) filter (where f.first_m < e.m) as returning_families
  from enr e join first_fam f using (parent_id), bounds b
  where e.m between b.m_from and b.m_to
  group by 1
),
families_range as (
  select count(distinct e.parent_id) filter (where f.first_m between b.m_from and b.m_to) as new_families
  from enr e join first_fam f using (parent_id), bounds b
  where e.m between b.m_from and b.m_to
),
cash as (
  select date_trunc('month', p.transaction_date at time zone 'Asia/Bangkok')::date as m,
         e.branch_id, sum(p.amount) as cash
  from payment_transactions p join enrollments e on e.id = p.enrollment_id
  group by 1, 2
),
bookings as (
  select date_trunc('month', tb.created_at at time zone 'Asia/Bangkok')::date as m,
         tb.branch_id, count(*) as trial_bookings
  from trial_bookings tb
  group by 1, 2
),
fam_phone as (
  select regexp_replace(p.phone, '\D', '', 'g') as ph, e.d
  from enr e join parents p on p.id = e.parent_id
  where coalesce(p.phone, '') <> ''
),
trials as (
  select date_trunc('month', ts.scheduled_date)::date as m, ts.branch_id,
         count(*) filter (where ts.status = 'attended') as trial_attended,
         count(*) filter (where ts.status = 'absent') as trial_no_show,
         count(*) filter (
           where ts.status = 'attended' and (
             coalesce(ts.converted, false)
             or exists (
               select 1 from fam_phone fp
               where fp.ph = regexp_replace(tb.parent_phone, '\D', '', 'g')
                 and fp.d >= ts.scheduled_date
             )
           )
         ) as trial_converted
  from trial_sessions ts join trial_bookings tb on tb.id = ts.booking_id
  group by 1, 2
),
sched as (
  select cs.id, cs.session_date, c.branch_id,
         coalesce(cs.actual_teacher_id, c.teacher_id) as teacher_id,
         date_trunc('month', cs.session_date)::date as m
  from class_schedules cs join classes c on c.id = cs.class_id, bounds b
  where cs.status <> 'cancelled'
    and cs.session_date >= b.m_from
    and cs.session_date <= least(b.today, (b.m_to + interval '1 month - 1 day')::date)
),
checks as (
  select s.m, s.branch_id,
         count(*) as sessions,
         count(*) filter (where exists (select 1 from attendance a where a.schedule_id = s.id)) as checked
  from sched s group by 1, 2
),
att as (
  select s.m, s.branch_id, s.teacher_id,
         count(*) as attended,
         count(*) filter (where coalesce(trim(a.feedback), '') <> '') as feedback,
         count(*) filter (where cardinality(a.photos) > 0) as photos
  from attendance a join sched s on s.id = a.schedule_id
  where a.status in ('present', 'late')
  group by 1, 2, 3
),
att_br as (
  select m, branch_id, sum(attended) as attended, sum(feedback) as feedback
  from att group by 1, 2
),
monthly as (
  select g.m, g.branch_id,
         coalesce(s.enrollments, 0) as enrollments,
         coalesce(s.sales, 0) as sales,
         coalesce(c.cash, 0) as cash,
         coalesce(s.collected, 0) as collected,
         coalesce(s.unpaid, 0) as unpaid,
         coalesce(s.unrecorded, 0) as unrecorded,
         coalesce(s.unrecorded_count, 0) as unrecorded_count,
         coalesce(s.new_families, 0) as new_families,
         coalesce(s.returning_families, 0) as returning_families,
         coalesce(bk.trial_bookings, 0) as trial_bookings,
         coalesce(t.trial_attended, 0) as trial_attended,
         coalesce(t.trial_converted, 0) as trial_converted,
         coalesce(t.trial_no_show, 0) as trial_no_show,
         coalesce(ch.sessions, 0) as sessions,
         coalesce(ch.checked, 0) as checked,
         coalesce(ab.attended, 0) as attended,
         coalesce(ab.feedback, 0) as feedback
  from grid g
  left join sales s on s.m = g.m and s.branch_id = g.branch_id
  left join cash c on c.m = g.m and c.branch_id = g.branch_id
  left join bookings bk on bk.m = g.m and bk.branch_id = g.branch_id
  left join trials t on t.m = g.m and t.branch_id = g.branch_id
  left join checks ch on ch.m = g.m and ch.branch_id = g.branch_id
  left join att_br ab on ab.m = g.m and ab.branch_id = g.branch_id
),
courses as (
  select e.branch_id, trim(s.name) as subject, count(*) as enrollments, sum(e.final_price) as sales
  from enr e
  join classes c on c.id = e.class_id
  join subjects s on s.id = c.subject_id, bounds b
  where e.m between b.m_from and b.m_to
  group by 1, 2
)
select jsonb_build_object(
  'generatedAt', now(),
  'from', to_char((select m_from from bounds), 'YYYY-MM'),
  'to', to_char((select m_to from bounds), 'YYYY-MM'),
  'today', to_char((select today from bounds), 'YYYY-MM-DD'),
  'branches', coalesce((
    select jsonb_agg(jsonb_build_object('id', br.id, 'name', br.name) order by br.name)
    from br
  ), '[]'::jsonb),
  'monthly', coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(m, 'YYYY-MM'), 'branchId', branch_id,
      'enrollments', enrollments, 'sales', sales, 'cash', cash,
      'collected', collected, 'unpaid', unpaid, 'unrecorded', unrecorded, 'unrecordedCount', unrecorded_count,
      'newFamilies', new_families, 'returningFamilies', returning_families,
      'trialBookings', trial_bookings, 'trialAttended', trial_attended,
      'trialConverted', trial_converted, 'trialNoShow', trial_no_show,
      'sessions', sessions, 'checked', checked,
      'attended', attended, 'feedback', feedback
    ) order by m, branch_id)
    from monthly
  ), '[]'::jsonb),
  'familiesAll', coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(months.m, 'YYYY-MM'),
      'newFamilies', coalesce(fa.new_families, 0),
      'returningFamilies', coalesce(fa.returning_families, 0)
    ) order by months.m)
    from months left join families_all fa on fa.m = months.m
  ), '[]'::jsonb),
  'newFamiliesInRange', (select new_families from families_range),
  'courses', coalesce((
    select jsonb_agg(jsonb_build_object(
      'branchId', branch_id, 'subject', subject, 'enrollments', enrollments, 'sales', sales
    ) order by sales desc)
    from courses
  ), '[]'::jsonb),
  'teachers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(a.m, 'YYYY-MM'), 'branchId', a.branch_id,
      'teacherId', a.teacher_id, 'nickname', coalesce(t.nickname, t.name, '-'),
      'attended', a.attended, 'feedback', a.feedback, 'photos', a.photos
    ) order by a.m, t.nickname)
    from att a left join teachers t on t.id = a.teacher_id
  ), '[]'::jsonb)
);
$function$;

revoke execute on function public.get_business_dashboard(date, date) from public, anon, authenticated;
grant execute on function public.get_business_dashboard(date, date) to service_role;

comment on function public.get_business_dashboard(date, date) is
  'Super-admin business overview for /reports/business: per month×branch sales (= collected + unpaid + unrecorded), cash, new/returning families, trial bookings & conversion (attended → family enrolled on/after trial date, matched by phone), attendance-check and feedback rates; per-branch course ranking; per-teacher feedback. Live, no caching.';

-- ---------------------------------------------------------------------------
-- Enrollments whose money isn't fully recorded (/reports/payment-gaps).
--  kind 'unrecorded' = payment_status 'paid' but paid_amount < final_price
--                      (มีสถานะ/วันที่จ่าย แต่ไม่ได้ลงยอดเงิน — mostly pre-payment_transactions data)
--  kind 'unpaid'     = payment_status <> 'paid' and paid_amount < final_price (ค้างชำระจริง)
-- Progress: sessions of the class held so far (non-cancelled, <= today Bangkok)
-- vs total, the student's own present/late count, and the last session date
-- (= วันจบจริง, falls back to classes.end_date).
create or replace function public.get_payment_gaps()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
with today as (select (now() at time zone 'Asia/Bangkok')::date as d),
gaps as (
  select e.*
  from enrollments e
  where e.status <> 'dropped' and e.final_price > e.paid_amount
),
sess as (
  select cs.class_id,
         count(*) as total,
         count(*) filter (where cs.session_date <= (select d from today)) as done,
         max(cs.session_date) as last_date
  from class_schedules cs
  where cs.status <> 'cancelled' and cs.class_id in (select class_id from gaps)
  group by 1
),
att as (
  select g.id as enrollment_id, count(a.*) as attended
  from gaps g
  join class_schedules cs on cs.class_id = g.class_id
  join attendance a on a.schedule_id = cs.id and a.student_id = g.student_id and a.status in ('present', 'late')
  group by 1
),
tx as (
  select p.enrollment_id, count(*) as n, sum(p.amount) as amount
  from payment_transactions p where p.enrollment_id in (select id from gaps)
  group by 1
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', g.id,
  'kind', case when g.payment_status = 'paid' then 'unrecorded' else 'unpaid' end,
  'paymentStatus', g.payment_status,
  'enrollmentStatus', g.status,
  'studentName', st.name,
  'studentNickname', st.nickname,
  'parentName', coalesce(nullif(pa.display_name, ''), pa.line_display_name),
  'parentPhone', pa.phone,
  'branchId', g.branch_id,
  'branchName', b.name,
  'classId', c.id,
  'classCode', c.name,
  'subject', trim(su.name),
  'classStatus', c.status,
  'enrolledAt', to_char(g.enrolled_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD'),
  'paidDate', to_char(g.paid_date at time zone 'Asia/Bangkok', 'YYYY-MM-DD'),
  'paymentMethod', g.payment_method,
  'finalPrice', g.final_price,
  'paidAmount', g.paid_amount,
  'gap', g.final_price - g.paid_amount,
  'transactions', coalesce(tx.n, 0),
  'classStart', to_char(c.start_date, 'YYYY-MM-DD'),
  'classEnd', to_char(coalesce(se.last_date, c.end_date), 'YYYY-MM-DD'),
  'sessionsTotal', coalesce(se.total, c.total_sessions, 0),
  'sessionsDone', coalesce(se.done, 0),
  'attended', coalesce(at.attended, 0)
) order by g.enrolled_at desc), '[]'::jsonb)
from gaps g
join students st on st.id = g.student_id
left join parents pa on pa.id = g.parent_id
join branches b on b.id = g.branch_id
join classes c on c.id = g.class_id
left join subjects su on su.id = c.subject_id
left join sess se on se.class_id = g.class_id
left join att at on at.enrollment_id = g.id
left join tx on tx.enrollment_id = g.id;
$function$;

revoke execute on function public.get_payment_gaps() from public, anon, authenticated;
grant execute on function public.get_payment_gaps() to service_role;

comment on function public.get_payment_gaps() is
  'Super-admin list for /reports/payment-gaps: non-dropped enrollments with final_price > paid_amount, split unrecorded (payment_status paid, amount not recorded) vs unpaid, with class progress and end date.';
