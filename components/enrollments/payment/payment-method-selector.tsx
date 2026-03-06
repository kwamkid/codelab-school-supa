'use client';

import { Banknote, CreditCard, QrCode, Smartphone, Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PaymentMethod, BranchPaymentSettings } from '@/types/models';

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  cash: { label: 'เงินสด', icon: Banknote },
  bank_transfer: { label: 'โอนเงิน', icon: Smartphone },
  promptpay: { label: 'PromptPay', icon: QrCode },
  credit_card: { label: 'บัตรเครดิต', icon: CreditCard },
  online: { label: 'ออนไลน์', icon: Globe },
};

type ColorScheme = 'red' | 'green';

const COLOR_MAP: Record<ColorScheme, {
  activeBtn: string;
  hoverBtn: string;
  label: string;
  infoBorder: string;
  infoBg: string;
  infoLabel: string;
  radioActive: string;
  radioDot: string;
  selectedAccount: string;
  hoverAccount: string;
}> = {
  red: {
    activeBtn: 'border-red-500 bg-red-600 text-white shadow-md',
    hoverBtn: 'border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50',
    label: 'text-red-700',
    infoBorder: 'border-red-200',
    infoBg: 'bg-red-50/50',
    infoLabel: 'text-red-700',
    radioActive: 'border-red-500',
    radioDot: 'bg-red-500',
    selectedAccount: 'bg-red-100 border-2 border-red-400 shadow-sm',
    hoverAccount: 'bg-gray-50 border-2 border-transparent hover:border-red-200 hover:bg-red-50/30',
  },
  green: {
    activeBtn: 'border-green-500 bg-green-600 text-white shadow-md',
    hoverBtn: 'border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50',
    label: 'text-gray-700',
    infoBorder: 'border-gray-200',
    infoBg: 'bg-gray-50',
    infoLabel: 'text-gray-600',
    radioActive: 'border-green-500',
    radioDot: 'bg-green-500',
    selectedAccount: 'bg-green-100 border-2 border-green-400 shadow-sm',
    hoverAccount: 'bg-gray-50 border-2 border-transparent hover:border-green-200 hover:bg-green-50/30',
  },
};

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  paymentSettings: BranchPaymentSettings;
  colorScheme?: ColorScheme;
  /** Grid columns class, e.g. "grid-cols-3" or "grid-cols-3 sm:grid-cols-5" */
  gridCols?: string;
  /** Selected bank account index (for multi-account display) */
  selectedBankIndex?: number;
  onBankIndexChange?: (index: number) => void;
  /** Label text above the method grid */
  label?: string;
}

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  paymentSettings,
  colorScheme = 'green',
  gridCols = 'grid-cols-3',
  selectedBankIndex = 0,
  onBankIndexChange,
  label = 'วิธีชำระเงิน',
}: PaymentMethodSelectorProps) {
  const enabledMethods = paymentSettings.enabledMethods || ['cash', 'bank_transfer'];
  const colors = COLOR_MAP[colorScheme];

  return (
    <div className="space-y-3">
      {/* Payment method card buttons */}
      <div>
        <Label className={`text-base font-medium mb-2 block ${colors.label}`}>{label}</Label>
        <div className={`grid ${gridCols} gap-2`}>
          {enabledMethods.map(m => {
            const config = METHOD_CONFIG[m];
            const Icon = config?.icon || Banknote;
            const isActive = selectedMethod === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onMethodChange(m)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-base font-medium ${
                  isActive ? colors.activeBtn : colors.hoverBtn
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm">{config?.label || m}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bank account display */}
      {selectedMethod === 'bank_transfer' && paymentSettings.bankAccounts && paymentSettings.bankAccounts.length > 0 && (
        <div className={`bg-white border ${colors.infoBorder} rounded-lg p-3 space-y-2`}>
          <p className={`text-sm font-medium ${colors.infoLabel}`}>
            {paymentSettings.bankAccounts.length > 1 ? 'เลือกบัญชีรับโอน' : 'บัญชีรับโอน'}
          </p>
          {paymentSettings.bankAccounts.map((acc, i) => {
            const isSelected = selectedBankIndex === i;
            const isSingle = paymentSettings.bankAccounts.length === 1;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onBankIndexChange?.(i)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                  isSingle
                    ? colors.infoBg
                    : isSelected
                    ? colors.selectedAccount
                    : colors.hoverAccount
                }`}
              >
                {!isSingle && (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected ? colors.radioActive : 'border-gray-300'
                  }`}>
                    {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${colors.radioDot}`} />}
                  </div>
                )}
                <div className="text-base">
                  <p className="font-medium">{acc.bankName}</p>
                  <p className="text-gray-600">{acc.accountNumber}</p>
                  <p className="text-sm text-gray-500">{acc.accountName}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* PromptPay display */}
      {selectedMethod === 'promptpay' && paymentSettings.promptpayNumber && (
        <div className={`bg-white border ${colors.infoBorder} rounded-lg p-3`}>
          <p className={`text-sm font-medium ${colors.infoLabel}`}>PromptPay</p>
          <div className={`p-2 ${colors.infoBg} rounded mt-1`}>
            <p className="text-base font-medium">{paymentSettings.promptpayNumber}</p>
            {paymentSettings.promptpayName && (
              <p className="text-sm text-gray-500">{paymentSettings.promptpayName}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
