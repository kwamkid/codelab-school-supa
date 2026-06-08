// components/reports/certificate-template.ts
// Builds the printable A4 (landscape) Certificate of Completion HTML. Issued only
// when the class is completed (caller gates on data.isCompleted). Returns
// { title, body, css } consumed by the print helper.

import type { StudentClassReport } from '@/lib/supabase/services/student-report';

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function thaiLongDate(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}

function esc(s: string): string {
  return (s || '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

export function generateCertificateHTML(
  data: StudentClassReport,
  logoSvg?: string
): { title: string; body: string; css: string } {
  const { student, class: cls, subject, teacher, branch, company } = data;

  const fullName = student.name || student.nickname;
  const courseName = subject.name
    ? `${esc(subject.name)}${cls.name ? ` (${esc(cls.name)})` : ''}`
    : esc(cls.name);
  const org = company.name || branch.name;

  const body = `
    <div class="cert">
      <div class="cert-border">
        ${logoSvg ? `<div class="cert-logo">${logoSvg}</div>` : ''}
        <div class="cert-org">${esc(org)}</div>
        <h1 class="cert-title">ประกาศนียบัตร</h1>
        <div class="cert-sub">Certificate of Completion</div>

        <div class="cert-intro">ขอมอบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า</div>
        <div class="cert-name">${esc(fullName)}</div>
        <div class="cert-body">
          ได้สำเร็จการเรียนหลักสูตร<br/>
          <span class="cert-course">${courseName}</span><br/>
          จำนวน ${cls.totalSessions} ครั้ง
        </div>

        <div class="cert-date">ให้ไว้ ณ วันที่ ${thaiLongDate(cls.endDate)}</div>

        <div class="cert-signs">
          <div class="sign">
            <div class="sign-line"></div>
            <div class="sign-name">${esc(teacher.nickname || teacher.name) || 'ครูผู้สอน'}</div>
            <div class="sign-role">ครูผู้สอน</div>
          </div>
          <div class="sign">
            <div class="sign-line"></div>
            <div class="sign-name">${esc(branch.name)}</div>
            <div class="sign-role">สาขา</div>
          </div>
        </div>
      </div>
    </div>`;

  const css = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 landscape; margin: 0; }
    body { font-family: 'IBM Plex Sans Thai', sans-serif; color: #1f2937; margin: 0; }
    .cert { width: 297mm; height: 209mm; padding: 10mm; }
    .cert-border {
      height: 100%; border: 3px solid #F4511E; border-radius: 10px;
      outline: 1px solid #F4511E; outline-offset: 5px;
      display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 14mm 20mm;
    }
    .cert-logo { width: 64px; height: 64px; margin-bottom: 6px; }
    .cert-logo svg { width: 100%; height: 100%; }
    .cert-org { font-size: 18px; font-weight: 700; color: #0f172a; }
    .cert-title { font-size: 46px; font-weight: 700; color: #F4511E; margin: 10px 0 0; letter-spacing: 1px; }
    .cert-sub { font-size: 15px; letter-spacing: 4px; color: #64748b; text-transform: uppercase; }
    .cert-intro { margin-top: 20px; font-size: 15px; color: #475569; }
    .cert-name { font-size: 34px; font-weight: 700; margin: 10px 0; color: #0f172a; border-bottom: 2px dotted #cbd5e1; padding: 0 30px 8px; }
    .cert-body { font-size: 16px; line-height: 1.8; color: #334155; margin-top: 8px; }
    .cert-course { font-size: 20px; font-weight: 600; color: #F4511E; }
    .cert-date { margin-top: 18px; font-size: 14px; color: #475569; }
    .cert-signs { display: flex; gap: 90px; margin-top: auto; padding-top: 18px; }
    .sign { width: 200px; }
    .sign-line { border-bottom: 1px solid #94a3b8; margin-bottom: 6px; height: 28px; }
    .sign-name { font-size: 14px; font-weight: 600; }
    .sign-role { font-size: 12px; color: #64748b; }
  `;

  return {
    title: `ประกาศนียบัตร ${fullName} - ${subject.name || cls.name}`,
    body,
    css,
  };
}
