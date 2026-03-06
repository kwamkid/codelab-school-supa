// components/invoices/document-template.ts
// Shared template for all printed documents (Receipt, Tax Invoice, Credit Note)

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

export function generatePrintStyles(): string {
  return `
    @page { size: A4 portrait; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', sans-serif; font-size: 12px; color: #111; padding: 0; }
    @media print { body { padding: 0; } }

    .doc-container { width: 100%; max-width: 210mm; margin: 0 auto; position: relative; }
    .doc-container + .doc-container { page-break-before: always; }
    .doc-page { min-height: 100vh; display: flex; flex-direction: column; position: relative; }
    .doc-content { flex: 1; }

    /* Corner triangle accent — top-right of content area */
    .corner-accent { position: absolute; top: 0; right: 0; width: 0; height: 0; border-style: solid; border-width: 0 28mm 28mm 0; border-color: transparent; border-right-color: var(--accent-color, #ef443a); z-index: 0; }

    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-semibold { font-weight: 600; }

    /* Header: company left, doc info right */
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 0; }
    .header-left { text-align: left; }
    .header-left .company-logo { margin-bottom: 10px; }
    .header-left .company-logo svg { height: 32px; width: auto; }
    .header-left .company-name { font-size: 16px; font-weight: bold; }
    .header-left p { margin-top: 2px; font-size: 11px; color: #374151; }
    .header-right { text-align: left; position: relative; z-index: 1; padding-right: 32mm; }
    .header-right .doc-title { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .header-right .doc-subtitle { font-size: 13px; color: #6b7280; margin-bottom: 10px; }
    .header-right .doc-meta { font-size: 14px; color: #374151; }
    .header-right .doc-meta .meta-row { display: flex; margin-top: 4px; }
    .header-right .doc-meta .meta-label { width: 65px; flex-shrink: 0; font-weight: 600; color: var(--accent-color, #ef443a); }
    .header-right .doc-meta .meta-value { }

    /* Customer / Billing — no border, flows under company */
    .customer-section { padding: 0; margin-bottom: 14px; font-size: 12px; }
    .customer-section .section-title { font-weight: 600; margin-bottom: 4px; font-size: 12px; }
    .customer-section .customer-detail { margin-top: 2px; }

    /* Reference (credit notes) */
    .reference-box { background: #f9fafb; border: 1px solid #d1d5db; border-radius: 4px; padding: 10px 12px; margin-bottom: 14px; font-size: 12px; }

    /* Items table */
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-size: 12px; }
    th { background: #f3f4f6; font-weight: 600; }

    /* Below table: payment left + summary right */
    .below-table { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px; margin-bottom: 14px; gap: 24px; }
    .below-table-left { flex: 1; }
    .below-table-right { width: 240px; flex-shrink: 0; }

    /* Payment box */
    .payment-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 10px 12px; font-size: 12px; }
    .payment-box .box-title { font-weight: 600; margin-bottom: 4px; }
    .payment-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .text-red { color: #dc2626; }

    /* Reason box (credit notes) */
    .reason-box { border: 1px solid #fecaca; background: #fef2f2; border-radius: 4px; padding: 10px 12px; font-size: 12px; margin-top: 8px; }
    .reason-box .box-title { font-weight: 600; margin-bottom: 4px; }

    /* Summary */
    .summary-box { font-size: 12px; }
    .summary-row { display: flex; justify-content: space-between; padding: 3px 0; }
    .summary-discount { display: flex; justify-content: space-between; padding: 3px 0; color: #15803d; }
    .summary-total { display: flex; justify-content: space-between; padding: 6px 0; border-top: 2px solid #1f2937; font-weight: bold; font-size: 14px; margin-top: 4px; }

    /* Footer: signatures + company line */
    .doc-footer { margin-top: auto; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; padding-top: 16px; }
    .signature-line { border-bottom: 1px solid #9ca3af; margin-bottom: 4px; height: 40px; }
    .signature-label { font-size: 12px; }
    .signature-date { color: #9ca3af; font-size: 11px; margin-top: 2px; }
    .footer-line { margin-top: 20px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  `;
}

export function generateDocumentHTML(data: DocumentData): string {
  const hasStudentColumn = data.items.some(item => item.studentName);

  // Determine accent color based on document type
  const accentColor = '#ef443a';

  // Subtitle based on document type
  const subtitleMap: Record<string, string> = {
    'receipt': 'ต้นฉบับ',
    'tax-invoice-receipt': 'ต้นฉบับ',
    'credit-note': 'ต้นฉบับ',
    'credit-note-tax': 'ต้นฉบับ',
  };
  const subtitle = subtitleMap[data.documentType] || '';

  let html = `<div class="doc-container"><div class="doc-page" style="--accent-color: ${accentColor}"><div class="corner-accent"></div><div class="doc-content">`;

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
      ${subtitle ? `<div class="doc-subtitle">${subtitle}</div>` : ''}
      <div class="doc-meta">
        <div class="meta-row">
          <span class="meta-label">เลขที่</span>
          <span class="meta-value">${data.documentNumber}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">วันที่</span>
          <span class="meta-value">${data.documentDate}</span>
        </div>
      </div>
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
  // If billing info exists, show billing as primary customer display
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

  // ===== Items Table =====
  html += `<table>
    <thead><tr>
      <th style="width:36px">#</th>
      <th>รายการ</th>
      ${hasStudentColumn ? '<th>นักเรียน</th>' : ''}
      <th style="width:110px" class="text-right">จำนวนเงิน</th>
    </tr></thead>
    <tbody>`;

  data.items.forEach((item, idx) => {
    html += `<tr>
      <td>${idx + 1}</td>
      <td>${item.description}</td>
      ${hasStudentColumn ? `<td>${item.studentName || ''}</td>` : ''}
      <td class="text-right">${formatCurrency(item.amount)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  // ===== Below Table: Payment (left) + Summary (right) =====
  html += `<div class="below-table">`;

  // Left: Payment + Reason
  html += `<div class="below-table-left">`;

  if (data.payment) {
    html += `<div class="payment-box">
      <p class="box-title">การชำระเงิน / Payment</p>
      <div class="payment-row">
        <span>วิธีชำระ:</span>
        <span>${data.payment.method}</span>
      </div>`;

    if (data.payment.enrollmentTotal && data.payment.enrollmentTotal > data.payment.paidAmount) {
      html += `<div class="payment-row" style="margin-top:4px">
        <span>ยอดค่าเรียนทั้งหมด:</span>
        <span>${formatCurrency(data.payment.enrollmentTotal)}</span>
      </div>
      <div class="payment-row">
        <span>ชำระครั้งนี้:</span>
        <span>${formatCurrency(data.payment.paidAmount)}</span>
      </div>
      <div class="payment-row text-red" style="font-weight:600">
        <span>คงเหลือ:</span>
        <span>${formatCurrency(data.payment.enrollmentTotal - data.payment.paidAmount)}</span>
      </div>`;
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

  // ===== Close doc-content =====
  html += `</div>`;

  // ===== Footer: Signatures + Company Line (always at bottom) =====
  html += `<div class="doc-footer">
    <div class="signatures">
      <div>
        <div class="signature-line"></div>
        <p class="signature-label">${data.signatures.left.label}</p>
        <p class="signature-date">วันที่ ___/___/______</p>
      </div>
      <div>
        <div class="signature-line"></div>
        <p class="signature-label">${data.signatures.right.label}</p>
        <p class="signature-date">วันที่ ___/___/______</p>
      </div>
    </div>
    <div class="footer-line">
      <p>${data.company.name}</p>
      ${data.company.email ? `<p>${data.company.email}</p>` : ''}
    </div>
  </div>`;

  // Close doc-page and doc-container
  html += `</div></div>`;

  return html;
}

export function openPrintWindow(title: string, contentHTML: string) {
  // Use hidden iframe to print without opening a new tab
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
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>${contentHTML}</body>
</html>`);
  iframeDoc.close();

  // Wait for font to load, then print
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // Clean up after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
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
