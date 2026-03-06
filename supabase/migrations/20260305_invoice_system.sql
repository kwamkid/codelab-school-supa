-- ==========================================
-- Invoice System Database Schema
-- ==========================================

-- 1: ตาราง invoice_companies — นิติบุคคลที่ออกใบเสร็จ
CREATE TABLE public.invoice_companies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  tax_id varchar(13),
  address jsonb DEFAULT '{}'::jsonb,
  branch_label text DEFAULT 'สำนักงานใหญ่',
  phone text,
  email text,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  next_invoice_number integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_companies_pkey PRIMARY KEY (id)
);

-- 2: ALTER branches — เพิ่ม FK ไปหา invoice_companies
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS invoice_company_id uuid
    REFERENCES public.invoice_companies(id) ON DELETE SET NULL;

-- 3: ตาราง invoices — ใบแจ้งหนี้/ใบเสร็จ
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  invoice_number varchar NOT NULL,
  invoice_company_id uuid NOT NULL REFERENCES public.invoice_companies(id),
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id),

  -- Billing snapshot
  billing_type text NOT NULL DEFAULT 'personal',
  billing_name text NOT NULL,
  billing_address jsonb DEFAULT '{}'::jsonb,
  billing_tax_id varchar(13),
  billing_company_branch text,
  want_tax_invoice boolean DEFAULT false,

  -- Customer snapshot
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,

  -- Line items
  items jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Pricing
  subtotal numeric NOT NULL DEFAULT 0,
  discount_type text,
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  promotion_code text,
  total_amount numeric NOT NULL DEFAULT 0,

  -- Payment
  payment_method text,
  payment_type text,
  paid_amount numeric DEFAULT 0,

  -- Status
  status text NOT NULL DEFAULT 'issued',
  issued_at timestamptz DEFAULT now(),

  -- Metadata
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_number_company_unique UNIQUE (invoice_number, invoice_company_id)
);

CREATE INDEX idx_invoices_company ON public.invoices(invoice_company_id);
CREATE INDEX idx_invoices_enrollment ON public.invoices(enrollment_id);
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id);

-- 4: เพิ่ม is_vat_registered ให้ invoice_companies
ALTER TABLE public.invoice_companies
  ADD COLUMN IF NOT EXISTS is_vat_registered boolean NOT NULL DEFAULT false;
