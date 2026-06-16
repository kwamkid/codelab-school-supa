-- get_events_with_stats: add per-branch registration counts, per-branch capacity,
-- and the event date range (first/last event_schedules.date) so the admin Events
-- list can show which branch is full vs. open at a glance and a real "วันที่จัด".
CREATE OR REPLACE FUNCTION public.get_events_with_stats(p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) INTO result
  FROM (
    SELECT
      ev.*,
      COALESCE(reg.total_registrations, 0) AS total_registrations,
      COALESCE(reg.total_attendees, 0) AS total_attendees,
      COALESCE(rbb.registrations_by_branch, '{}'::jsonb) AS registrations_by_branch,
      COALESCE(cap.capacity_by_branch, '{}'::jsonb) AS capacity_by_branch,
      sch.first_event_date,
      sch.last_event_date
    FROM events ev
    LEFT JOIN (
      SELECT
        event_id,
        COUNT(*) AS total_registrations,
        SUM(attendee_count) AS total_attendees
      FROM event_registrations
      WHERE status != 'cancelled'
      GROUP BY event_id
    ) reg ON reg.event_id = ev.id
    -- registered attendees per branch (non-cancelled), keyed by branch_id
    LEFT JOIN (
      SELECT
        event_id,
        jsonb_object_agg(branch_id::text, branch_attendees) AS registrations_by_branch
      FROM (
        SELECT event_id, branch_id, SUM(attendee_count) AS branch_attendees
        FROM event_registrations
        WHERE status != 'cancelled' AND branch_id IS NOT NULL
        GROUP BY event_id, branch_id
      ) r
      GROUP BY event_id
    ) rbb ON rbb.event_id = ev.id
    -- event date range from schedules
    LEFT JOIN (
      SELECT
        event_id,
        MIN(date) AS first_event_date,
        MAX(date) AS last_event_date
      FROM event_schedules
      WHERE status != 'cancelled'
      GROUP BY event_id
    ) sch ON sch.event_id = ev.id
    -- summed quota per branch across all schedules, keyed by branch_id
    LEFT JOIN (
      SELECT
        event_id,
        jsonb_object_agg(bkey, btotal) AS capacity_by_branch
      FROM (
        SELECT
          s.event_id,
          kv.key AS bkey,
          SUM((kv.value)::int) AS btotal
        FROM event_schedules s
        CROSS JOIN LATERAL jsonb_each_text(COALESCE(s.max_attendees_by_branch, '{}'::jsonb)) kv
        WHERE s.status != 'cancelled'
        GROUP BY s.event_id, kv.key
      ) caps
      GROUP BY event_id
    ) cap ON cap.event_id = ev.id
    WHERE (p_branch_id IS NULL OR ev.branch_ids @> ARRAY[p_branch_id])
    ORDER BY ev.created_at DESC
  ) e;

  RETURN result;
END;
$function$;
