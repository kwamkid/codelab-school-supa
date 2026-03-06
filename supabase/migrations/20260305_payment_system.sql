-- ==========================================
-- Phase 2: Payment System Database Schema
-- ==========================================

-- 2A: ตาราง payment_transactions
CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  enrollment_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  transaction_date timestamptz NOT NULL DEFAULT now(),
  receipt_number varchar,
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_transactions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(id) ON DELETE CASCADE,
  CONSTRAINT payment_transactions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.admin_users(id)
);

CREATE INDEX idx_payment_tx_enrollment ON public.payment_transactions(enrollment_id);
CREATE INDEX idx_payment_tx_date ON public.payment_transactions(transaction_date);

-- 2B: ตาราง branch_payment_settings
CREATE TABLE public.branch_payment_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  branch_id uuid NOT NULL UNIQUE,
  enabled_methods text[] NOT NULL DEFAULT '{cash,bank_transfer}'::text[],
  bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  promptpay_number varchar,
  promptpay_name varchar,
  online_payment_enabled boolean NOT NULL DEFAULT false,
  online_payment_provider varchar,
  online_payment_config jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT branch_payment_settings_pkey PRIMARY KEY (id),
  CONSTRAINT branch_payment_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE
);

-- 2C: ALTER enrollments
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'full';

ALTER TABLE public.enrollments
  ALTER COLUMN payment_method TYPE text;

-- 2E: Migration ข้อมูลเดิม (ย้าย paid records เข้า payment_transactions)
INSERT INTO public.payment_transactions (enrollment_id, amount, method, transaction_date, receipt_number)
SELECT id, paid_amount, payment_method, COALESCE(paid_date, enrolled_at), receipt_number
FROM public.enrollments
WHERE paid_amount > 0;
