-- Add customer_address and customer_tax_id to invoices and credit_notes
-- These fields store the customer's address and tax ID for printing on receipts/credit notes

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_address jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_tax_id varchar(13);

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS customer_address jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_tax_id varchar(13);
