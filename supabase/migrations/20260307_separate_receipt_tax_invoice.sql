-- Separate receipt (REC) and tax invoice (TAX) numbering
-- Each invoice company gets its own tax invoice prefix and counter

-- invoice_companies: add tax invoice prefix + counter
ALTER TABLE invoice_companies ADD COLUMN IF NOT EXISTS tax_invoice_prefix text NOT NULL DEFAULT 'TAX';
ALTER TABLE invoice_companies ADD COLUMN IF NOT EXISTS next_tax_invoice_number integer NOT NULL DEFAULT 1;
ALTER TABLE invoice_companies ADD COLUMN IF NOT EXISTS current_tax_invoice_month text;

-- invoices: reference to original receipt (for tax invoices issued later)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference_invoice_id uuid REFERENCES invoices(id);

-- =============================================================
-- RPC: Atomic document number generation (prevents race condition)
-- =============================================================

-- Generate next receipt number (REC series)
CREATE OR REPLACE FUNCTION generate_next_receipt_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_current_month text;
  v_next_number integer;
  v_yymm text;
BEGIN
  -- Get current YYMM in Bangkok timezone
  v_yymm := to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM');

  -- Atomic update + get counter
  UPDATE invoice_companies
  SET
    current_invoice_month = v_yymm,
    next_invoice_number = CASE
      WHEN current_invoice_month IS DISTINCT FROM v_yymm THEN 2  -- new month, reset to 2 (returning 1)
      ELSE next_invoice_number + 1
    END,
    updated_at = now()
  WHERE id = p_company_id
  RETURNING
    invoice_prefix,
    CASE
      WHEN current_invoice_month IS DISTINCT FROM v_yymm THEN 1  -- first of new month
      ELSE next_invoice_number  -- value before +1
    END
  INTO v_prefix, v_next_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice company not found: %', p_company_id;
  END IF;

  RETURN v_prefix || '-' || v_yymm || '-' || lpad(v_next_number::text, 4, '0');
END;
$$;

-- Generate next tax invoice number (TAX series)
CREATE OR REPLACE FUNCTION generate_next_tax_invoice_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text;
  v_next_number integer;
  v_yymm text;
  v_is_vat boolean;
BEGIN
  v_yymm := to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM');

  -- Check VAT registration
  SELECT is_vat_registered INTO v_is_vat FROM invoice_companies WHERE id = p_company_id;
  IF NOT v_is_vat THEN
    RAISE EXCEPTION 'Company is not VAT registered, cannot issue tax invoice';
  END IF;

  UPDATE invoice_companies
  SET
    current_tax_invoice_month = v_yymm,
    next_tax_invoice_number = CASE
      WHEN current_tax_invoice_month IS DISTINCT FROM v_yymm THEN 2
      ELSE next_tax_invoice_number + 1
    END,
    updated_at = now()
  WHERE id = p_company_id
  RETURNING
    tax_invoice_prefix,
    CASE
      WHEN current_tax_invoice_month IS DISTINCT FROM v_yymm THEN 1
      ELSE next_tax_invoice_number
    END
  INTO v_prefix, v_next_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice company not found: %', p_company_id;
  END IF;

  RETURN v_prefix || '-' || v_yymm || '-' || lpad(v_next_number::text, 4, '0');
END;
$$;

-- Generate next credit note number (CN series)
CREATE OR REPLACE FUNCTION generate_next_credit_note_number(p_company_id uuid)
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
    current_credit_note_month = v_yymm,
    next_credit_note_number = CASE
      WHEN current_credit_note_month IS DISTINCT FROM v_yymm THEN 2
      ELSE next_credit_note_number + 1
    END,
    updated_at = now()
  WHERE id = p_company_id
  RETURNING
    credit_note_prefix,
    CASE
      WHEN current_credit_note_month IS DISTINCT FROM v_yymm THEN 1
      ELSE next_credit_note_number
    END
  INTO v_prefix, v_next_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice company not found: %', p_company_id;
  END IF;

  RETURN v_prefix || '-' || v_yymm || '-' || lpad(v_next_number::text, 4, '0');
END;
$$;
