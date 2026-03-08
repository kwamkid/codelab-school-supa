-- =============================================================
-- Re-issue refund documents for cancelled enrollments (March 2026)
-- Only processes enrollments that:
--   1. status = 'dropped'
--   2. Have positive payment_transactions (had payments)
--   3. Do NOT have existing credit_notes or negative payment_transactions
-- =============================================================

-- ===== STEP 1: Diagnostic — run this first to see what will be processed =====
-- SELECT
--   e.id as enrollment_id,
--   e.status,
--   e.dropped_reason,
--   b.name as branch_name,
--   ic.is_vat_registered,
--   COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount > 0), 0) as total_paid,
--   (SELECT COUNT(*) FROM credit_notes cn WHERE cn.enrollment_id = e.id) as existing_cn
-- FROM enrollments e
-- JOIN branches b ON b.id = e.branch_id
-- LEFT JOIN invoice_companies ic ON ic.id = b.invoice_company_id
-- LEFT JOIN payment_transactions pt ON pt.enrollment_id = e.id
-- WHERE e.status = 'dropped'
--   AND e.updated_at >= '2026-03-01' AND e.updated_at < '2026-04-01'
-- GROUP BY e.id, e.status, e.dropped_reason, b.name, ic.is_vat_registered, b.invoice_company_id
-- HAVING COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount > 0), 0) > 0
-- ORDER BY e.created_at DESC;

-- ===== STEP 2: Create refund transactions + credit notes/refund notes =====
BEGIN;

DO $$
DECLARE
  rec RECORD;
  doc_num TEXT;
  refund_amt NUMERIC;
  vat_amt NUMERIC;
  is_vat BOOLEAN;
  ref_doc RECORD;
  processed INT := 0;
  skipped INT := 0;
BEGIN
  FOR rec IN
    SELECT
      e.id as enrollment_id,
      e.branch_id,
      e.dropped_reason,
      b.invoice_company_id,
      ic.is_vat_registered,
      COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount > 0), 0) as total_paid
    FROM enrollments e
    JOIN branches b ON b.id = e.branch_id
    LEFT JOIN invoice_companies ic ON ic.id = b.invoice_company_id
    LEFT JOIN payment_transactions pt ON pt.enrollment_id = e.id
    WHERE e.status = 'dropped'
      AND b.invoice_company_id IS NOT NULL
      AND e.updated_at >= '2026-03-01'
      AND e.updated_at < '2026-04-01'
    GROUP BY e.id, e.branch_id, e.dropped_reason, b.invoice_company_id, ic.is_vat_registered
    HAVING COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount > 0), 0) > 0
       -- No existing refunds
       AND COALESCE(SUM(pt.amount) FILTER (WHERE pt.amount < 0), 0) = 0
       -- No existing credit notes
       AND NOT EXISTS (
         SELECT 1 FROM credit_notes cn WHERE cn.enrollment_id = e.id
       )
  LOOP
    refund_amt := rec.total_paid;
    is_vat := COALESCE(rec.is_vat_registered, false);

    IF is_vat THEN
      vat_amt := ROUND((refund_amt - refund_amt / 1.07) * 100) / 100;
    ELSE
      vat_amt := 0;
    END IF;

    -- 1. Create negative payment transaction (refund record)
    INSERT INTO payment_transactions (enrollment_id, amount, method, transaction_date, note)
    VALUES (
      rec.enrollment_id,
      -refund_amt,
      'cash',
      NOW(),
      'คืนเงินเต็มจำนวน - ยกเลิกการลงทะเบียน: ' || COALESCE(rec.dropped_reason, '')
    );

    -- 2. Create credit note or refund note
    IF is_vat THEN
      -- VAT: credit note linked to tax_invoice
      SELECT * INTO ref_doc FROM tax_invoices
      WHERE enrollment_id = rec.enrollment_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;

      IF ref_doc.id IS NOT NULL THEN
        doc_num := generate_next_credit_note_number(rec.invoice_company_id);

        INSERT INTO credit_notes (
          credit_note_number, invoice_company_id, tax_invoice_id, enrollment_id, branch_id,
          customer_name, customer_phone, customer_email,
          items, refund_amount, vat_amount, reason, refund_type,
          status, document_type, issued_date
        ) VALUES (
          doc_num, rec.invoice_company_id, ref_doc.id, rec.enrollment_id, rec.branch_id,
          ref_doc.customer_name, ref_doc.customer_phone, ref_doc.customer_email,
          jsonb_build_array(jsonb_build_object(
            'description', 'คืนเงินเต็มจำนวน - ' || ref_doc.tax_invoice_number,
            'amount', refund_amt
          )),
          refund_amt, vat_amt,
          COALESCE(rec.dropped_reason, 'ยกเลิกการลงทะเบียน'),
          'full', 'active', 'credit-note', NOW()
        );
        processed := processed + 1;
      ELSE
        skipped := skipped + 1;
      END IF;
    ELSE
      -- Non-VAT: refund note linked to receipt
      SELECT * INTO ref_doc FROM receipts
      WHERE enrollment_id = rec.enrollment_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;

      IF ref_doc.id IS NOT NULL THEN
        doc_num := generate_next_refund_note_number(rec.invoice_company_id);

        INSERT INTO credit_notes (
          credit_note_number, invoice_company_id, receipt_id, enrollment_id, branch_id,
          customer_name, customer_phone, customer_email,
          items, refund_amount, vat_amount, reason, refund_type,
          status, document_type, issued_date
        ) VALUES (
          doc_num, rec.invoice_company_id, ref_doc.id, rec.enrollment_id, rec.branch_id,
          ref_doc.customer_name, ref_doc.customer_phone, ref_doc.customer_email,
          jsonb_build_array(jsonb_build_object(
            'description', 'คืนเงินเต็มจำนวน - ' || ref_doc.receipt_number,
            'amount', refund_amt
          )),
          refund_amt, 0,
          COALESCE(rec.dropped_reason, 'ยกเลิกการลงทะเบียน'),
          'full', 'active', 'refund-note', NOW()
        );
        processed := processed + 1;
      ELSE
        skipped := skipped + 1;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Processed: % | Skipped (no matching doc): %', processed, skipped;
END $$;

COMMIT;
