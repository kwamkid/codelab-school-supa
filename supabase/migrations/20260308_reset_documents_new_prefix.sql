-- =============================================================
-- Reset all documents and change receipt prefix INV → REC
-- System is brand new (March 2026), safe to delete and re-issue
-- =============================================================

BEGIN;

-- 1. Delete all credit notes (ใบลดหนี้ + ใบบันทึกคืนเงิน)
DELETE FROM credit_notes;

-- 2. Delete all tax invoices (ใบกำกับภาษี)
DELETE FROM tax_invoices;

-- 3. Delete all receipts (ใบเสร็จรับเงิน)
DELETE FROM receipts;

-- 4. Change receipt prefix from INV to REC + reset all counters
UPDATE invoice_companies
SET
  invoice_prefix = 'REC',
  next_invoice_number = 1,
  current_invoice_month = '',
  next_tax_invoice_number = 1,
  current_tax_invoice_month = '',
  next_credit_note_number = 1,
  current_credit_note_month = '',
  next_refund_note_number = 1,
  current_refund_note_month = '',
  updated_at = now();

-- 5. Update the RPC function default (for new companies created later)
ALTER TABLE invoice_companies ALTER COLUMN invoice_prefix SET DEFAULT 'REC';

COMMIT;
