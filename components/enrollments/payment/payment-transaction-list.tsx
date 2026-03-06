'use client';

import { PaymentTransaction } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Receipt, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

const methodLabels: Record<string, string> = {
  'cash': 'เงินสด',
  'bank_transfer': 'โอนเงิน',
  'promptpay': 'PromptPay',
  'credit_card': 'บัตรเครดิต',
  'online': 'ออนไลน์',
  // Legacy
  'transfer': 'โอนเงิน',
  'credit': 'บัตรเครดิต',
};

interface PaymentTransactionListProps {
  transactions: PaymentTransaction[];
  onDelete?: (id: string) => Promise<void>;
  canEdit?: boolean;
}

export default function PaymentTransactionList({
  transactions,
  onDelete,
  canEdit = false,
}: PaymentTransactionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5" />
            ประวัติการชำระเงิน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base text-gray-500 text-center py-4">
            ยังไม่มีรายการชำระเงิน
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-5 w-5" />
          ประวัติการชำระเงิน ({transactions.length} รายการ)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-green-600">
                    +{formatCurrency(tx.amount)}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {methodLabels[tx.method] || tx.method}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {formatDate(tx.transactionDate, 'long')}
                  {tx.receiptNumber && (
                    <span className="ml-2">| ใบเสร็จ: {tx.receiptNumber}</span>
                  )}
                </div>
                {tx.note && (
                  <p className="text-sm text-gray-500 mt-1">{tx.note}</p>
                )}
              </div>

              {canEdit && onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      disabled={deletingId === tx.id}
                    >
                      {deletingId === tx.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                      <AlertDialogDescription>
                        คุณแน่ใจหรือไม่ที่จะลบรายการชำระเงิน {formatCurrency(tx.amount)} นี้?
                        การลบจะทำให้ยอดชำระเงินถูกคำนวณใหม่อัตโนมัติ
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(tx.id)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        ลบรายการ
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
