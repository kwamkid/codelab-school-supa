'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  CreditCard,
  Banknote,
  Building2,
  QrCode,
  Globe,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { SectionLoading } from '@/components/ui/loading';
import {
  getBranchPaymentSettings,
  upsertBranchPaymentSettings,
} from '@/lib/services/branch-payment-settings';
import { getBranches } from '@/lib/services/branches';
import { Branch, PaymentMethod } from '@/types/models';
import { cn } from '@/lib/utils';

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface BranchSettings {
  enabledMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  promptpayNumber: string;
  promptpayName: string;
  onlinePaymentEnabled: boolean;
}

const DEFAULT_SETTINGS: BranchSettings = {
  enabledMethods: ['cash', 'bank_transfer'],
  bankAccounts: [],
  promptpayNumber: '',
  promptpayName: '',
  onlinePaymentEnabled: false,
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'เงินสด', description: 'รับชำระด้วยเงินสด', icon: <Banknote className="h-5 w-5" /> },
  { value: 'bank_transfer', label: 'โอนเงิน', description: 'โอนเงินผ่านบัญชีธนาคาร', icon: <Building2 className="h-5 w-5" /> },
  { value: 'promptpay', label: 'PromptPay', description: 'ชำระผ่าน PromptPay', icon: <QrCode className="h-5 w-5" /> },
  { value: 'credit_card', label: 'บัตรเครดิต', description: 'รับชำระด้วยบัตรเครดิต', icon: <CreditCard className="h-5 w-5" /> },
  { value: 'online', label: 'ชำระออนไลน์ (Beam)', description: 'ชำระผ่านระบบ Beam (เตรียมโครงสร้าง)', icon: <Globe className="h-5 w-5" /> },
];

export default function PaymentSettingsComponent() {
  const { user, isSuperAdmin, adminUser } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Per-branch settings cache (lazy load)
  const [settingsCache, setSettingsCache] = useState<Record<string, BranchSettings>>({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  // Expanded sections
  const [expandedMethods, setExpandedMethods] = useState<Set<PaymentMethod>>(new Set());

  // Load branches
  useEffect(() => {
    const load = async () => {
      try {
        const allBranches = await getBranches();
        // Filter by admin's branches if not super admin
        const filtered = isSuperAdmin()
          ? allBranches
          : allBranches.filter(b => adminUser?.branchIds?.includes(b.id));
        setBranches(filtered);
        if (filtered.length > 0) {
          setActiveBranchId(filtered[0].id);
        }
      } catch (error) {
        console.error('Error loading branches:', error);
      } finally {
        setLoadingBranches(false);
      }
    };
    load();
  }, [isSuperAdmin, adminUser]);

  // Load settings when branch tab changes (lazy)
  useEffect(() => {
    if (activeBranchId && !settingsCache[activeBranchId]) {
      loadBranchSettings(activeBranchId);
    }
  }, [activeBranchId]);

  const loadBranchSettings = async (branchId: string) => {
    setLoadingSettings(true);
    try {
      const settings = await getBranchPaymentSettings(branchId);
      setSettingsCache(prev => ({
        ...prev,
        [branchId]: {
          enabledMethods: settings.enabledMethods,
          bankAccounts: settings.bankAccounts || [],
          promptpayNumber: settings.promptpayNumber || '',
          promptpayName: settings.promptpayName || '',
          onlinePaymentEnabled: settings.onlinePaymentEnabled,
        },
      }));
    } catch (error) {
      console.error('Error loading payment settings:', error);
      toast.error('ไม่สามารถโหลดการตั้งค่าได้');
      setSettingsCache(prev => ({
        ...prev,
        [branchId]: { ...DEFAULT_SETTINGS },
      }));
    } finally {
      setLoadingSettings(false);
    }
  };

  const currentSettings = settingsCache[activeBranchId] || DEFAULT_SETTINGS;

  const updateSettings = useCallback((updates: Partial<BranchSettings>) => {
    setSettingsCache(prev => ({
      ...prev,
      [activeBranchId]: { ...(prev[activeBranchId] || DEFAULT_SETTINGS), ...updates },
    }));
  }, [activeBranchId]);

  const handleMethodToggle = (method: PaymentMethod, enabled: boolean) => {
    const current = currentSettings.enabledMethods;
    if (!enabled && current.length <= 1) {
      toast.error('ต้องเปิดใช้งานอย่างน้อย 1 วิธีชำระเงิน');
      return;
    }
    const updated = enabled
      ? [...current, method]
      : current.filter(m => m !== method);
    updateSettings({ enabledMethods: updated });

    // Auto-expand when enabling
    if (enabled && hasDetails(method)) {
      setExpandedMethods(prev => new Set(prev).add(method));
    }
    // Auto-collapse when disabling
    if (!enabled) {
      setExpandedMethods(prev => {
        const next = new Set(prev);
        next.delete(method);
        return next;
      });
    }
  };

  const hasDetails = (method: PaymentMethod): boolean => {
    return ['bank_transfer', 'promptpay', 'online'].includes(method);
  };

  const toggleExpand = (method: PaymentMethod) => {
    setExpandedMethods(prev => {
      const next = new Set(prev);
      if (next.has(method)) {
        next.delete(method);
      } else {
        next.add(method);
      }
      return next;
    });
  };

  // Bank account helpers
  const addBankAccount = () => {
    updateSettings({
      bankAccounts: [...currentSettings.bankAccounts, { bankName: '', accountNumber: '', accountName: '' }],
    });
  };

  const removeBankAccount = (index: number) => {
    updateSettings({
      bankAccounts: currentSettings.bankAccounts.filter((_, i) => i !== index),
    });
  };

  const updateBankAccount = (index: number, field: keyof BankAccount, value: string) => {
    updateSettings({
      bankAccounts: currentSettings.bankAccounts.map((acc, i) =>
        i === index ? { ...acc, [field]: value } : acc
      ),
    });
  };

  const handleSave = async () => {
    if (!activeBranchId) return;

    const s = currentSettings;

    // Validate bank accounts
    if (s.enabledMethods.includes('bank_transfer') && s.bankAccounts.length > 0) {
      const hasInvalid = s.bankAccounts.some(
        acc => !acc.bankName.trim() || !acc.accountNumber.trim() || !acc.accountName.trim()
      );
      if (hasInvalid) {
        toast.error('กรุณากรอกข้อมูลบัญชีธนาคารให้ครบ');
        return;
      }
    }

    if (s.enabledMethods.includes('promptpay') && !s.promptpayNumber.trim()) {
      toast.error('กรุณากรอกหมายเลข PromptPay');
      return;
    }

    setSaving(true);
    try {
      await upsertBranchPaymentSettings(
        activeBranchId,
        {
          enabledMethods: s.enabledMethods,
          bankAccounts: s.bankAccounts,
          promptpayNumber: s.promptpayNumber.trim() || undefined,
          promptpayName: s.promptpayName.trim() || undefined,
          onlinePaymentEnabled: s.onlinePaymentEnabled,
        },
        user?.uid
      );
      toast.success('บันทึกการตั้งค่าเรียบร้อย');
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  if (loadingBranches) {
    return <SectionLoading text="กำลังโหลด..." />;
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-base">
        ไม่พบสาขา
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branch Tabs */}
      {branches.length > 1 && (
        <div className="border-b">
          <div className="flex gap-0 overflow-x-auto">
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => setActiveBranchId(branch.id)}
                className={cn(
                  'px-5 py-3 text-base font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeBranchId === branch.id
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings content */}
      {loadingSettings ? (
        <SectionLoading text="กำลังโหลดการตั้งค่า..." />
      ) : (
        <>
          {/* Payment methods - each with toggle + collapsible details */}
          <div className="space-y-3">
            {PAYMENT_METHODS.map(method => {
              const isEnabled = currentSettings.enabledMethods.includes(method.value);
              const showDetails = hasDetails(method.value);
              const isExpanded = expandedMethods.has(method.value);

              return (
                <Card key={method.value} className={cn(
                  'transition-all',
                  isEnabled ? 'border-gray-200' : 'border-gray-100 bg-gray-50/50'
                )}>
                  <CardContent className="p-0">
                    {/* Header row: toggle + label + expand button */}
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3 flex-1">
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => handleMethodToggle(method.value, checked)}
                        />
                        <div className={cn(
                          'flex items-center gap-2',
                          !isEnabled && 'opacity-50'
                        )}>
                          {method.icon}
                          <div>
                            <p className="text-base font-medium">{method.label}</p>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </div>
                        </div>
                      </div>

                      {showDetails && isEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(method.value)}
                          className="text-gray-500"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Expandable details */}
                    {isEnabled && isExpanded && (
                      <div className="px-5 pb-5 pt-0 border-t">
                        {/* Bank Transfer details */}
                        {method.value === 'bank_transfer' && (
                          <div className="pt-4 space-y-4">
                            {currentSettings.bankAccounts.map((account, index) => (
                              <div key={index} className="p-4 bg-gray-50 rounded-lg space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-base font-medium">บัญชีที่ {index + 1}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeBankAccount(index)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-base">ชื่อธนาคาร</Label>
                                    <Input
                                      value={account.bankName}
                                      onChange={e => updateBankAccount(index, 'bankName', e.target.value)}
                                      placeholder="เช่น กสิกรไทย"
                                      className="text-base"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-base">เลขบัญชี</Label>
                                    <Input
                                      value={account.accountNumber}
                                      onChange={e => updateBankAccount(index, 'accountNumber', e.target.value)}
                                      placeholder="xxx-x-xxxxx-x"
                                      className="text-base"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-base">ชื่อบัญชี</Label>
                                    <Input
                                      value={account.accountName}
                                      onChange={e => updateBankAccount(index, 'accountName', e.target.value)}
                                      placeholder="ชื่อเจ้าของบัญชี"
                                      className="text-base"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                            <Button variant="outline" onClick={addBankAccount} className="text-base">
                              <Plus className="h-4 w-4 mr-2" />
                              เพิ่มบัญชีธนาคาร
                            </Button>
                          </div>
                        )}

                        {/* PromptPay details */}
                        {method.value === 'promptpay' && (
                          <div className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-base">หมายเลข PromptPay</Label>
                                <Input
                                  value={currentSettings.promptpayNumber}
                                  onChange={e => updateSettings({ promptpayNumber: e.target.value })}
                                  placeholder="เบอร์โทรหรือเลขบัตรประชาชน"
                                  className="text-base"
                                />
                              </div>
                              <div>
                                <Label className="text-base">ชื่อ PromptPay</Label>
                                <Input
                                  value={currentSettings.promptpayName}
                                  onChange={e => updateSettings({ promptpayName: e.target.value })}
                                  placeholder="ชื่อเจ้าของบัญชี PromptPay"
                                  className="text-base"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Online (Beam) details */}
                        {method.value === 'online' && (
                          <div className="pt-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-base text-amber-700">
                                ระบบชำระเงินออนไลน์ผ่าน Beam กำลังอยู่ในขั้นตอนพัฒนา จะเปิดใช้งานได้เร็วๆ นี้
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-red-500 hover:bg-red-600 text-base"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  บันทึกการตั้งค่า
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
