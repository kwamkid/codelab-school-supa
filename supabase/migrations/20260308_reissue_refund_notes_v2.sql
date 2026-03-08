-- =============================================================
-- V2: Re-issue refund documents for cancelled enrollments (March 2026)
-- FIX: Create 1 credit note per tax invoice / receipt (not 1 per enrollment)
-- =============================================================

-- ===== STEP 0: Clean up V1 credit notes + refund transactions =====
-- Run this first if you already ran V1
--
-- DELETE FROM credit_notes
-- WHERE reason IN (SELECT dropped_reason FROM enrollments WHERE status = 'dropped')
--    OR reason LIKE '%ยกเลิกการลงทะเบียน%';
--
-- DELETE FROM payment_transactions WHERE amount < 0;

-- ===== STEP 1: Diagnostic =====
-- SELECT
--   e.id as enrollment_id,
--   e.dropped_reason,
--   ic.is_vat_registered,
--   ti.tax_invoice_number as doc_number,
--   ti.total_amount,
--   'tax_invoice' as doc_type
-- FROM enrollments e
-- JOIN branches b ON b.id = e.branch_id
-- JOIN invoice_companies ic ON ic.id = b.invoice_company_id
-- JOIN tax_invoices ti ON ti.enrollment_id = e.id AND ti.status = 'active'
-- WHERE e.status = 'dropped'
--   AND e.updated_at >= '2026-03-01' AND e.updated_at < '2026-04-01'
--   AND NOT EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.tax_invoice_id = ti.id)
-- UNION ALL
-- SELECT
--   e.id,
--   e.dropped_reason,
--   ic.is_vat_registered,
--   r.receipt_number,
--   r.total_amount,
--   'receipt'
-- FROM enrollments e
-- JOIN branches b ON b.id = e.branch_id
-- JOIN invoice_companies ic ON ic.id = b.invoice_company_id
-- JOIN receipts r ON r.enrollment_id = e.id AND r.status = 'active'
-- WHERE e.status = 'dropped'
--   AND e.updated_at >= '2026-03-01' AND e.updated_at < '2026-04-01'
--   AND NOT EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.receipt_id = r.id)
-- ORDER BY enrollment_id;

-- ===== STEP 2: Create refund documents (1 CN per tax invoice, 1 RN per receipt) =====
BEGIN;

DO $$
DECLARE
  rec RECORD;
  doc_num TEXT;
  vat_amt NUMERIC;
  processed INT := 0;
  refund_total NUMERIC;
  enrollment_refunds RECORD;
BEGIN
  -- =============================================
  -- Part A: VAT companies → credit notes per tax invoice
  -- =============================================
  FOR rec IN
    SELECT
      e.id as enrollment_id,
      e.branch_id,
      e.dropped_reason,
      b.invoice_company_id,
      ti.id as tax_invoice_id,
      ti.tax_invoice_number,
      ti.total_amount,
      ti.customer_name,
      ti.customer_phone,
      ti.customer_email,
      ti.billing_type,
      ti.billing_name,
      ti.billing_address,
      ti.billing_tax_id,
      ti.billing_company_branch
    FROM enrollments e
    JOIN branches b ON b.id = e.branch_id
    JOIN invoice_companies ic ON ic.id = b.invoice_company_id
    JOIN tax_invoices ti ON ti.enrollment_id = e.id AND ti.status = 'active'
    WHERE e.status = 'dropped'
      AND ic.is_vat_registered = true
      AND b.invoice_company_id IS NOT NULL
      AND e.updated_at >= '2026-03-01'
      AND e.updated_at < '2026-04-01'
      -- No existing CN for this specific tax invoice
      AND NOT EXISTS (
        SELECT 1 FROM credit_notes cn WHERE cn.tax_invoice_id = ti.id
      )
    ORDER BY ti.created_at ASC
  LOOP
    vat_amt := ROUND((rec.total_amount - rec.total_amount / 1.07) * 100) / 100;
    doc_num := generate_next_credit_note_number(rec.invoice_company_id);

    INSERT INTO credit_notes (
      credit_note_number, invoice_company_id, tax_invoice_id, enrollment_id, branch_id,
      customer_name, customer_phone, customer_email,
      billing_type, billing_name, billing_address, billing_tax_id, billing_company_branch,
      items, refund_amount, vat_amount, reason, refund_type,
      status, document_type, issued_date
    ) VALUES (
      doc_num, rec.invoice_company_id, rec.tax_invoice_id, rec.enrollment_id, rec.branch_id,
      rec.customer_name, rec.customer_phone, rec.customer_email,
      rec.billing_type, rec.billing_name, rec.billing_address, rec.billing_tax_id, rec.billing_company_branch,
      jsonb_build_array(jsonb_build_object(
        'description', 'คืนเงิน - ' || rec.tax_invoice_number,
        'amount', rec.total_amount
      )),
      rec.total_amount, vat_amt,
      COALESCE(rec.dropped_reason, 'ยกเลิกการลงทะเบียน'),
      'full', 'active', 'credit-note', NOW()
    );
    processed := processed + 1;
  END LOOP;

  -- =============================================
  -- Part B: Non-VAT companies → refund notes per receipt
  -- =============================================
  FOR rec IN
    SELECT
      e.id as enrollment_id,
      e.branch_id,
      e.dropped_reason,
      b.invoice_company_id,
      r.id as receipt_id,
      r.receipt_number,
      r.total_amount,
      r.customer_name,
      r.customer_phone,
      r.customer_email
    FROM enrollments e
    JOIN branches b ON b.id = e.branch_id
    JOIN invoice_companies ic ON ic.id = b.invoice_company_id
    JOIN receipts r ON r.enrollment_id = e.id AND r.status = 'active'
    WHERE e.status = 'dropped'
      AND ic.is_vat_registered = false
      AND b.invoice_company_id IS NOT NULL
      AND e.updated_at >= '2026-03-01'
      AND e.updated_at < '2026-04-01'
      -- No existing RN for this specific receipt
      AND NOT EXISTS (
        SELECT 1 FROM credit_notes cn WHERE cn.receipt_id = r.id
      )
    ORDER BY r.created_at ASC
  LOOP
    doc_num := generate_next_refund_note_number(rec.invoice_company_id);

    INSERT INTO credit_notes (
      credit_note_number, invoice_company_id, receipt_id, enrollment_id, branch_id,
      customer_name, customer_phone, customer_email,
      items, refund_amount, vat_amount, reason, refund_type,
      status, document_type, issued_date
    ) VALUES (
      doc_num, rec.invoice_company_id, rec.receipt_id, rec.enrollment_id, rec.branch_id,
      rec.customer_name, rec.customer_phone, rec.customer_email,
      jsonb_build_array(jsonb_build_object(
        'description', 'คืนเงิน - ' || rec.receipt_number,
        'amount', rec.total_amount
      )),
      rec.total_amount, 0,
      COALESCE(rec.dropped_reason, 'ยกเลิกการลงทะเบียน'),
      'full', 'active', 'refund-note', NOW()
    );
    processed := processed + 1;
  END LOOP;

  -- =============================================
  -- Part C: Create negative payment_transactions per enrollment
  -- (1 refund transaction per enrollment = sum of all documents)
  -- =============================================
  FOR enrollment_refunds IN
    SELECT
      e.id as enrollment_id,
      e.dropped_reason,
      COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount > 0), 0) as total_paid
    FROM enrollments e
    LEFT JOIN payment_transactions pt ON pt.enrollment_id = e.id
    WHERE e.status = 'dropped'
      AND e.updated_at >= '2026-03-01'
      AND e.updated_at < '2026-04-01'
    GROUP BY e.id, e.dropped_reason
    HAVING COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount > 0), 0) > 0
       AND COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount < 0), 0) = 0
  LOOP
    INSERT INTO payment_transactions (enrollment_id, amount, method, transaction_date, note)
    VALUES (
      enrollment_refunds.enrollment_id,
      -enrollment_refunds.total_paid,
      'cash',
      NOW(),
      'คืนเงินเต็มจำนวน - ยกเลิก: ' || COALESCE(enrollment_refunds.dropped_reason, '')
    );
  END LOOP;

  RAISE NOTICE 'Created % credit notes / refund notes', processed;
END $$;

COMMIT;
