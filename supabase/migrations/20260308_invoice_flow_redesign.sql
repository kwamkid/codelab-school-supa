-- Invoice flow redesign: VAT auto-issue + non-VAT refund notes
-- ─────────────────────────────────────────────────────────────

-- 1. tax_invoices: void + reissue support
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS voided_by_id uuid REFERENCES tax_invoices(id);
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS replaces_id uuid REFERENCES tax_invoices(id);
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS original_payment_date timestamptz;
ALTER TABLE tax_invoices ADD COLUMN IF NOT EXISTS void_reason text;
CREATE INDEX IF NOT EXISTS idx_tax_invoices_replaces ON tax_invoices(replaces_id);

-- 2. credit_notes: refund note support (non-VAT)
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'credit-note';
  -- 'credit-note' = VAT ใบลดหนี้
  -- 'refund-note' = non-VAT ใบบันทึกคืนเงิน
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES receipts(id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_receipt ON credit_notes(receipt_id);

-- 3. invoice_companies: refund note numbering (RN series)
ALTER TABLE invoice_companies ADD COLUMN IF NOT EXISTS refund_note_prefix text NOT NULL DEFAULT 'RN';
ALTER TABLE invoice_companies ADD COLUMN IF NOT EXISTS next_refund_note_number integer NOT NULL DEFAULT 1;
ALTER TABLE invoice_companies ADD COLUMN IF NOT EXISTS current_refund_note_month text DEFAULT '';

-- 4. RPC: Generate next refund note number
CREATE OR REPLACE FUNCTION generate_next_refund_note_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_next_number integer;
  v_yymm text;
BEGIN
  v_yymm := to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM');

  UPDATE invoice_companies
  SET
    current_refund_note_month = v_yymm,
    next_refund_note_number = CASE
      WHEN current_refund_note_month IS DISTINCT FROM v_yymm THEN 2
      ELSE next_refund_note_number + 1
    END,
    updated_at = now()
  WHERE id = p_company_id
  RETURNING
    refund_note_prefix,
    CASE
      WHEN current_refund_note_month IS DISTINCT FROM v_yymm THEN 1
      ELSE next_refund_note_number
    END
  INTO v_prefix, v_next_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice company not found: %', p_company_id;
  END IF;

  RETURN v_prefix || '-' || v_yymm || '-' || lpad(v_next_number::text, 4, '0');
END;
$$;
