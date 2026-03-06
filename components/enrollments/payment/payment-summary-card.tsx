'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PaymentSummaryCardProps {
  finalPrice: number;
  totalPaid: number;
  remaining: number;
  status: string;
  paymentType?: string;
}

const paymentStatusColors: Record<string, string> = {
  'pending': 'bg-yellow-100 text-yellow-700',
  'partial': 'bg-orange-100 text-orange-700',
  'paid': 'bg-green-100 text-green-700',
};

const paymentStatusLabels: Record<string, string> = {
  'pending': 'รอชำระ',
  'partial': 'ชำระบางส่วน',
  'paid': 'ชำระแล้ว',
};

const paymentTypeLabels: Record<string, string> = {
  'full': 'ชำระเต็มจำนวน',
  'deposit': 'มัดจำ',
  'installment': 'ผ่อนชำระ',
};

export default function PaymentSummaryCard({
  finalPrice,
  totalPaid,
  remaining,
  status,
  paymentType = 'full',
}: PaymentSummaryCardProps) {
  const progressPercent = finalPrice > 0 ? Math.min(100, (totalPaid / finalPrice) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            สรุปการชำระเงิน
          </div>
          <Badge className={paymentStatusColors[status] || 'bg-gray-100 text-gray-700'}>
            {paymentStatusLabels[status] || status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {paymentType !== 'full' && (
            <div className="flex justify-between text-base">
              <span className="text-gray-500">ประเภทการชำระ</span>
              <span className="font-medium">{paymentTypeLabels[paymentType] || paymentType}</span>
            </div>
          )}
          <div className="flex justify-between text-base">
            <span className="text-gray-500">ยอดที่ต้องชำระ</span>
            <span className="font-medium">{formatCurrency(finalPrice)}</span>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-gray-500">ชำระแล้ว</span>
            <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between text-base">
              <span className="text-gray-500">คงเหลือ</span>
              <span className="font-medium text-red-600">{formatCurrency(remaining)}</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="pt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  progressPercent >= 100 ? 'bg-green-500' : progressPercent > 0 ? 'bg-orange-400' : 'bg-gray-300'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1 text-right">
              {progressPercent.toFixed(0)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
