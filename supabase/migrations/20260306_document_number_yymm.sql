-- เปลี่ยนเลขเอกสารเป็น YYMM format: INV-2603-0001
-- Running number reset ทุกเดือน

-- 1. เพิ่ม column สำหรับ track เดือนปัจจุบัน
ALTER TABLE public.invoice_companies
  ADD COLUMN IF NOT EXISTS current_invoice_month varchar(4) DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_credit_note_month varchar(4) DEFAULT '';

-- 2. Update ใบเสร็จเดิมให้ใช้ format ใหม่ (YYMM based on issued_at/created_at)
WITH numbered AS (
  SELECT
    i.id,
    ic.invoice_prefix,
    to_char(COALESCE(i.issued_at, i.created_at) AT TIME ZONE 'Asia/Bangkok', 'YYMM') AS yymm,
    ROW_NUMBER() OVER (
      PARTITION BY i.invoice_company_id,
        to_char(COALESCE(i.issued_at, i.created_at) AT TIME ZONE 'Asia/Bangkok', 'YYMM')
      ORDER BY COALESCE(i.issued_at, i.created_at), i.created_at
    ) AS seq
  FROM public.invoices i
  JOIN public.invoice_companies ic ON ic.id = i.invoice_company_id
)
UPDATE public.invoices
SET invoice_number = numbered.invoice_prefix || '-' || numbered.yymm || '-' || LPAD(numbered.seq::text, 4, '0')
FROM numbered
WHERE public.invoices.id = numbered.id;

-- 3. Update ใบลดหนี้เดิมให้ใช้ format ใหม่
WITH numbered AS (
  SELECT
    cn.id,
    COALESCE(ic.credit_note_prefix, 'CN') AS cn_prefix,
    to_char(COALESCE(cn.issued_date::timestamp, cn.created_at) AT TIME ZONE 'Asia/Bangkok', 'YYMM') AS yymm,
    ROW_NUMBER() OVER (
      PARTITION BY cn.invoice_company_id,
        to_char(COALESCE(cn.issued_date::timestamp, cn.created_at) AT TIME ZONE 'Asia/Bangkok', 'YYMM')
      ORDER BY COALESCE(cn.issued_date::timestamp, cn.created_at), cn.created_at
    ) AS seq
  FROM public.credit_notes cn
  JOIN public.invoice_companies ic ON ic.id = cn.invoice_company_id
)
UPDATE public.credit_notes
SET credit_note_number = numbered.cn_prefix || '-' || numbered.yymm || '-' || LPAD(numbered.seq::text, 4, '0')
FROM numbered
WHERE public.credit_notes.id = numbered.id;

-- 4. Set current month + reset counters
-- คำนวณ next number จากจำนวนเอกสารในเดือนปัจจุบัน
UPDATE public.invoice_companies ic SET
  current_invoice_month = to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM'),
  current_credit_note_month = to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM'),
  next_invoice_number = COALESCE((
    SELECT COUNT(*) + 1
    FROM public.invoices i
    WHERE i.invoice_company_id = ic.id
      AND to_char(COALESCE(i.issued_at, i.created_at) AT TIME ZONE 'Asia/Bangkok', 'YYMM')
        = to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM')
  ), 1),
  next_credit_note_number = COALESCE((
    SELECT COUNT(*) + 1
    FROM public.credit_notes cn
    WHERE cn.invoice_company_id = ic.id
      AND to_char(COALESCE(cn.issued_date::timestamp, cn.created_at) AT TIME ZONE 'Asia/Bangkok', 'YYMM')
        = to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM')
  ), 1);
