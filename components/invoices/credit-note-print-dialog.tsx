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

interface CreditNotePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNoteId: string;
  onClose?: () => void;
}

export default function CreditNotePrintDialog({
  open,
  onOpenChange,
  creditNoteId,
  onClose,
}: CreditNotePrintDialogProps) {
  const [printing, setPrinting] = useState(false);
  const printedRef = useRef(false);

  useEffect(() => {
    if (open && creditNoteId && !printedRef.current) {
      printedRef.current = true;
      loadAndPrint();
    }
    if (!open) {
      printedRef.current = false;
    }
  }, [open, creditNoteId]);

  const loadAndPrint = async () => {
    setPrinting(true);
    try {
      const res = await fetch(`/api/admin/credit-notes/${creditNoteId}`);
      if (!res.ok) throw new Error('Failed to load credit note');
      const result = await res.json();

      const { creditNote, company, branch, originalInvoice } = result;
      if (!creditNote || !company) {
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
      const isTaxCreditNote = isVatRegistered;

      const refundAmount = creditNote.refund_amount || 0;
      const vatRate = 0.07;
      const priceBeforeVat = isTaxCreditNote ? refundAmount / (1 + vatRate) : refundAmount;
      const vatAmount = isTaxCreditNote ? refundAmount - priceBeforeVat : 0;

      const documentTitle = isTaxCreditNote
        ? 'ใบลดหนี้/ใบกำกับภาษี'
        : 'ใบลดหนี้ / Credit Note';

      const showBillingDetails = creditNote.billing_tax_id || creditNote.billing_type === 'company';

      const docData: DocumentData = {
        documentType: isTaxCreditNote ? 'credit-note-tax' : 'credit-note',
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
        documentNumber: creditNote.credit_note_number,
        documentDate: formatDate(creditNote.issued_date || creditNote.created_at, 'long'),
        reference: originalInvoice ? {
          label: 'เอกสารอ้างอิง / Reference Document',
          number: originalInvoice.invoice_number,
          date: formatDate(originalInvoice.issued_at, 'long'),
        } : undefined,
        customer: {
          name: creditNote.customer_name,
          address: creditNote.customer_address ? formatAddress(creditNote.customer_address) : undefined,
          taxId: creditNote.customer_tax_id || undefined,
          phone: creditNote.customer_phone || undefined,
          email: creditNote.customer_email || undefined,
        },
        billing: showBillingDetails ? {
          name: creditNote.billing_name || creditNote.customer_name,
          address: creditNote.billing_address ? formatAddress(creditNote.billing_address) : undefined,
          taxId: creditNote.billing_tax_id || undefined,
          branch: creditNote.billing_company_branch || undefined,
        } : undefined,
        items: (creditNote.items || []).map((item: any) => ({
          description: item.description,
          amount: item.amount,
        })),
        summary: {
          subtotal: refundAmount,
          vatBreakdown: isTaxCreditNote ? { priceBeforeVat, vatAmount } : undefined,
          total: refundAmount,
          totalLabel: 'ยอดคืนสุทธิ / Total Refund',
        },
        reason: creditNote.reason,
        signatures: {
          left: { label: 'ผู้ออกใบลดหนี้ / Issuer' },
          right: { label: 'ผู้รับเงินคืน / Recipient' },
        },
      };

      const html = generateDocumentHTML(docData);
      openPrintWindow(documentTitle, html);
    } catch (error) {
      console.error('Error printing credit note:', error);
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
