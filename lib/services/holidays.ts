import { Holiday } from '@/types/models';
import { getClient } from '@/lib/supabase/client';

const TABLE_NAME = 'holidays';

// Get holidays for a specific year
export async function getHolidays(year: number): Promise<Holiday[]> {
  try {
    const supabase = getClient();

    // Calculate date range for the year
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      date: new Date(item.date),
      type: item.type || 'national',
      branches: item.branches || [],
      description: item.description || '',
    }));
  } catch (error) {
    console.error('Error getting holidays:', error);
    return [];
  }
}

// Get all holidays without date filter
export async function getAllHolidays(): Promise<Holiday[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      date: new Date(item.date),
      type: item.type || 'national',
      branches: item.branches || [],
      description: item.description || '',
    }));
  } catch (error) {
    console.error('Error getting all holidays:', error);
    throw error;
  }
}

// Get holidays for a specific branch and date range
export async function getHolidaysForBranch(
  branchId: string,
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  try {
    const holidays = await getHolidaysInRange(startDate, endDate);

    // Filter holidays that apply to this branch
    return holidays.filter(holiday => {
      // National holidays apply to all branches
      if (holiday.type === 'national') return true;

      // Branch-specific holidays
      return holiday.branches?.includes(branchId);
    });
  } catch (error) {
    console.error('Error getting branch holidays:', error);
    throw error;
  }
}

// Get holidays by branch
export async function getHolidaysByBranch(branchId: string | null): Promise<Holiday[]> {
  try {
    const currentYear = new Date().getFullYear();
    const allHolidays = await getHolidays(currentYear);

    if (!branchId) {
      // Return all holidays if no branch specified (super admin)
      return allHolidays;
    }

    // Filter holidays that apply to this branch
    return allHolidays.filter(holiday => {
      // National holidays apply to all branches
      if (holiday.type === 'national') return true;

      // Branch-specific holidays
      return holiday.branches?.includes(branchId);
    });
  } catch (error) {
    console.error('Error getting holidays by branch:', error);
    return [];
  }
}

// Get holidays in date range
export async function getHolidaysInRange(
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      date: new Date(item.date),
      type: item.type || 'national',
      branches: item.branches || [],
      description: item.description || '',
    }));
  } catch (error) {
    console.error('Error getting holidays in range:', error);
    throw error;
  }
}

// Add new holiday
export async function addHoliday(
  holidayData: Omit<Holiday, 'id'>
): Promise<{ id: string }> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        name: holidayData.name,
        date: holidayData.date.toISOString().split('T')[0],
        type: holidayData.type,
        branches: holidayData.branches || [],
        description: holidayData.description || '',
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned from insert');

    return { id: data.id };
  } catch (error) {
    console.error('Error adding holiday:', error);
    throw error;
  }
}

// Update holiday
export async function updateHoliday(
  id: string,
  holidayData: Partial<Holiday>
): Promise<void> {
  try {
    const supabase = getClient();

    const updateData: any = {};

    if (holidayData.name !== undefined) updateData.name = holidayData.name;
    if (holidayData.date !== undefined) updateData.date = holidayData.date.toISOString().split('T')[0];
    if (holidayData.type !== undefined) updateData.type = holidayData.type;
    if (holidayData.branches !== undefined) updateData.branches = holidayData.branches;
    if (holidayData.description !== undefined) updateData.description = holidayData.description;

    if (Object.keys(updateData).length === 0) {
      return;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating holiday:', error);
    throw error;
  }
}

// Delete holiday
export async function deleteHoliday(id: string): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting holiday:', error);
    throw error;
  }
}

// Delete all holidays for a specific year
export async function deleteAllHolidays(year: number): Promise<number> {
  try {
    const supabase = getClient();

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .gte('date', startDate)
      .lte('date', endDate)
      .select();

    if (error) throw error;

    return (data || []).length;
  } catch (error) {
    console.error('Error deleting all holidays:', error);
    throw error;
  }
}

// Check if holiday exists
export async function checkHolidayExists(
  date: Date,
  name?: string,
  branchId?: string,
  excludeId?: string
): Promise<boolean> {
  try {
    const supabase = getClient();
    const dateStr = date.toISOString().split('T')[0];

    let query = supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('date', dateStr);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter results
    const holidays = (data || []).filter(holiday => {
      // If name is provided, check for exact name match
      if (name && holiday.name === name) return true;

      // Check if it's the same branch or national holiday
      if (!branchId) {
        return true;
      }

      if (holiday.type === 'national') return true;
      if (holiday.branches?.includes(branchId)) return true;

      return false;
    });

    return holidays.length > 0;
  } catch (error) {
    console.error('Error checking holiday exists:', error);
    return false;
  }
}

// Check if a specific date is a holiday for a branch
export async function isHoliday(
  date: Date,
  branchId: string
): Promise<boolean> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const holidays = await getHolidaysForBranch(branchId, startOfDay, endOfDay);

    return holidays.length > 0;
  } catch (error) {
    console.error('Error checking if date is holiday:', error);
    return false;
  }
}

// Get holidays for calendar view
export async function getHolidaysForCalendar(
  year: number,
  month: number,
  branchId?: string
): Promise<Holiday[]> {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);

    if (branchId) {
      return getHolidaysForBranch(branchId, startDate, endDate);
    }

    return getHolidaysInRange(startDate, endDate);
  } catch (error) {
    console.error('Error getting holidays for calendar:', error);
    return [];
  }
}
