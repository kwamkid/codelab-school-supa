-- Credit Note System
-- ใบลดหนี้สำหรับคืนเงินเมื่อยกเลิกการลงทะเบียน

-- Add credit note numbering to invoice_companies
ALTER TABLE public.invoice_companies
  ADD COLUMN IF NOT EXISTS credit_note_prefix text NOT NULL DEFAULT 'CN',
  ADD COLUMN IF NOT EXISTS next_credit_note_number integer NOT NULL DEFAULT 1;

-- Create credit_notes table
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number varchar(50) NOT NULL,
  invoice_company_id uuid NOT NULL,
  original_invoice_id uuid,
  enrollment_id uuid,
  branch_id uuid NOT NULL,
  -- Customer
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  -- Billing (for VAT tax invoice)
  billing_type text DEFAULT 'personal',
  billing_name text,
  billing_address jsonb DEFAULT '{}',
  billing_tax_id varchar(13),
  billing_company_branch text,
  -- Amounts
  items jsonb NOT NULL DEFAULT '[]',
  refund_amount numeric(10,2) NOT NULL,
  reason text NOT NULL,
  refund_type text NOT NULL DEFAULT 'full',
  -- Status
  status text NOT NULL DEFAULT 'issued',
  issued_date date DEFAULT CURRENT_DATE,
  -- Metadata
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on credit_notes"
  ON public.credit_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);
