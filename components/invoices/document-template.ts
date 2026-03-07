// components/invoices/document-template.ts
// Shared template for all printed documents (Receipt, Tax Invoice, Credit Note)
// Design based on pdfMake-style layout: ink-saving, no vertical table lines, corner triangle

import { formatCurrency, formatDate } from '@/lib/utils';

export interface DocumentData {
  // Document type
  documentType: 'receipt' | 'tax-invoice-receipt' | 'credit-note' | 'credit-note-tax';
  documentTitle: string; // e.g. "ใบเสร็จรับเงิน / Receipt"

  // Company header
  company: {
    name: string;
    logoSvg?: string; // inline SVG string for logo
    address?: string;
    taxId?: string;
    phone?: string;
    email?: string;
    branchName?: string;
  };

  // Document info
  documentNumber: string;
  documentDate: string; // formatted date string

  // Reference (for credit notes)
  reference?: {
    label: string;
    number: string;
    date: string;
  };

  // Customer info
  customer: {
    name: string;
    address?: string;
    taxId?: string;
    phone?: string;
    email?: string;
  };

  // Billing info (for tax invoice)
  billing?: {
    name: string;
    address?: string;
    taxId?: string;
    branch?: string;
  };

  // Items table
  items: {
    description: string;
    studentName?: string;
    amount: number;
  }[];

  // Summary
  summary: {
    subtotal: number;
    discount?: { label: string; amount: number };
    vatBreakdown?: { priceBeforeVat: number; vatAmount: number };
    total: number;
    totalLabel: string;
  };

  // Payment info (for receipts)
  payment?: {
    method: string;
    paidAmount: number;
    remaining?: number;
    remainingBefore?: number;
    remainingAfter?: number;
    enrollmentTotal?: number;
  };

  // Reason (for credit notes)
  reason?: string;

  // Signatures
  signatures: {
    left: { label: string };
    right: { label: string };
  };
}

// Color themes per document type
const THEME_COLORS: Record<string, string> = {
  'receipt': '#15803d',
  'tax-invoice-receipt': '#15803d',
  'tax-invoice': '#2563eb',
  'credit-note': '#dc2626',
  'credit-note-tax': '#dc2626',
};

export function generatePrintStyles(): string {
  return `
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'IBM Plex Sans Thai', sans-serif; font-size: 11px; color: #1e293b; padding: 0; line-height: 1.4; }
    @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

    .doc-container { width: 100%; max-width: 210mm; margin: 0 auto; position: relative; }
    .doc-container + .doc-container { page-break-before: always; }
    .doc-page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; position: relative; padding: 0; overflow: hidden; }
    .doc-content { flex: 1; padding: 14mm 14mm 0 14mm; }

    /* Corner triangle — absolute top-right of PAGE, small inset from edge */
    .corner-triangle {
      position: absolute; top: 12px; right: 12px; width: 72px; height: 72px; z-index: 0;
    }
    .corner-triangle svg { display: block; }

    /* Copy label — under doc title */
    .copy-label { font-size: 10px; font-weight: 600; margin-top: 0; margin-bottom: 8px; }
    .copy-label.original { color: #15803d; }
    .copy-label.duplicate { color: #6b7280; }

    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }

    /* Header: company left, doc info right */
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; margin-bottom: 0; gap: 16px; }
    .header-left { flex: 1; text-align: left; }
    .header-left .company-logo { margin-bottom: 8px; }
    .header-left .company-logo svg { height: 36px; width: auto; }
    .header-left .company-name { font-size: 13px; font-weight: 700; color: #111; }
    .header-left p { margin-top: 1px; font-size: 10px; color: #6b7280; }

    .header-right { width: 230px; flex-shrink: 0; text-align: right; position: relative; z-index: 1; }
    .header-right .doc-title { font-size: 20px; font-weight: 700; color: var(--theme-color, #15803d); margin-bottom: 0; }

    /* Info box — table with horizontal lines only */
    .info-box { width: 100%; border-collapse: collapse; font-size: 11px; }
    .info-box tr:first-child td { padding-top: 6px; border-top: 0.5px solid #ccc; }
    .info-box tr:last-child td { padding-bottom: 6px; border-bottom: 0.5px solid #ccc; }
    .info-box td { padding: 2px 0; border: none; }
    .info-box .info-label { width: 50px; font-weight: 600; color: var(--theme-color, #15803d); text-align: left; }
    .info-box .info-value { text-align: left; }

    /* Customer / Billing */
    .customer-section { padding: 0; margin-bottom: 12px; font-size: 11px; }
    .customer-section .section-title { font-weight: 700; margin-bottom: 3px; font-size: 11px; color: var(--theme-color, #15803d); }
    .customer-section .customer-detail { margin-top: 1px; color: #374151; }

    /* Reference (credit notes) */
    .reference-box { border: 0.5px solid #ccc; padding: 8px 10px; margin-bottom: 12px; font-size: 11px; }

    /* Items table — no vertical lines, horizontal only */
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    table.items th, table.items td { border: none; padding: 6px 8px; text-align: left; font-size: 11px; vertical-align: top; }
    table.items thead tr { border-top: 1px solid #333; border-bottom: 1px solid #333; }
    table.items th { font-weight: 600; background: none; }
    table.items tbody tr { border-bottom: 0.5px solid #e5e7eb; }
    table.items tbody tr:last-child { border-bottom: 1px solid #333; }

    /* Below table: payment left + summary right */
    .below-table { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px; margin-bottom: 12px; gap: 20px; }
    .below-table-left { flex: 1; }
    .below-table-right { width: 260px; flex-shrink: 0; }

    /* Payment info — rounded border box */
    .payment-section { font-size: 11px; border: 1px solid #d1d5db; border-radius: 15px; padding: 10px 16px 10px 14px; margin-top: 4px; max-width: 260px; }
    .payment-section .section-label { font-weight: 600; margin-bottom: 6px; font-size: 11px; }
    .payment-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .text-red { color: #dc2626; }

    /* Reason box (credit notes) */
    .reason-box { border: 0.5px solid #fecaca; padding: 8px 10px; font-size: 11px; margin-top: 8px; }
    .reason-box .box-title { font-weight: 600; margin-bottom: 3px; }

    /* Summary — clean, no border */
    .summary-box { font-size: 11px; }
    .summary-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .summary-discount { display: flex; justify-content: space-between; padding: 2px 0; color: #15803d; }
    .summary-total { display: flex; justify-content: space-between; padding: 6px 0; font-weight: 700; font-size: 13px; margin-top: 4px; color: var(--theme-color, #15803d); }

    /* Footer: signatures + company line */
    .doc-footer { margin-top: auto; padding: 0 14mm 14mm 14mm; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; text-align: center; padding-top: 12px; }
    .signature-block { }
    .signature-company { font-size: 10px; color: #6b7280; margin-bottom: 16px; }
    .signature-line-row { display: flex; justify-content: center; align-items: flex-end; gap: 12px; }
    .sig-line { border-bottom: 0.5px solid #ccc; width: 140px; height: 1px; }
    .date-line { border-bottom: 0.5px solid #ccc; width: 80px; height: 1px; }
    .signature-label { font-size: 10px; margin-top: 4px; }
    .signature-date-label { font-size: 10px; margin-top: 4px; color: #6b7280; }
    .footer-line { margin-top: 16px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 0.5px solid #e5e7eb; padding-top: 6px; }
  `;
}

function generatePageHTML(data: DocumentData, copyType: 'original' | 'copy'): string {
  const hasStudentColumn = data.items.some(item => item.studentName);
  const themeColor = THEME_COLORS[data.documentType] || '#15803d';
  const copyLabel = copyType === 'original' ? '(ต้นฉบับ)' : '(สำเนา)';
  const copyClass = copyType === 'original' ? 'original' : 'duplicate';

  let html = `<div class="doc-container"><div class="doc-page" style="--theme-color: ${themeColor}">`;

  // Corner triangle SVG
  html += `<div class="corner-triangle">
    <svg width="72" height="72" viewBox="0 0 72 72">
      <polygon points="10,0 72,0 72,62" fill="${themeColor}" />
    </svg>
  </div>`;

  html += `<div class="doc-content">`;

  // ===== Header Row: Company (left) + Doc Info (right) =====
  html += `<div class="header-row">
    <div class="header-left">
      ${data.company.logoSvg ? `<div class="company-logo">${data.company.logoSvg}</div>` : ''}
      <div class="company-name">${data.company.name}</div>
      <p>${data.company.branchName || 'สำนักงานใหญ่'}</p>
      ${data.company.address ? `<p>${data.company.address}</p>` : ''}
      ${data.company.taxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${data.company.taxId}</p>` : ''}
      ${data.company.phone ? `<p>โทร: ${data.company.phone}</p>` : ''}
    </div>
    <div class="header-right">
      <div class="doc-title">${data.documentTitle}</div>
      <div class="copy-label ${copyClass}">${copyLabel}</div>
      <table class="info-box">
        <tr>
          <td class="info-label">เลขที่</td>
          <td class="info-value">${data.documentNumber}</td>
        </tr>
        <tr>
          <td class="info-label">วันที่</td>
          <td class="info-value">${data.documentDate}</td>
        </tr>
      </table>
    </div>
  </div>`;

  // ===== Reference (credit notes) =====
  if (data.reference) {
    html += `<div class="reference-box">
      <p class="font-semibold">${data.reference.label}</p>
      <p>เลขที่: ${data.reference.number} &nbsp;&nbsp; ลงวันที่: ${data.reference.date}</p>
    </div>`;
  }

  // ===== Customer / Billing =====
  const displayName = data.billing?.name || data.customer.name;
  const displayAddress = data.billing?.address || data.customer.address;
  const displayTaxId = data.billing?.taxId || data.customer.taxId;

  html += `<div class="customer-section">
    <p class="section-title">ลูกค้า</p>
    <p class="customer-detail">${displayName}</p>
    ${displayAddress ? `<p class="customer-detail">${displayAddress}</p>` : ''}
    ${displayTaxId ? `<p class="customer-detail">เลขประจำตัวผู้เสียภาษี: ${displayTaxId}</p>` : ''}
    ${data.billing?.branch ? `<p class="customer-detail">สาขา: ${data.billing.branch}</p>` : ''}
  </div>`;

  // ===== Items Table — no vertical lines =====
  html += `<table class="items">
    <thead><tr>
      <th style="width:32px">#</th>
      <th>รายการ</th>
      ${hasStudentColumn ? '<th>นักเรียน</th>' : ''}
      <th style="width:100px" class="text-right">จำนวนเงิน</th>
    </tr></thead>
    <tbody>`;

  data.items.forEach((item, idx) => {
    html += `<tr>
      <td>${idx + 1}</td>
      <td>${item.description}</td>
      ${hasStudentColumn ? `<td>${item.studentName || ''}</td>` : ''}
      <td class="text-right font-semibold">${formatCurrency(item.amount)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  // ===== Below Table: Payment/Notes (left) + Summary (right) =====
  html += `<div class="below-table">`;

  // Left: Payment + Reason
  html += `<div class="below-table-left">`;

  if (data.payment) {
    html += `<div class="payment-section">
      <p class="section-label">การชำระเงิน / Payment</p>
      <div class="payment-row">
        <span>วิธีชำระ:</span>
        <span>${data.payment.method}</span>
      </div>`;

    if (data.payment.enrollmentTotal && data.payment.remainingAfter != null && data.payment.remainingAfter >= 0) {
      html += `<div class="payment-row" style="margin-top:4px">
        <span>ยอดค่าเรียนทั้งหมด:</span>
        <span>${formatCurrency(data.payment.enrollmentTotal)}</span>
      </div>`;
      if (data.payment.remainingBefore != null && data.payment.remainingBefore < data.payment.enrollmentTotal) {
        html += `<div class="payment-row">
          <span>ยอดคงเหลือ:</span>
          <span>${formatCurrency(data.payment.remainingBefore)}</span>
        </div>`;
      }
      html += `<div class="payment-row">
        <span>ชำระครั้งนี้:</span>
        <span>${formatCurrency(data.payment.paidAmount)}</span>
      </div>`;
      if (data.payment.remainingAfter > 0) {
        html += `<div class="payment-row text-red" style="font-weight:600">
          <span>เหลือชำระ:</span>
          <span>${formatCurrency(data.payment.remainingAfter)}</span>
        </div>`;
      }
    } else {
      html += `<div class="payment-row">
        <span>ชำระแล้ว:</span>
        <span>${formatCurrency(data.payment.paidAmount)}</span>
      </div>`;
    }

    html += `</div>`;
  }

  if (data.reason) {
    html += `<div class="reason-box">
      <p class="box-title">สาเหตุ / Reason</p>
      <p>${data.reason}</p>
    </div>`;
  }

  html += `</div>`;

  // Right: Summary
  html += `<div class="below-table-right"><div class="summary-box">`;

  html += `<div class="summary-row">
    <span>รวม / Subtotal:</span>
    <span>${formatCurrency(data.summary.subtotal)}</span>
  </div>`;

  if (data.summary.discount && data.summary.discount.amount > 0) {
    html += `<div class="summary-discount">
      <span>${data.summary.discount.label}:</span>
      <span>-${formatCurrency(data.summary.discount.amount)}</span>
    </div>`;
  }

  if (data.summary.vatBreakdown) {
    html += `<div class="summary-row">
      <span>ราคาก่อน VAT:</span>
      <span>${formatCurrency(Math.round(data.summary.vatBreakdown.priceBeforeVat))}</span>
    </div>
    <div class="summary-row">
      <span>VAT 7%:</span>
      <span>${formatCurrency(Math.round(data.summary.vatBreakdown.vatAmount))}</span>
    </div>`;
  }

  html += `<div class="summary-total">
    <span>${data.summary.totalLabel}:</span>
    <span>${formatCurrency(data.summary.total)}</span>
  </div>`;

  html += `</div></div>`;

  // Close below-table
  html += `</div>`;

  // Close doc-content
  html += `</div>`;

  // ===== Footer: Signatures =====
  html += `<div class="doc-footer">
    <div class="signatures">
      <div class="signature-block">
        <p class="signature-company">ในนาม ${data.company.name}</p>
        <div class="signature-line-row">
          <div>
            <div class="sig-line"></div>
            <p class="signature-label">${data.signatures.left.label}</p>
          </div>
          <div>
            <div class="date-line"></div>
            <p class="signature-date-label">วันที่</p>
          </div>
        </div>
      </div>
      <div class="signature-block">
        <p class="signature-company">ในนาม ${data.company.name}</p>
        <div class="signature-line-row">
          <div>
            <div class="sig-line"></div>
            <p class="signature-label">${data.signatures.right.label}</p>
          </div>
          <div>
            <div class="date-line"></div>
            <p class="signature-date-label">วันที่</p>
          </div>
        </div>
      </div>
    </div>
    <div class="footer-line">
      <p>${data.company.name}</p>
    </div>
  </div>`;

  // Close doc-page and doc-container
  html += `</div></div>`;

  return html;
}

export function generateDocumentHTML(data: DocumentData): string {
  // Generate 2 pages: ต้นฉบับ (original) + สำเนา (copy)
  const originalPage = generatePageHTML(data, 'original');
  const copyPage = generatePageHTML(data, 'copy');
  return originalPage + copyPage;
}

export function openPrintWindow(title: string, contentHTML: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${generatePrintStyles()}</style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>${contentHTML}</body>
</html>`);
  iframeDoc.close();

  // Wait for font to load, then print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 600);
}

// Helper: format address object to string
export function formatAddress(addr: any): string {
  if (!addr) return '';
  const parts = [
    addr.houseNumber || addr.house_number,
    addr.street,
    addr.subDistrict || addr.sub_district,
    addr.district,
    addr.province,
    addr.postalCode || addr.postal_code,
  ].filter(Boolean);
  return parts.join(' ');
}
