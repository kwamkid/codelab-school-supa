import { Branch } from '@/types/models';
import { getClient } from '@/lib/supabase/client';
import { adminMutation } from '@/lib/admin-mutation';

const TABLE_NAME = 'branches';

// Get all branches
export async function getBranches(): Promise<Branch[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      address: item.address,
      phone: item.phone,
      email: item.email,
      openTime: item.open_time || '09:00',
      closeTime: item.close_time || '18:00',
      openDays: item.open_days || [],
      managerName: item.manager_name,
      managerPhone: item.manager_phone,
      invoiceCompanyId: item.invoice_company_id || undefined,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
    }));
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
}

// Get active branches only
export async function getActiveBranches(): Promise<Branch[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error getting active branches:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      address: item.address,
      phone: item.phone,
      email: item.email,
      openTime: item.open_time || '09:00',
      closeTime: item.close_time || '18:00',
      openDays: item.open_days || [],
      managerName: item.manager_name,
      managerPhone: item.manager_phone,
      invoiceCompanyId: item.invoice_company_id || undefined,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
    }));
  } catch (error) {
    console.error('Error getting active branches:', error);
    return [];
  }
}

// Get single branch
export async function getBranch(id: string): Promise<Branch | null> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      address: data.address,
      phone: data.phone,
      email: data.email,
      openTime: data.open_time || '09:00',
      closeTime: data.close_time || '18:00',
      openDays: data.open_days || [],
      managerName: data.manager_name,
      managerPhone: data.manager_phone,
      invoiceCompanyId: data.invoice_company_id || undefined,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
    };
  } catch (error) {
    console.error('Error getting branch:', error);
    throw error;
  }
}

// Create new branch
export async function createBranch(branchData: Omit<Branch, 'id' | 'createdAt'>): Promise<string> {
  try {
    const result = await adminMutation({
      table: 'branches',
      operation: 'insert',
      data: {
        code: branchData.code,
        name: branchData.name,
        address: branchData.address,
        phone: branchData.phone,
        email: branchData.email,
        is_active: branchData.isActive,
        invoice_company_id: branchData.invoiceCompanyId || null,
      },
      options: { select: true, single: true }
    });

    if (!result) throw new Error('No data returned from insert');
    return result.id;
  } catch (error) {
    console.error('Error creating branch:', error);
    throw error;
  }
}

// Update branch
export async function updateBranch(id: string, branchData: Partial<Branch>): Promise<void> {
  try {
    const updateData: any = {};
    if (branchData.code !== undefined) updateData.code = branchData.code;
    if (branchData.name !== undefined) updateData.name = branchData.name;
    if (branchData.address !== undefined) updateData.address = branchData.address;
    if (branchData.phone !== undefined) updateData.phone = branchData.phone;
    if (branchData.email !== undefined) updateData.email = branchData.email;
    if (branchData.isActive !== undefined) updateData.is_active = branchData.isActive;
    if (branchData.invoiceCompanyId !== undefined) updateData.invoice_company_id = branchData.invoiceCompanyId || null;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await adminMutation({
      table: 'branches',
      operation: 'update',
      data: updateData,
      match: { id }
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    throw error;
  }
}

// Toggle branch active status
export async function toggleBranchStatus(id: string, isActive: boolean): Promise<void> {
  try {
    await adminMutation({
      table: 'branches',
      operation: 'update',
      data: { is_active: isActive },
      match: { id }
    });
  } catch (error) {
    console.error('Error toggling branch status:', error);
    throw error;
  }
}

// Check if branch code already exists
export async function checkBranchCodeExists(
  code: string,
  excludeId?: string
): Promise<boolean> {
  try {
    const supabase = getClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('code', code);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).length > 0;
  } catch (error) {
    console.error('Error checking branch code:', error);
    throw error;
  }
}

// Get branches by IDs
export async function getBranchesByIds(ids: string[]): Promise<Branch[]> {
  try {
    if (ids.length === 0) return [];

    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .in('id', ids);

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      address: item.address,
      phone: item.phone,
      email: item.email,
      openTime: item.open_time || '09:00',
      closeTime: item.close_time || '18:00',
      openDays: item.open_days || [],
      managerName: item.manager_name,
      managerPhone: item.manager_phone,
      invoiceCompanyId: item.invoice_company_id || undefined,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
    }));
  } catch (error) {
    console.error('Error getting branches by IDs:', error);
    throw error;
  }
}
