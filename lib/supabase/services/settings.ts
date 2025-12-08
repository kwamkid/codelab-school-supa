import { createServiceClient } from '../server'

// ============================================
// TYPES
// ============================================

export interface GeneralSettings {
  // School info
  school_name: string
  school_name_en?: string
  logo_url?: string

  // Address
  address: {
    house_number: string
    street?: string
    sub_district: string
    district: string
    province: string
    postal_code: string
    country: string
  }

  // Contact
  contact_phone: string
  contact_email: string
  line_official_id?: string
  line_official_url?: string
  facebook?: string
  website?: string

  // Metadata
  updated_at?: string
  updated_by?: string
}

export interface MakeupSettings {
  // Auto create makeup
  auto_create_makeup: boolean
  makeup_limit_per_course: number // 0 = unlimited

  // Rules
  allow_makeup_for_statuses: ('absent' | 'sick' | 'leave')[]
  makeup_request_deadline_days: number
  makeup_validity_days: number

  // Notifications
  send_line_notification: boolean
  notify_parent_on_auto_create: boolean

  // Metadata
  updated_at?: string
  updated_by?: string
}

export interface LineSettings {
  channel_access_token?: string
  channel_secret?: string
  liff_id?: string
  webhook_url?: string

  // Features
  enable_notifications: boolean
  enable_rich_menu: boolean

  // Metadata
  updated_at?: string
  updated_by?: string
}

// ============================================
// GENERAL SETTINGS
// ============================================

// Get general settings
export async function getGeneralSettings(): Promise<GeneralSettings | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'general')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return getDefaultSettings()
    console.error('Error getting general settings:', error)
    return getDefaultSettings()
  }

  return data?.value as GeneralSettings || getDefaultSettings()
}

// Update general settings
export async function updateGeneralSettings(
  settings: Partial<GeneralSettings>,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  const currentSettings = await getGeneralSettings()
  const updatedSettings = {
    ...currentSettings,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: userId
  }

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'general',
      value: updatedSettings,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error updating general settings:', error)
    throw error
  }
}

// Get default settings
export function getDefaultSettings(): GeneralSettings {
  return {
    school_name: 'CodeLab School',
    school_name_en: 'CodeLab School',
    address: {
      house_number: '',
      street: '',
      sub_district: '',
      district: '',
      province: 'กรุงเทพมหานคร',
      postal_code: '',
      country: 'ประเทศไทย'
    },
    contact_phone: '',
    contact_email: ''
  }
}

// Validate settings
export function validateSettings(settings: Partial<GeneralSettings>): {
  isValid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  // Validate school name
  if (settings.school_name !== undefined) {
    if (!settings.school_name.trim()) {
      errors.school_name = 'กรุณาระบุชื่อโรงเรียน'
    }
  }

  // Validate contact phone
  if (settings.contact_phone !== undefined) {
    if (!settings.contact_phone.trim()) {
      errors.contact_phone = 'กรุณาระบุเบอร์โทรติดต่อ'
    } else if (!/^[0-9-]+$/.test(settings.contact_phone.replace(/\s/g, ''))) {
      errors.contact_phone = 'เบอร์โทรไม่ถูกต้อง'
    }
  }

  // Validate email
  if (settings.contact_email !== undefined) {
    if (!settings.contact_email.trim()) {
      errors.contact_email = 'กรุณาระบุอีเมล'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact_email)) {
      errors.contact_email = 'อีเมลไม่ถูกต้อง'
    }
  }

  // Validate address
  if (settings.address) {
    if (!settings.address.province) {
      errors.province = 'กรุณาระบุจังหวัด'
    }
    if (!settings.address.district) {
      errors.district = 'กรุณาระบุเขต/อำเภอ'
    }
    if (!settings.address.sub_district) {
      errors.sub_district = 'กรุณาระบุแขวง/ตำบล'
    }
  }

  // Validate logo URL if provided
  if (settings.logo_url && settings.logo_url.trim()) {
    try {
      new URL(settings.logo_url)
    } catch {
      errors.logo_url = 'URL ของ logo ไม่ถูกต้อง'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

// ============================================
// MAKEUP SETTINGS
// ============================================

// Get makeup settings
export async function getMakeupSettings(): Promise<MakeupSettings> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'makeup')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return getDefaultMakeupSettings()
    console.error('Error getting makeup settings:', error)
    return getDefaultMakeupSettings()
  }

  return data?.value as MakeupSettings || getDefaultMakeupSettings()
}

// Update makeup settings
export async function updateMakeupSettings(
  settings: Partial<MakeupSettings>,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  const currentSettings = await getMakeupSettings()
  const updatedSettings = {
    ...currentSettings,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: userId
  }

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'makeup',
      value: updatedSettings,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error updating makeup settings:', error)
    throw error
  }
}

// Get default makeup settings
export function getDefaultMakeupSettings(): MakeupSettings {
  return {
    auto_create_makeup: true,
    makeup_limit_per_course: 4,
    allow_makeup_for_statuses: ['absent', 'sick', 'leave'],
    makeup_request_deadline_days: 7,
    makeup_validity_days: 30,
    send_line_notification: true,
    notify_parent_on_auto_create: true
  }
}

// ============================================
// LINE SETTINGS
// ============================================

// Get LINE settings
export async function getLineSettings(): Promise<LineSettings> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'line')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return getDefaultLineSettings()
    console.error('Error getting LINE settings:', error)
    return getDefaultLineSettings()
  }

  return data?.value as LineSettings || getDefaultLineSettings()
}

// Update LINE settings
export async function updateLineSettings(
  settings: Partial<LineSettings>,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()

  const currentSettings = await getLineSettings()
  const updatedSettings = {
    ...currentSettings,
    ...settings,
    updated_at: new Date().toISOString(),
    updated_by: userId
  }

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'line',
      value: updatedSettings,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error updating LINE settings:', error)
    throw error
  }
}

// Get default LINE settings
export function getDefaultLineSettings(): LineSettings {
  return {
    enable_notifications: true,
    enable_rich_menu: false
  }
}

// ============================================
// GENERIC SETTINGS
// ============================================

// Get any settings by key
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) {
    return defaultValue
  }

  return data.value as T
}

// Set any settings by key
export async function setSetting<T>(
  key: string,
  value: T,
  userId?: string
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: userId || null
    })

  if (error) {
    console.error(`Error setting ${key}:`, error)
    throw error
  }
}

// Delete settings by key
export async function deleteSetting(key: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('settings')
    .delete()
    .eq('key', key)

  if (error) {
    console.error(`Error deleting ${key}:`, error)
    throw error
  }
}

// Get all settings
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('settings')
    .select('key, value')

  if (error) {
    console.error('Error getting all settings:', error)
    return {}
  }

  const settings: Record<string, unknown> = {}
  for (const row of data || []) {
    settings[row.key] = row.value
  }

  return settings
}
