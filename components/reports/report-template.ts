// components/reports/report-template.ts
// Builds the printable A4 (portrait) Student Report HTML: letterhead + student/course
// info + attendance summary + every session's feedback (latest highlighted) + a photo
// gallery. Returns { title, body, css } consumed by the print helper.

import type { StudentClassReport } from '@/lib/supabase/services/student-report';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function thaiDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: 'มา', color: '#15803d', bg: '#dcfce7' },
  late: { label: 'สาย', color: '#c2410c', bg: '#ffedd5' },
  absent: { label: 'ขาด', color: '#b91c1c', bg: '#fee2e2' },
  sick: { label: 'ป่วย', color: '#a16207', bg: '#fef9c3' },
  leave: { label: 'ลา', color: '#1d4ed8', bg: '#dbeafe' },
  '': { label: 'ยังไม่เช็ค', color: '#6b7280', bg: '#f3f4f6' },
};

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

function statusBadge(status: string): string {
  const m = STATUS_META[status] || STATUS_META[''];
  return `<span class="badge" style="color:${m.color};background:${m.bg}">${m.label}</span>`;
}

export function generateStudentReportHTML(
  data: StudentClassReport,
  logoSvg?: string
): { title: string; body: string; css: string } {
  const { student, class: cls, subject, branch, company, attendance, sessions } = data;

  // Latest session that actually carries feedback or photos → highlighted
  const latestIdx = (() => {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].feedback || sessions[i].photos.length) return i;
    }
    return -1;
  })();

  const courseName = subject.name
    ? `${esc(subject.name)}${cls.name ? ` — ${esc(cls.name)}` : ''}`
    : esc(cls.name);

  const infoRows = [
    ['นักเรียน', `${esc(student.nickname || student.name)}${student.nickname ? ` (${esc(student.name)})` : ''}`],
    ['คอร์ส', courseName],
    ['ครู', esc(data.teacher.nickname || data.teacher.name) || '-'],
    ['ช่วงเรียน', `${thaiDate(cls.startDate)} - ${thaiDate(cls.endDate)}`],
    ['จำนวนครั้ง', `${cls.totalSessions} ครั้ง`],
  ];

  const summaryCells = [
    { label: 'มา', value: attendance.present, color: '#15803d' },
    { label: 'สาย', value: attendance.late, color: '#c2410c' },
    { label: 'ขาด', value: attendance.absent, color: '#b91c1c' },
    { label: 'ป่วย', value: attendance.sick, color: '#a16207' },
    { label: 'ลา', value: attendance.leave, color: '#1d4ed8' },
    { label: 'เข้าเรียน', value: `${attendance.attendanceRate}%`, color: '#0f172a' },
  ];

  const sessionBlocks = sessions
    .filter((s) => s.feedback || s.photos.length || s.status)
    .map((s) => {
      const idx = sessions.indexOf(s);
      const highlight = idx === latestIdx;
      const photos = s.photos.length
        ? `<div class="photos">${s.photos
            .map((url) => `<img src="${esc(url)}" alt="photo" />`)
            .join('')}</div>`
        : '';
      const feedback = s.feedback
        ? `<div class="feedback">${esc(s.feedback)}</div>`
        : '<div class="feedback muted">— ไม่มีความเห็น —</div>';
      return `
        <div class="session ${highlight ? 'session-latest' : ''}">
          <div class="session-head">
            <span class="session-no">ครั้งที่ ${s.sessionNumber}</span>
            <span class="session-date">${thaiDate(s.sessionDate)}</span>
            ${statusBadge(s.status)}
            ${highlight ? '<span class="latest-tag">ล่าสุด</span>' : ''}
          </div>
          ${feedback}
          ${photos}
        </div>`;
    })
    .join('');

  const body = `
    <div class="report">
      <div class="head">
        ${logoSvg ? `<div class="logo">${logoSvg}</div>` : ''}
        <div class="head-text">
          <div class="org">${esc(company.name || branch.name)}</div>
          <div class="branch">${esc(branch.name)}${branch.phone ? ` · โทร ${esc(branch.phone)}` : ''}</div>
        </div>
      </div>

      <h1 class="title">รายงานความเห็นครู (Student Report)</h1>

      <table class="info">
        ${infoRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}
      </table>

      <div class="summary">
        ${summaryCells
          .map(
            (c) => `<div class="sum-cell"><div class="sum-val" style="color:${c.color}">${c.value}</div><div class="sum-lbl">${c.label}</div></div>`
          )
          .join('')}
      </div>

      <h2 class="section">ความเห็นรายครั้ง</h2>
      ${sessionBlocks || '<div class="empty">ยังไม่มีความเห็นจากครู</div>'}

      <div class="foot">พิมพ์เมื่อ ${thaiDate(new Date().toISOString())} · ${esc(company.name || branch.name)}</div>
    </div>`;

  const css = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 portrait; margin: 14mm; }
    body { font-family: 'IBM Plex Sans Thai', sans-serif; color: #0f172a; margin: 0; }
    .report { max-width: 182mm; margin: 0 auto; }
    .head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #F4511E; padding-bottom: 10px; }
    .logo { width: 46px; height: 46px; }
    .logo svg { width: 100%; height: 100%; }
    .org { font-size: 16px; font-weight: 700; }
    .branch { font-size: 12px; color: #64748b; }
    .title { font-size: 18px; font-weight: 700; margin: 16px 0 12px; }
    table.info { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }
    table.info th { text-align: left; width: 90px; color: #64748b; font-weight: 500; padding: 3px 6px; vertical-align: top; }
    table.info td { padding: 3px 6px; }
    .summary { display: flex; gap: 8px; margin-bottom: 18px; }
    .sum-cell { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; padding: 8px 4px; }
    .sum-val { font-size: 18px; font-weight: 700; }
    .sum-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    .section { font-size: 14px; font-weight: 700; margin: 0 0 10px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .session { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
    .session-latest { border-color: #F4511E; background: #fff7ed; }
    .session-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .session-no { font-weight: 700; font-size: 13px; }
    .session-date { font-size: 12px; color: #64748b; }
    .badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; }
    .latest-tag { font-size: 10px; font-weight: 700; color: #F4511E; border: 1px solid #F4511E; border-radius: 999px; padding: 1px 7px; margin-left: auto; }
    .feedback { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
    .feedback.muted { color: #94a3b8; }
    .photos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .photos img { width: 84px; height: 84px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; }
    .empty { font-size: 13px; color: #94a3b8; padding: 12px 0; }
    .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  `;

  return {
    title: `รายงาน ${student.nickname || student.name} - ${subject.name || cls.name}`,
    body,
    css,
  };
}
