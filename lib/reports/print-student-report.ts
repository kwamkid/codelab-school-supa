// lib/reports/print-student-report.ts
// Client-side triggers shared by admin pages and the LIFF parent portal.
// Fetches the bundled report data from the given endpoint, renders the HTML
// template, and opens the browser print dialog (Save as PDF).

import type { StudentClassReport } from '@/lib/supabase/services/student-report';
import { generateStudentReportHTML } from '@/components/reports/report-template';
import { generateCertificateHTML } from '@/components/reports/certificate-template';

// Open a hidden iframe with the document's own styles and trigger print.
// (Standalone — unlike invoices/openPrintWindow it does not force invoice A4
// styles, so the certificate can be landscape.)
function openPrint(title: string, body: string, css: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${body}</body></html>`);
  doc.close();

  // Wait for font/images, then print and clean up.
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1500);
  }, 700);
}

async function fetchReport(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<StudentClassReport> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'โหลดข้อมูลรายงานไม่สำเร็จ');
  }
  return json.report as StudentClassReport;
}

// Logo is fetched as inline SVG so it renders inside the print iframe (relative
// URLs don't resolve there). Best-effort — report still prints without it.
async function loadLogoSvg(): Promise<string | undefined> {
  try {
    const res = await fetch('/logo.svg');
    if (res.ok) return await res.text();
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Print the consolidated student report. `endpoint` is the admin or LIFF route. */
export async function printStudentReport(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<void> {
  const [report, logo] = await Promise.all([fetchReport(endpoint, payload), loadLogoSvg()]);
  const { title, body, css } = generateStudentReportHTML(report, logo);
  openPrint(title, body, css);
}

/** Print the certificate (caller should ensure the class is completed). */
export async function printCertificate(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<void> {
  const [report, logo] = await Promise.all([fetchReport(endpoint, payload), loadLogoSvg()]);
  if (!report.isCompleted) {
    throw new Error('คลาสนี้ยังไม่จบ ไม่สามารถออกประกาศนียบัตรได้');
  }
  const { title, body, css } = generateCertificateHTML(report, logo);
  openPrint(title, body, css);
}
