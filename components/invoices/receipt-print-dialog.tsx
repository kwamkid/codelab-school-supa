'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import {
  DocumentData,
  generateDocumentHTML,
  openPrintWindow,
  formatAddress,
} from './document-template';

const paymentMethodLabels: Record<string, string> = {
  cash: 'เงินสด',
  bank_transfer: 'โอนเงิน',
  promptpay: 'PromptPay',
  credit_card: 'บัตรเครดิต',
  online: 'ชำระออนไลน์',
  transfer: 'โอนเงิน',
  credit: 'บัตรเครดิต',
};

interface ReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  onClose?: () => void;
}

export default function ReceiptPrintDialog({
  open,
  onOpenChange,
  invoiceId,
  onClose,
}: ReceiptPrintDialogProps) {
  const [printing, setPrinting] = useState(false);
  const printedRef = useRef(false);

  useEffect(() => {
    if (open && invoiceId && !printedRef.current) {
      printedRef.current = true;
      loadAndPrint();
    }
    if (!open) {
      printedRef.current = false;
    }
  }, [open, invoiceId]);

  const loadAndPrint = async () => {
    setPrinting(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Failed to load invoice');
      const result = await res.json();

      const { invoice, documentType: docType, company, branch, enrollment, paymentSnapshot } = result;
      if (!invoice || !company) {
        onOpenChange(false);
        onClose?.();
        return;
      }

      // Fetch logo SVG
      let logoSvg: string | undefined;
      try {
        const logoRes = await fetch('/logo.svg');
        if (logoRes.ok) logoSvg = await logoRes.text();
      } catch {}

      const isVatRegistered = company.is_vat_registered;
      const documentType = docType || 'receipt';
      const isTaxInvoice = documentType === 'tax-invoice' || documentType === 'tax-invoice-receipt';
      const showBillingDetails = isTaxInvoice;

      const totalAmount = invoice.total_amount || 0;
      // Use vat_amount from DB (pre-computed) instead of calculating
      const vatAmount = invoice.vat_amount || 0;
      const priceBeforeVat = totalAmount - vatAmount;
      // Show VAT breakdown for tax invoices always, and for VAT-registered receipts
      const showVat = isTaxInvoice || (documentType === 'receipt' && isVatRegistered && vatAmount > 0);

      let documentTitle: string;
      if (documentType === 'tax-invoice') {
        documentTitle = 'ใบกำกับภาษี / Tax Invoice';
      } else if (documentType === 'tax-invoice-receipt') {
        documentTitle = 'ใบกำกับภาษี/ใบเสร็จรับเงิน';
      } else {
        documentTitle = 'ใบเสร็จรับเงิน / Receipt';
      }

      // Load reference invoice data (for standalone tax invoice issued later)
      let referenceData: { number: string; date: string } | undefined;
      if (documentType === 'tax-invoice' && result.referenceInvoice) {
        referenceData = {
          number: result.referenceInvoice.invoice_number,
          date: formatDate(result.referenceInvoice.issued_at || result.referenceInvoice.created_at, 'long'),
        };
      }

      const docData: DocumentData = {
        documentType: documentType as any,
        documentTitle,
        company: {
          name: company.name || '-',
          logoSvg,
          address: company.address ? formatAddress(company.address) : undefined,
          taxId: company.tax_id || undefined,
          phone: company.phone || undefined,
          email: company.email || undefined,
          branchName: branch?.name || undefined,
        },
        documentNumber: invoice.invoice_number,
        documentDate: formatDate(invoice.issued_at || invoice.created_at, 'long'),
        reference: referenceData ? {
          label: 'เอกสารอ้างอิง / Reference Document',
          number: referenceData.number,
          date: referenceData.date,
        } : undefined,
        customer: {
          name: invoice.customer_name,
          address: invoice.customer_address ? formatAddress(invoice.customer_address) : undefined,
          taxId: invoice.customer_tax_id || undefined,
          phone: invoice.customer_phone || undefined,
          email: invoice.customer_email || undefined,
        },
        billing: showBillingDetails ? {
          name: invoice.billing_name,
          address: invoice.billing_address ? formatAddress(invoice.billing_address) : undefined,
          taxId: invoice.billing_tax_id || undefined,
          branch: invoice.billing_company_branch || undefined,
        } : undefined,
        items: (invoice.items || []).map((item: any) => ({
          description: item.description || item.className,
          studentName: item.studentName,
          amount: item.amount,
        })),
        summary: {
          subtotal: invoice.subtotal,
          discount: invoice.discount_amount > 0 ? {
            label: `ส่วนลด / Discount${invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}`,
            amount: invoice.discount_amount,
          } : undefined,
          vatBreakdown: showVat ? { priceBeforeVat, vatAmount } : undefined,
          total: totalAmount,
          totalLabel: 'ยอดสุทธิ / Total',
        },
        payment: {
          method: paymentMethodLabels[invoice.payment_method] || invoice.payment_method || '-',
          paidAmount: invoice.paid_amount || 0,
          remainingBefore: paymentSnapshot?.remainingBefore ?? undefined,
          remainingAfter: paymentSnapshot?.remainingAfter ?? undefined,
          enrollmentTotal: enrollment?.final_price || undefined,
        },
        signatures: {
          left: { label: 'ผู้รับเงิน / Receiver' },
          right: { label: 'ผู้จ่ายเงิน / Payer' },
        },
      };

      const html = generateDocumentHTML(docData);
      openPrintWindow(documentTitle, html);
    } catch (error) {
      console.error('Error printing invoice:', error);
    } finally {
      setPrinting(false);
      onOpenChange(false);
      onClose?.();
    }
  };

  if (!open) return null;

  // Show a brief loading indicator while fetching
  return printing ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-lg p-6 flex items-center gap-3 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        <span className="text-base text-gray-700">กำลังเตรียมพิมพ์...</span>
      </div>
    </div>
  ) : null;
}
