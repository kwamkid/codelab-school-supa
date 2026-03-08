'use client';

import { useState, useCallback } from 'react';

export type PrintDocumentType = 'receipt' | 'tax-invoice' | 'tax-invoice-receipt' | 'credit-note' | 'refund-note';

interface UseDocumentPrintReturn {
  // Receipt / Tax Invoice print
  printInvoiceId: string | null;
  showReceiptDialog: boolean;
  printReceipt: (invoiceId: string) => void;
  closeReceiptDialog: () => void;

  // Credit Note / Refund Note print
  printCNId: string | null;
  showCNDialog: boolean;
  printCreditNote: (creditNoteId: string) => void;
  printRefundNote: (refundNoteId: string) => void;
  closeCNDialog: () => void;
}

export function useDocumentPrint(): UseDocumentPrintReturn {
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  const [printCNId, setPrintCNId] = useState<string | null>(null);
  const [showCNDialog, setShowCNDialog] = useState(false);

  const printReceipt = useCallback((invoiceId: string) => {
    setPrintInvoiceId(invoiceId);
    setShowReceiptDialog(true);
  }, []);

  const closeReceiptDialog = useCallback(() => {
    setShowReceiptDialog(false);
    setPrintInvoiceId(null);
  }, []);

  const printCreditNote = useCallback((creditNoteId: string) => {
    setPrintCNId(creditNoteId);
    setShowCNDialog(true);
  }, []);

  const printRefundNote = useCallback((refundNoteId: string) => {
    setPrintCNId(refundNoteId);
    setShowCNDialog(true);
  }, []);

  const closeCNDialog = useCallback(() => {
    setShowCNDialog(false);
    setPrintCNId(null);
  }, []);

  return {
    printInvoiceId,
    showReceiptDialog,
    printReceipt,
    closeReceiptDialog,

    printCNId,
    showCNDialog,
    printCreditNote,
    printRefundNote,
    closeCNDialog,
  };
}
