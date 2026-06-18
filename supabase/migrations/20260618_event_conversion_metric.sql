-- Event → enrollment conversion: a registrant "converted" if the parent (matched
-- by normalized phone) enrolled a student in a class within 7 days AFTER their
-- event registration. Returns summary + the list of converted registrants.
-- Phone is the linkage key (event_registrations.parent_phone → parents.phone →
-- enrollments.parent_id); there is no explicit event→enrollment FK.
CREATE OR REPLACE FUNCTION public.get_event_conversion(p_event_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH regs AS (
    SELECT
      er.id AS registration_id,
      er.parent_name,
      er.parent_phone,
      regexp_replace(COALESCE(er.parent_phone, ''), '\D', '', 'g') AS phone_norm,
      er.registered_at
    FROM event_registrations er
    WHERE er.event_id = p_event_id
      AND er.status <> 'cancelled'
      AND er.parent_phone IS NOT NULL
      AND length(regexp_replace(er.parent_phone, '\D', '', 'g')) >= 8
  ),
  matched AS (
    SELECT
      r.registration_id,
      r.parent_name,
      r.parent_phone,
      r.registered_at,
      e.enrolled_at,
      cl.name AS class_name,
      s.name  AS student_name,
      ROW_NUMBER() OVER (PARTITION BY r.registration_id ORDER BY e.enrolled_at) AS rn
    FROM regs r
    JOIN parents p
      ON regexp_replace(p.phone, '\D', '', 'g') = r.phone_norm
    JOIN enrollments e
      ON e.parent_id = p.id
     AND e.status IN ('active', 'completed')
     AND e.enrolled_at >= r.registered_at
     AND e.enrolled_at <= r.registered_at + INTERVAL '7 days'
    LEFT JOIN classes cl ON cl.id = e.class_id
    LEFT JOIN students s ON s.id = e.student_id
  ),
  converted AS (
    SELECT * FROM matched WHERE rn = 1
  ),
  reg_count AS (SELECT COUNT(*) AS n FROM regs)
  SELECT json_build_object(
    'totalRegistrants', (SELECT n FROM reg_count),
    'converted', (SELECT COUNT(*) FROM converted),
    'conversionRate', CASE WHEN (SELECT n FROM reg_count) > 0
        THEN ROUND(100.0 * (SELECT COUNT(*) FROM converted) / (SELECT n FROM reg_count), 1)
        ELSE 0 END,
    'convertedList', COALESCE((
      SELECT json_agg(json_build_object(
        'registrationId', registration_id,
        'parentName', parent_name,
        'parentPhone', parent_phone,
        'studentName', student_name,
        'className', class_name,
        'registeredAt', registered_at,
        'enrolledAt', enrolled_at
      ) ORDER BY enrolled_at DESC)
      FROM converted
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$function$;
