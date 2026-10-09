// Shared display formatters (Thai dates, money, percentages).
// Pure + timezone-safe: date helpers take 'YYYY-MM' / 'YYYY-MM-DD' strings and
// never build a Date from them (server runs in UTC — see memory
// server-timezone-wall-clock), so they're safe in both server and client code.

export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

/** 'YYYY-MM' → 'ก.ค. 69' (ปี พ.ศ. 2 หลัก) */
export function thaiMonthLabel(ym: string): string {
  return `${THAI_MONTHS_SHORT[+ym.slice(5, 7) - 1]} ${(+ym.slice(0, 4) + 543) % 100}`
}

/** 'YYYY-MM-DD' → '4 ต.ค. 69' · `{ year: false }` → '4 ต.ค.' · null/'' → '—' */
export function thaiDateLabel(ymd: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  const base = `${d} ${THAI_MONTHS_SHORT[m - 1]}`
  return opts.year === false ? base : `${base} ${(y + 543) % 100}`
}

/** Today's date in Bangkok as 'YYYY-MM-DD', whatever the device/server timezone. */
export function bangkokToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

/** Current month in Bangkok as 'YYYY-MM'. */
export function bangkokMonth(): string {
  return bangkokToday().slice(0, 7)
}

/** 'YYYY-MM' shifted by n months (n may be negative). */
export function addMonthsYm(ym: string, n: number): string {
  const total = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

const thaiNumber = new Intl.NumberFormat('th-TH')

/** 1234567 → '1,234,567' */
export const formatNumber = (v: number | string | null | undefined) => thaiNumber.format(Math.round(Number(v) || 0))

/** 1234567 → '฿1,234,567' */
export const formatBaht = (v: number | string | null | undefined) => `฿${formatNumber(v)}`

/** Axis-friendly: 1500000 → '1.5M', 25000 → '25K' */
export function formatCompact(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`
  return String(v)
}

/** Whole percent of a/b, or null when b is 0. */
export const percent = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 100) : null)

/** '42%' or '—' when b is 0. */
export const percentText = (a: number, b: number): string => {
  const p = percent(a, b)
  return p == null ? '—' : `${p}%`
}
