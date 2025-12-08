// lib/services/line-settings.ts

import { getClient } from '@/lib/supabase/client';

// Types
export interface LineSettings {
  // LINE Login Channel
  loginChannelId?: string;
  loginChannelSecret?: string;

  // LINE Messaging API
  messagingChannelId?: string;
  messagingChannelSecret?: string;
  messagingChannelAccessToken?: string;

  // LIFF Settings
  liffId?: string;
  liffChannelId?: string;

  // Webhook
  webhookUrl?: string;
  webhookVerified: boolean;

  // Rich Menu
  richMenuId?: string;
  richMenuEnabled: boolean;

  // Settings - เหลือแค่เปิด/ปิด
  enableNotifications: boolean;

  // Metadata
  updatedAt?: Date;
  updatedBy?: string;
}

// Rich Menu Template
export interface RichMenuTemplate {
  id: string;
  name: string;
  description: string;
  areas: {
    bounds: { x: number; y: number; width: number; height: number };
    action: {
      type: 'uri' | 'message' | 'postback';
      label: string;
      data?: string;
      uri?: string;
      text?: string;
    };
  }[];
}

// Database row interface for settings table
interface SettingsRow {
  id: string;
  key: string;
  value: any; // JSONB
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

const SETTINGS_KEY = 'line';

// Get LINE settings
export async function getLineSettings(): Promise<LineSettings> {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', SETTINGS_KEY)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found, return default settings
        return getDefaultLineSettings();
      }
      throw error;
    }

    if (data && data.value) {
      // Map JSONB value to LineSettings
      const settings: LineSettings = {
        loginChannelId: data.value.loginChannelId,
        loginChannelSecret: data.value.loginChannelSecret,
        messagingChannelId: data.value.messagingChannelId,
        messagingChannelSecret: data.value.messagingChannelSecret,
        messagingChannelAccessToken: data.value.messagingChannelAccessToken,
        liffId: data.value.liffId,
        liffChannelId: data.value.liffChannelId,
        webhookUrl: data.value.webhookUrl,
        webhookVerified: data.value.webhookVerified ?? false,
        richMenuId: data.value.richMenuId,
        richMenuEnabled: data.value.richMenuEnabled ?? false,
        enableNotifications: data.value.enableNotifications ?? true,
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
        updatedBy: data.updated_by || undefined
      };
      return settings;
    }

    return getDefaultLineSettings();
  } catch (error) {
    console.error('Error getting LINE settings:', error);
    return getDefaultLineSettings();
  }
}

// Update LINE settings
export async function updateLineSettings(
  settings: Partial<LineSettings>,
  userId: string
): Promise<void> {
  try {
    const supabase = getClient();

    // First, get current settings to merge with new values
    const currentSettings = await getLineSettings();

    // Merge current with new settings
    const mergedSettings = {
      ...currentSettings,
      ...settings
    };

    // Remove metadata fields from value object
    const { updatedAt, updatedBy, ...valueObject } = mergedSettings;

    const now = new Date().toISOString();

    // Check if record exists
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('key', SETTINGS_KEY)
      .single();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('settings')
        .update({
          value: valueObject,
          updated_at: now,
          updated_by: userId
        })
        .eq('key', SETTINGS_KEY);

      if (error) throw error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('settings')
        .insert({
          key: SETTINGS_KEY,
          value: valueObject,
          description: 'LINE Integration Settings',
          updated_at: now,
          updated_by: userId
        });

      if (error) throw error;
    }

  } catch (error) {
    console.error('Error updating LINE settings:', error);
    throw error;
  }
}

// Get default settings
export function getDefaultLineSettings(): LineSettings {
  return {
    webhookVerified: false,
    richMenuEnabled: false,
    enableNotifications: true
  };
}

// Validate LINE settings
export function validateLineSettings(settings: Partial<LineSettings>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Validate Channel IDs (numeric only)
  if (settings.loginChannelId && !/^\d+$/.test(settings.loginChannelId)) {
    errors.loginChannelId = 'Channel ID ต้องเป็นตัวเลขเท่านั้น';
  }

  if (settings.messagingChannelId && !/^\d+$/.test(settings.messagingChannelId)) {
    errors.messagingChannelId = 'Channel ID ต้องเป็นตัวเลขเท่านั้น';
  }

  // Validate Channel Secret (32 characters)
  if (settings.loginChannelSecret && settings.loginChannelSecret.length !== 32) {
    errors.loginChannelSecret = 'Channel Secret ต้องมี 32 ตัวอักษร';
  }

  if (settings.messagingChannelSecret && settings.messagingChannelSecret.length !== 32) {
    errors.messagingChannelSecret = 'Channel Secret ต้องมี 32 ตัวอักษร';
  }

  // Validate Access Token format
  if (settings.messagingChannelAccessToken && settings.messagingChannelAccessToken.length < 100) {
    errors.messagingChannelAccessToken = 'Access Token ไม่ถูกต้อง';
  }

  // Validate LIFF ID format
  if (settings.liffId && !/^\d{10}-\w{8}$/.test(settings.liffId)) {
    errors.liffId = 'LIFF ID ไม่ถูกต้อง (รูปแบบ: 1234567890-abcdefgh)';
  }

  // Validate Webhook URL
  if (settings.webhookUrl && !settings.webhookUrl.startsWith('https://')) {
    errors.webhookUrl = 'Webhook URL ต้องเริ่มต้นด้วย https://';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Get Rich Menu templates
export function getRichMenuTemplates(): RichMenuTemplate[] {
  return [
    {
      id: 'default',
      name: 'เมนูหลัก',
      description: 'Rich Menu พื้นฐานสำหรับผู้ปกครอง',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 833, height: 843 },
          action: {
            type: 'uri',
            label: 'ตารางเรียน',
            uri: 'https://liff.line.me/{liffId}/schedule'
          }
        },
        {
          bounds: { x: 833, y: 0, width: 834, height: 843 },
          action: {
            type: 'uri',
            label: 'จองทดลอง',
            uri: 'https://liff.line.me/{liffId}/trial'
          }
        },
        {
          bounds: { x: 1667, y: 0, width: 833, height: 843 },
          action: {
            type: 'uri',
            label: 'ชำระเงิน',
            uri: 'https://liff.line.me/{liffId}/payment'
          }
        },
        {
          bounds: { x: 0, y: 843, width: 833, height: 843 },
          action: {
            type: 'uri',
            label: 'โปรไฟล์',
            uri: 'https://liff.line.me/{liffId}/profile'
          }
        },
        {
          bounds: { x: 833, y: 843, width: 834, height: 843 },
          action: {
            type: 'uri',
            label: 'Makeup Class',
            uri: 'https://liff.line.me/{liffId}/makeup'
          }
        },
        {
          bounds: { x: 1667, y: 843, width: 833, height: 843 },
          action: {
            type: 'message',
            label: 'ติดต่อเรา',
            text: 'ติดต่อสอบถาม'
          }
        }
      ]
    }
  ];
}

// Test LINE Channel (Client-side version without SDK)
export async function testLineChannel(
  channelId: string,
  channelSecret: string,
  accessToken?: string
): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    if (!channelId || !channelSecret) {
      return {
        success: false,
        message: 'กรุณากรอก Channel ID และ Channel Secret'
      };
    }

    if (!/^\d+$/.test(channelId)) {
      return {
        success: false,
        message: 'Channel ID ต้องเป็นตัวเลขเท่านั้น'
      };
    }

    if (channelSecret.length !== 32) {
      return {
        success: false,
        message: 'Channel Secret ต้องมี 32 ตัวอักษร'
      };
    }

    // For Messaging API test
    if (accessToken) {
      // Call API route to test on server-side
      const response = await fetch('/api/line/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'messaging',
          accessToken
        })
      });

      const result = await response.json();
      return result;
    }

    // For LINE Login test
    const response = await fetch('/api/line/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'login',
        channelId,
        channelSecret
      })
    });

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error testing LINE channel:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการทดสอบ',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Generate Webhook URL
export function generateWebhookUrl(baseUrl: string): string {
  if (!baseUrl) return '';

  // Remove trailing slash
  const cleanUrl = baseUrl.replace(/\/$/, '');

  // Add webhook endpoint
  return `${cleanUrl}/api/webhooks/line`;
}
