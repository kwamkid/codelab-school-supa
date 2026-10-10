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
--  * classes: students = real non-dropped enrollments; opened = by start_date month
--    (series starts 12 months before p_from so the page can compare year-on-year);
--    active/upcoming(60d)/ending-this-month are snapshots as of today;
--    continuation = finished a class in month M and enrolled in another class
--    starting within [end-30d, end+60d]
--  * revenue per class = sum of non-dropped enrollment final_price of classes opened that month
--  * atRiskStudents = active enrollment in a started class with ≥2 most-recent checked
--    sessions not attended (absent/leave/sick) in a row
--  * forwardRevenue = enrollments in classes whose start_date is after today

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
),
-- ---------- classes ----------
-- students per class = real non-dropped enrollments (classes.enrolled_count can drift)
class_students as (
  select class_id, count(*) as students, sum(final_price) as revenue,
         sum(least(paid_amount, final_price)) as collected
  from enrollments where status <> 'dropped' group by 1
),
cls as (
  select c.id, c.name, c.branch_id, c.status, c.start_date, c.end_date, c.start_time, c.end_time,
         c.days_of_week, c.max_students, c.min_students, c.teacher_id,
         coalesce(cs.students, 0) as students, coalesce(cs.revenue, 0) as revenue,
         coalesce(cs.collected, 0) as collected, trim(su.name) as subject,
         coalesce(t.nickname, t.name) as teacher
  from classes c
  left join class_students cs on cs.class_id = c.id
  left join subjects su on su.id = c.subject_id
  left join teachers t on t.id = c.teacher_id
  where c.status <> 'cancelled'
),
-- classes opened per month (by start_date) — for growth vs previous month / last year
classes_monthly as (
  select date_trunc('month', c.start_date)::date as m, c.branch_id,
         count(*) as opened, sum(c.students) as students, sum(coalesce(c.max_students, 0)) as seats,
         sum(c.revenue) as revenue
  from cls c, bounds b
  where c.start_date >= (b.m_from - interval '12 months') and c.start_date < (b.m_to + interval '1 month')
  group by 1, 2
),
-- continuation: students whose class ended in month M → enrolled in another class
-- starting within [end-30d, end+60d]. Recent months keep rising as people re-enroll.
finished as (
  select e.student_id, e.branch_id, c.id as class_id, c.end_date,
         date_trunc('month', c.end_date)::date as m
  from enrollments e join cls c on c.id = e.class_id, bounds b
  where e.status <> 'dropped' and c.end_date between b.m_from and least(b.today, (b.m_to + interval '1 month - 1 day')::date)
),
continuation as (
  select f.m, f.branch_id, count(*) as finished,
         count(*) filter (where exists (
           select 1 from enrollments e2 join cls c2 on c2.id = e2.class_id
           where e2.student_id = f.student_id and e2.status <> 'dropped' and c2.id <> f.class_id
             and c2.start_date between f.end_date - 30 and f.end_date + 60
         )) as continued
  from finished f group by 1, 2
),
class_row as (
  select c.*, jsonb_build_object(
    'id', c.id, 'code', c.name, 'subject', c.subject, 'branchId', c.branch_id, 'status', c.status,
    'startDate', to_char(c.start_date, 'YYYY-MM-DD'), 'endDate', to_char(c.end_date, 'YYYY-MM-DD'),
    'startTime', to_char(c.start_time, 'HH24:MI'), 'endTime', to_char(c.end_time, 'HH24:MI'),
    'daysOfWeek', c.days_of_week, 'teacher', c.teacher,
    'students', c.students, 'maxStudents', c.max_students, 'minStudents', c.min_students
  ) as j
  from cls c
),
-- at-risk: active enrollment in a running class whose most recent CHECKED sessions
-- are consecutive non-attendance (absent/leave/sick). streak = sessions since last
-- present/late (all checked sessions if never present). Unchecked sessions are skipped.
att_hist as (
  select e.id as enrollment_id, e.student_id, e.parent_id, e.branch_id, e.class_id,
         cs.session_date, a.status::text as st,
         row_number() over (partition by e.id order by cs.session_date desc) as rn
  from enrollments e
  join cls c on c.id = e.class_id and c.status = 'started'
  join class_schedules cs on cs.class_id = c.id and cs.status <> 'cancelled'
  join attendance a on a.schedule_id = cs.id and a.student_id = e.student_id, bounds b
  where e.status = 'active' and cs.session_date <= b.today
),
streaks as (
  select enrollment_id, student_id, parent_id, branch_id, class_id,
         coalesce(min(rn) filter (where st in ('present', 'late')) - 1, count(*)) as streak,
         max(session_date) filter (where st in ('present', 'late')) as last_present,
         max(session_date) as last_checked
  from att_hist group by 1, 2, 3, 4, 5
),
at_risk as (
  select s.*, 
         (select count(*) from att_hist h where h.enrollment_id = s.enrollment_id and h.rn <= s.streak and h.st = 'absent') as absent_n,
         (select count(*) from att_hist h where h.enrollment_id = s.enrollment_id and h.rn <= s.streak and h.st <> 'absent') as excused_n
  from streaks s where s.streak >= 2
),
-- forward revenue: enrollments in classes that haven't started yet
forward as (
  select c.branch_id, count(distinct c.id) as classes, sum(c.students) as enrollments,
         sum(c.revenue) as sales, sum(c.collected) as collected
  from cls c, bounds b
  where c.start_date > b.today and c.status not in ('completed', 'started')
  group by 1
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
  'classesMonthly', coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(m, 'YYYY-MM'), 'branchId', branch_id,
      'opened', opened, 'students', students, 'seats', seats, 'revenue', revenue
    ) order by m, branch_id) from classes_monthly
  ), '[]'::jsonb),
  'continuation', coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(m, 'YYYY-MM'), 'branchId', branch_id, 'finished', finished, 'continued', continued
    ) order by m, branch_id) from continuation
  ), '[]'::jsonb),
  -- snapshot as of today (ignores the selected range)
  'classesActive', coalesce((
    select jsonb_agg(jsonb_build_object('branchId', branch_id, 'classes', n, 'students', st, 'seats', seats))
    from (
      select c.branch_id, count(*) as n, sum(c.students) as st, sum(coalesce(c.max_students, 0)) as seats
      from cls c, bounds b
      where c.status = 'started' or (c.status <> 'completed' and c.start_date <= b.today and c.end_date >= b.today)
      group by 1
    ) x
  ), '[]'::jsonb),
  'classesUpcoming', coalesce((
    select jsonb_agg(cr.j order by cr.start_date, cr.start_time)
    from class_row cr, bounds b
    where cr.status not in ('completed', 'started') and cr.start_date > b.today and cr.start_date <= b.today + 60
  ), '[]'::jsonb),
  'classesEndingThisMonth', coalesce((
    select jsonb_agg(cr.j order by cr.end_date)
    from class_row cr, bounds b
    where cr.end_date between date_trunc('month', b.today)::date and (date_trunc('month', b.today) + interval '1 month - 1 day')::date
  ), '[]'::jsonb),
  'atRiskStudents', coalesce((
    select jsonb_agg(jsonb_build_object(
      'enrollmentId', r.enrollment_id, 'studentId', r.student_id, 'branchId', r.branch_id,
      'studentName', st.name, 'studentNickname', st.nickname,
      'parentName', coalesce(nullif(pa.display_name, ''), pa.line_display_name), 'parentPhone', pa.phone,
      'classId', r.class_id, 'subject', c.subject, 'teacher', c.teacher,
      'streak', r.streak, 'absent', r.absent_n, 'excused', r.excused_n,
      'lastPresent', to_char(r.last_present, 'YYYY-MM-DD'), 'lastChecked', to_char(r.last_checked, 'YYYY-MM-DD')
    ) order by r.streak desc, r.last_checked desc)
    from at_risk r
    join students st on st.id = r.student_id
    left join parents pa on pa.id = r.parent_id
    join cls c on c.id = r.class_id
  ), '[]'::jsonb),
  'forwardRevenue', coalesce((
    select jsonb_agg(jsonb_build_object(
      'branchId', branch_id, 'classes', classes, 'enrollments', enrollments, 'sales', sales, 'collected', collected
    )) from forward
  ), '[]'::jsonb),
  'courses', coalesce((
    select jsonb_agg(jsonb_build_object(
      'branchId', branch_id, 'subject', subject, 'enrollments', enrollments, 'sales', sales
    ) order by sales desc)
    from courses
  ), '[]'::jsonb),
  'teachers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'month', to_char(a.m, 'YYYY-MM'), 'branchId', a.branch_id,
      'teacherId', a.teacher_id, 'nickname', coalesce(t.nickname, t.name, '-'), 'isActive', coalesce(t.is_active, true),
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
