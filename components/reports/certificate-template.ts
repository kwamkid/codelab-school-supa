// components/reports/certificate-template.ts
// Builds the printable A4 (landscape) CODELAB Certificate of Participation.
// The artwork is a fixed PNG background (public/cert-template.png); the four
// dynamic fields are overlaid as HTML positioned by % so they track the artwork
// at any render size. Every field is center-anchored and auto-shrinks to fit.

export interface CertificateFields {
  subjectName: string;
  studentName: string;
  teacherName: string;
  /** Already-formatted date string, e.g. "11/06/2026". */
  date: string;
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** Format an ISO date as DD/MM/YYYY (Gregorian / ค.ศ.). Empty string if invalid. */
export function certDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Kept for callers that still want a Thai long date elsewhere.
export function thaiLongDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

/** All certificate text is rendered in UPPERCASE. Apply before measuring AND
 *  displaying so auto-shrink and layout agree. */
export function certText(s: string): string {
  return (s || '').toUpperCase();
}

// Measure text width with the real font via an offscreen canvas. This is
// deterministic and independent of DOM layout / font-load timing, so the preview
// and the print output compute the SAME font size for the same text. (canvas
// uses the font once it's available; we also pass through document.fonts.ready
// at call sites that can wait.)
export const CERT_CANVAS = { w: 2000, h: 1414 } as const;

let _measureCtx: CanvasRenderingContext2D | null = null;
function measureWidth(text: string, px: number, weight: number, spacing: number): number {
  if (typeof document === 'undefined') return text.length * px * 0.55; // SSR fallback
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  if (!_measureCtx) return text.length * px * 0.55;
  _measureCtx.font = `${weight} ${px}px 'IBM Plex Sans Thai', sans-serif`;
  const w = _measureCtx.measureText(text).width;
  return w + Math.max(0, text.length - 1) * spacing; // approximate letter-spacing
}

/**
 * Compute the actual font px for one field: start from base px and shrink (if the
 * field allows) until it fits maxw% of the canvas. Returns the px to render at.
 * Same inputs → same output everywhere.
 */
export function fitFontPx(
  text: string,
  field: { px: number; maxw: number; weight: number; spacing: number; shrink: boolean },
): number {
  if (!field.shrink || !text) return field.px;
  const maxW = (CERT_CANVAS.w * field.maxw) / 100;
  let px = field.px;
  while (px > 6 && measureWidth(text, px, field.weight, field.spacing) > maxW) px -= 1;
  return px;
}

// Field layout — finalized against public/cert-template.png (2000x1414).
// top/left are % of the cert canvas; maxw is the max text width (% of canvas)
// The certificate is laid out on a FIXED 2000x1414 canvas (matching the PNG) and
// then scaled to fit wherever it renders. Because the layout canvas is always the
// same size, font px + auto-shrink are computed identically for preview and print
// — they only differ by the final CSS scale. No more cqw/%-vs-pt drift.
//
// top/left are % of the canvas; px is the base font size on the 2000px canvas;
// maxw is the max text width (% of canvas) before shrinking; shrink=false means
// the field never reduces its font (used for the teacher, which has room).
export const CERT_FIELDS = {
  subject: { top: 37.0, left: 50.0,  maxw: 40, px: 44, weight: 700, color: '#ef443a', spacing: 1,   shrink: true  },
  student: { top: 52.0, left: 50.0,  maxw: 62, px: 92, weight: 700, color: '#111111', spacing: 0,   shrink: true  },
  // Teacher matches the baked-in "WASIN SUDJAIDEE" line: same Y (87.84%) and a
  // font size tuned to match its cap-height in the browser font.
  teacher: { top: 87.14, left: 68.88, maxw: 30, px: 28, weight: 500, color: '#111111', spacing: 1, shrink: false },
  date:    { top: 92.89, left: 69.5,  maxw: 28, px: 24, weight: 400, color: '#444444', spacing: 0, shrink: false },
} as const;

/**
 * Returns { title, body, css } for the print helper. `bgUrl` defaults to the
 * public PNG; pass a data-URI when the background must be inlined (print iframe
 * can't resolve relative URLs reliably across browsers — but a /public path is
 * fine here since the iframe shares the origin).
 */
export function generateCertificateHTML(
  fields: CertificateFields,
  bgUrl = '/cert-template.png'
): { title: string; body: string; css: string } {
  const f = CERT_FIELDS;
  const { w: CW, h: CH } = CERT_CANVAS;

  // Compute the final font px per field NOW (deterministic, via canvas measure),
  // and bake them in — no JS shrink in the print iframe. Same computation the
  // preview uses, so they match exactly.
  // Uppercase everything first, then measure + display the same text.
  const txt = {
    subject: certText(fields.subjectName),
    student: certText(fields.studentName),
    teacher: certText(fields.teacherName),
    date: certText(fields.date),
  };
  const px = {
    subject: fitFontPx(txt.subject, f.subject),
    student: fitFontPx(txt.student, f.student),
    teacher: fitFontPx(txt.teacher, f.teacher),
    date: fitFontPx(txt.date, f.date),
  };

  const span = (key: keyof typeof CERT_FIELDS, text: string) =>
    `<div class="cf cf-${key}">${esc(text)}</div>`;

  const body = `
    <div class="cert-scale">
      <div class="cert">
        ${span('subject', txt.subject)}
        ${span('student', txt.student)}
        ${span('teacher', txt.teacher)}
        ${span('date', txt.date)}
      </div>
    </div>`;

  // The certificate fills the A4 page directly (no transform scaling — that broke
  // the background in some print engines). Field positions are %, so they're
  // resolution-independent. Font px were computed on the 2000px canvas, so scale
  // them to the printed width (297mm). em is relative to the canvas width: 1
  // canvas-px = (100/CW)% of width; we express font-size in cqw so it tracks the
  // real printed width regardless of DPI.
  const cqw = (canvasPx: number) => `${((canvasPx / CW) * 100).toFixed(4)}cqw`;

  const css = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'IBM Plex Sans Thai', sans-serif; }
    .cert-scale { width: 297mm; height: 209.9mm; }
    .cert {
      position: relative;
      width: 297mm; height: 209.9mm;        /* matches 2000x1414 ratio */
      background: url('${bgUrl}') top left / 100% 100% no-repeat;
      container-type: inline-size;
    }
    .cf {
      position: absolute; transform: translate(-50%, -50%);
      text-align: center; white-space: nowrap; line-height: 1;
    }
    .cf-subject { top:${f.subject.top}%; left:${f.subject.left}%; color:${f.subject.color}; font-weight:${f.subject.weight}; font-size:${cqw(px.subject)}; letter-spacing:${f.subject.spacing}px; }
    .cf-student { top:${f.student.top}%; left:${f.student.left}%; color:${f.student.color}; font-weight:${f.student.weight}; font-size:${cqw(px.student)}; }
    .cf-teacher { top:${f.teacher.top}%; left:${f.teacher.left}%; color:${f.teacher.color}; font-weight:${f.teacher.weight}; font-size:${cqw(px.teacher)}; letter-spacing:${f.teacher.spacing}px; }
    .cf-date    { top:${f.date.top}%;    left:${f.date.left}%;    color:${f.date.color};    font-weight:${f.date.weight};    font-size:${cqw(px.date)}; }
  `;

  return {
    title: `Certificate - ${fields.studentName || ''}`.trim(),
    body,
    css,
  };
}
