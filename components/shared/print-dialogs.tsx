'use client';

import ReceiptPrintDialog from '@/components/invoices/receipt-print-dialog';
import CreditNotePrintDialog from '@/components/invoices/credit-note-print-dialog';
import { useDocumentPrint } from '@/hooks/useDocumentPrint';

type PrintHookReturn = ReturnType<typeof useDocumentPrint>;

interface PrintDialogsProps {
  print: PrintHookReturn;
  onReceiptClose?: () => void;
  onCNClose?: () => void;
}

export default function PrintDialogs({ print, onReceiptClose, onCNClose }: PrintDialogsProps) {
  return (
    <>
      {print.printInvoiceId && (
        <ReceiptPrintDialog
          open={print.showReceiptDialog}
          onOpenChange={(open) => {
            if (!open) {
              print.closeReceiptDialog();
              onReceiptClose?.();
            }
          }}
          invoiceId={print.printInvoiceId}
          onClose={onReceiptClose}
        />
      )}

      {print.printCNId && (
        <CreditNotePrintDialog
          open={print.showCNDialog}
          onOpenChange={(open) => {
            if (!open) {
              print.closeCNDialog();
              onCNClose?.();
            }
          }}
          creditNoteId={print.printCNId}
          onClose={onCNClose}
        />
      )}
    </>
  );
}
