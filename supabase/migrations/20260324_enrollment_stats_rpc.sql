-- RPC: get_enrollment_stats
-- คำนวณ enrollment stats ใน SQL แทนที่จะ fetch ทุก row มา client
-- ลด egress จากหลายพัน rows เหลือแค่ 1 JSON object

CREATE OR REPLACE FUNCTION get_enrollment_stats(p_branch_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'active', COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0),
    'completed', COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
    'dropped', COALESCE(SUM(CASE WHEN status = 'dropped' THEN 1 ELSE 0 END), 0),
    'totalRevenue', COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN paid_amount ELSE 0 END), 0),
    'pendingPayments', COALESCE(
      SUM(CASE WHEN payment_status = 'pending' THEN final_price ELSE 0 END) +
      SUM(CASE WHEN payment_status = 'partial' THEN (final_price - paid_amount) ELSE 0 END),
      0
    ),
    'pendingAmount', COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN final_price ELSE 0 END), 0),
    'partialRemainingAmount', COALESCE(SUM(CASE WHEN payment_status = 'partial' THEN (final_price - paid_amount) ELSE 0 END), 0),
    'pendingCount', COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END), 0),
    'partialCount', COALESCE(SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END), 0),
    'paidCount', COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0)
  ) INTO result
  FROM enrollments
  WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

  RETURN result;
END;
$$;
