// lib/services/branch-payment-settings.ts

import { BranchPaymentSettings, PaymentMethod } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

interface BranchPaymentSettingsRow {
  id: string;
  branch_id: string;
  enabled_methods: string[];
  bank_accounts: any;
  promptpay_number: string | null;
  promptpay_name: string | null;
  online_payment_enabled: boolean;
  online_payment_provider: string | null;
  online_payment_config: any;
  updated_at: string;
  updated_by: string | null;
}

function mapToSettings(row: BranchPaymentSettingsRow): BranchPaymentSettings {
  return {
    id: row.id,
    branchId: row.branch_id,
    enabledMethods: (row.enabled_methods || ['cash', 'bank_transfer']) as PaymentMethod[],
    bankAccounts: row.bank_accounts || [],
    promptpayNumber: row.promptpay_number || undefined,
    promptpayName: row.promptpay_name || undefined,
    onlinePaymentEnabled: row.online_payment_enabled,
    onlinePaymentProvider: row.online_payment_provider || undefined,
    onlinePaymentConfig: row.online_payment_config || undefined,
  };
}

export function getDefaultBranchPaymentSettings(branchId: string): BranchPaymentSettings {
  return {
    id: '',
    branchId,
    enabledMethods: ['cash', 'bank_transfer'],
    bankAccounts: [],
    onlinePaymentEnabled: false,
  };
}

// Get payment settings for a branch (via API route with service role)
export async function getBranchPaymentSettings(branchId: string): Promise<BranchPaymentSettings> {
  try {
    const res = await fetch(`/api/admin/branch-payment-settings?branchId=${branchId}`);
    if (!res.ok) throw new Error('Failed to fetch payment settings');
    const data = await res.json();
    return {
      id: data.id || '',
      branchId: data.branchId || branchId,
      enabledMethods: (data.enabledMethods || ['cash', 'bank_transfer']) as PaymentMethod[],
      bankAccounts: data.bankAccounts || [],
      promptpayNumber: data.promptpayNumber || undefined,
      promptpayName: data.promptpayName || undefined,
      onlinePaymentEnabled: data.onlinePaymentEnabled || false,
      onlinePaymentProvider: data.onlinePaymentProvider || undefined,
      onlinePaymentConfig: data.onlinePaymentConfig || undefined,
    };
  } catch (error) {
    console.error('Error getting branch payment settings:', error);
    return getDefaultBranchPaymentSettings(branchId);
  }
}

// Create or update payment settings for a branch
export async function upsertBranchPaymentSettings(
  branchId: string,
  data: Partial<BranchPaymentSettings>,
  userId?: string
): Promise<void> {
  try {
    const upsertData: any = {
      branch_id: branchId,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    };

    if (data.enabledMethods !== undefined) upsertData.enabled_methods = data.enabledMethods;
    if (data.bankAccounts !== undefined) upsertData.bank_accounts = data.bankAccounts;
    if (data.promptpayNumber !== undefined) upsertData.promptpay_number = data.promptpayNumber || null;
    if (data.promptpayName !== undefined) upsertData.promptpay_name = data.promptpayName || null;
    if (data.onlinePaymentEnabled !== undefined) upsertData.online_payment_enabled = data.onlinePaymentEnabled;
    if (data.onlinePaymentProvider !== undefined) upsertData.online_payment_provider = data.onlinePaymentProvider || null;
    if (data.onlinePaymentConfig !== undefined) upsertData.online_payment_config = data.onlinePaymentConfig || {};

    await adminMutation({
      table: 'branch_payment_settings',
      operation: 'upsert',
      data: upsertData,
      options: { onConflict: 'branch_id' },
    });
  } catch (error) {
    console.error('Error upserting branch payment settings:', error);
    throw error;
  }
}

// Get enabled payment methods for a branch (convenience function)
export async function getEnabledPaymentMethods(branchId: string): Promise<PaymentMethod[]> {
  const settings = await getBranchPaymentSettings(branchId);
  return settings.enabledMethods;
}
