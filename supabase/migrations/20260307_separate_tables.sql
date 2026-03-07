-- =============================================================
-- แยกตาราง: invoices → receipts + tax_invoices
-- credit_notes → ผูกกับ tax_invoices เท่านั้น
-- =============================================================

-- Step 1: สร้าง tax_invoices table
CREATE TABLE public.tax_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_invoice_number text NOT NULL,
  invoice_company_id uuid NOT NULL REFERENCES invoice_companies(id),
  enrollment_id uuid,
  branch_id uuid NOT NULL REFERENCES branches(id),
  receipt_id uuid,  -- อ้างอิงใบเสร็จเดิม (กรณีออกทีหลัง)

  -- Billing
  billing_type text NOT NULL DEFAULT 'personal',
  billing_name text NOT NULL DEFAULT '',
  billing_address jsonb DEFAULT '{}'::jsonb,
  billing_tax_id text,
  billing_company_branch text,

  -- Customer
  customer_name text NOT NULL DEFAULT '',
  customer_phone text,
  customer_email text,
  customer_address jsonb DEFAULT '{}'::jsonb,
  customer_tax_id text,

  -- Items & Pricing
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  discount_type text,
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  promotion_code text,
  total_amount numeric NOT NULL DEFAULT 0,

  -- Payment
  payment_method text,
  payment_type text,
  paid_amount numeric DEFAULT 0,
  payment_date timestamptz,

  -- Status
  status text NOT NULL DEFAULT 'active',
  issued_at timestamptz DEFAULT now(),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_invoices_company ON tax_invoices(invoice_company_id);
CREATE INDEX idx_tax_invoices_enrollment ON tax_invoices(enrollment_id);
CREATE INDEX idx_tax_invoices_branch ON tax_invoices(branch_id);
CREATE INDEX idx_tax_invoices_receipt ON tax_invoices(receipt_id);
CREATE UNIQUE INDEX idx_tax_invoices_number_company ON tax_invoices(tax_invoice_number, invoice_company_id);

ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on tax_invoices" ON tax_invoices FOR ALL USING (true) WITH CHECK (true);

-- Step 2: ย้าย tax invoice rows จาก invoices → tax_invoices
INSERT INTO tax_invoices (
  id, tax_invoice_number, invoice_company_id, enrollment_id, branch_id, receipt_id,
  billing_type, billing_name, billing_address, billing_tax_id, billing_company_branch,
  customer_name, customer_phone, customer_email, customer_address, customer_tax_id,
  items, subtotal, vat_amount, discount_type, discount_value, discount_amount, promotion_code,
  total_amount, payment_method, payment_type, paid_amount, payment_date,
  status, issued_at, note, created_by, created_at, updated_at
)
SELECT
  id, invoice_number, invoice_company_id, enrollment_id, branch_id, reference_invoice_id,
  COALESCE(billing_type, 'personal'), COALESCE(billing_name, customer_name),
  COALESCE(billing_address, '{}'::jsonb), billing_tax_id, billing_company_branch,
  customer_name, customer_phone, customer_email,
  COALESCE(customer_address, '{}'::jsonb), customer_tax_id,
  COALESCE(items, '[]'::jsonb),
  ROUND(COALESCE(total_amount, 0) / 1.07, 2),
  ROUND(COALESCE(total_amount, 0) - COALESCE(total_amount, 0) / 1.07, 2),
  discount_type, COALESCE(discount_value, 0), COALESCE(discount_amount, 0), promotion_code,
  COALESCE(total_amount, 0), payment_method, payment_type, COALESCE(paid_amount, 0),
  issued_at,
  CASE WHEN status = 'voided' THEN 'void' ELSE 'active' END,
  issued_at, note, created_by, created_at, updated_at
FROM invoices
WHERE want_tax_invoice = true;

-- ลบ tax invoice rows จาก invoices
DELETE FROM invoices WHERE want_tax_invoice = true;

-- Step 3: Rename invoices → receipts
ALTER TABLE invoices RENAME TO receipts;
ALTER TABLE receipts RENAME COLUMN invoice_number TO receipt_number;

-- Drop billing columns (receipt ไม่ต้องการ)
ALTER TABLE receipts
  DROP COLUMN IF EXISTS want_tax_invoice,
  DROP COLUMN IF EXISTS billing_type,
  DROP COLUMN IF EXISTS billing_name,
  DROP COLUMN IF EXISTS billing_address,
  DROP COLUMN IF EXISTS billing_tax_id,
  DROP COLUMN IF EXISTS billing_company_branch,
  DROP COLUMN IF EXISTS reference_invoice_id;

-- เพิ่ม fields ใหม่
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payment_date timestamptz;

-- คำนวณ vat_amount สำหรับ receipt ของบริษัท VAT
UPDATE receipts r
SET vat_amount = ROUND(r.total_amount - r.total_amount / 1.07, 2),
    subtotal = ROUND(r.total_amount / 1.07, 2),
    payment_date = r.issued_at
FROM invoice_companies ic
WHERE r.invoice_company_id = ic.id AND ic.is_vat_registered = true;

-- Non-VAT: vat_amount = 0
UPDATE receipts r
SET vat_amount = 0,
    payment_date = COALESCE(r.payment_date, r.issued_at)
FROM invoice_companies ic
WHERE r.invoice_company_id = ic.id AND ic.is_vat_registered = false;

-- Status migration
UPDATE receipts SET status = 'void' WHERE status = 'voided';
UPDATE receipts SET status = 'active' WHERE status NOT IN ('active', 'void');

-- Add FK for tax_invoices.receipt_id → receipts
ALTER TABLE tax_invoices
  ADD CONSTRAINT tax_invoices_receipt_fk FOREIGN KEY (receipt_id) REFERENCES receipts(id);

-- Step 4: Update credit_notes — ผูกกับ tax_invoices เท่านั้น
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS tax_invoice_id uuid REFERENCES tax_invoices(id);
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS payment_date timestamptz;

-- ย้าย link: original_invoice_id → tax_invoice_id (ถ้า original เป็น tax invoice)
UPDATE credit_notes cn
SET tax_invoice_id = cn.original_invoice_id,
    payment_date = cn.issued_date,
    vat_amount = ROUND(cn.refund_amount - cn.refund_amount / 1.07, 2)
WHERE EXISTS (SELECT 1 FROM tax_invoices ti WHERE ti.id = cn.original_invoice_id);

-- CN ที่ link ไป receipt → clear link (CN ผูกแค่ tax)
UPDATE credit_notes
SET original_invoice_id = NULL
WHERE tax_invoice_id IS NULL AND original_invoice_id IS NOT NULL;

-- Status migration
UPDATE credit_notes SET status = 'void' WHERE status = 'voided';
UPDATE credit_notes SET status = 'active' WHERE status NOT IN ('active', 'void');

-- Drop old column
ALTER TABLE credit_notes DROP COLUMN IF EXISTS original_invoice_id;

CREATE INDEX IF NOT EXISTS idx_credit_notes_tax_invoice ON credit_notes(tax_invoice_id);
