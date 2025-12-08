// lib/supabase/services/link-tokens.ts

import { createServiceClient } from '../server'

export interface LinkToken {
  id: string
  token: string
  parentId: string
  createdAt: Date
  expiresAt: Date
  used: boolean
  usedAt?: Date
  linkedLineUserId?: string
}

// Generate random token
function generateRandomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Generate link token for parent
export async function generateLinkToken(parentId: string): Promise<string> {
  const supabase = createServiceClient()

  try {
    // Check if parent exists and not already linked
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id, line_user_id')
      .eq('id', parentId)
      .single()

    if (parentError || !parent) {
      throw new Error('Parent not found')
    }

    if (parent.line_user_id) {
      throw new Error('Parent already linked to LINE')
    }

    const token = generateRandomToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Store in database
    const { error: insertError } = await supabase
      .from('link_tokens')
      .insert({
        token,
        parent_id: parentId,
        expires_at: expiresAt.toISOString(),
        used: false
      })

    if (insertError) {
      console.error('Error creating link token:', insertError)
      throw new Error('Failed to create link token')
    }

    return token
  } catch (error) {
    console.error('Error generating link token:', error)
    throw error
  }
}

// Get token document
export async function getTokenDoc(token: string): Promise<LinkToken | null> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('link_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      token: data.token,
      parentId: data.parent_id,
      createdAt: new Date(data.created_at),
      expiresAt: new Date(data.expires_at),
      used: data.used,
      usedAt: data.used_at ? new Date(data.used_at) : undefined,
      linkedLineUserId: data.linked_line_user_id || undefined
    }
  } catch (error) {
    console.error('Error getting token:', error)
    return null
  }
}

// Verify link token
export async function verifyLinkToken(
  token: string,
  phone: string
): Promise<{
  valid: boolean
  error?: string
  parent?: any
  tokenDoc?: LinkToken
}> {
  const supabase = createServiceClient()

  try {
    // Check token exists
    const tokenDoc = await getTokenDoc(token)
    if (!tokenDoc) {
      return { valid: false, error: 'token_not_found' }
    }

    // Check if token is used
    if (tokenDoc.used) {
      return { valid: false, error: 'token_used' }
    }

    // Check if token is expired
    if (tokenDoc.expiresAt < new Date()) {
      return { valid: false, error: 'token_expired' }
    }

    // Get parent data
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('*')
      .eq('id', tokenDoc.parentId)
      .single()

    if (parentError || !parent) {
      return { valid: false, error: 'parent_not_found' }
    }

    // Check if already linked
    if (parent.line_user_id) {
      return { valid: false, error: 'already_linked' }
    }

    // Check phone matches (remove formatting)
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const parentPhone = (parent.phone || '').replace(/[^0-9]/g, '')

    if (cleanPhone !== parentPhone) {
      // Also check emergency phone
      const parentEmergencyPhone = (parent.emergency_phone || '').replace(/[^0-9]/g, '')
      if (cleanPhone !== parentEmergencyPhone) {
        return { valid: false, error: 'phone_not_match' }
      }
    }

    // Get students
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', parent.id)
      .eq('is_active', true)

    return {
      valid: true,
      parent: {
        ...parent,
        students: students || []
      },
      tokenDoc
    }
  } catch (error) {
    console.error('Error verifying token:', error)
    return { valid: false, error: 'system_error' }
  }
}

// Mark token as used
export async function markTokenAsUsed(
  tokenId: string,
  lineUserId: string
): Promise<void> {
  const supabase = createServiceClient()

  try {
    const { error } = await supabase
      .from('link_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        linked_line_user_id: lineUserId
      })
      .eq('id', tokenId)

    if (error) {
      console.error('Error marking token as used:', error)
      throw error
    }
  } catch (error) {
    console.error('Error marking token as used:', error)
    throw error
  }
}

// Clean up expired tokens (for maintenance)
export async function cleanupExpiredTokens(): Promise<number> {
  const supabase = createServiceClient()

  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('link_tokens')
      .update({
        used: true,
        used_at: now
      })
      .lt('expires_at', now)
      .eq('used', false)
      .select('id')

    if (error) {
      console.error('Error cleaning up tokens:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('Error cleaning up tokens:', error)
    return 0
  }
}

// Get active tokens for parent
export async function getActiveTokensForParent(parentId: string): Promise<LinkToken[]> {
  const supabase = createServiceClient()

  try {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('link_tokens')
      .select('*')
      .eq('parent_id', parentId)
      .eq('used', false)
      .gt('expires_at', now)

    if (error || !data) {
      console.error('Error getting active tokens:', error)
      return []
    }

    return data.map(token => ({
      id: token.id,
      token: token.token,
      parentId: token.parent_id,
      createdAt: new Date(token.created_at),
      expiresAt: new Date(token.expires_at),
      used: token.used,
      usedAt: token.used_at ? new Date(token.used_at) : undefined,
      linkedLineUserId: token.linked_line_user_id || undefined
    }))
  } catch (error) {
    console.error('Error getting active tokens:', error)
    return []
  }
}

// Link parent to LINE account
export async function linkParentToLine(
  parentId: string,
  lineUserId: string,
  lineDisplayName?: string
): Promise<boolean> {
  const supabase = createServiceClient()

  try {
    const { error } = await supabase
      .from('parents')
      .update({
        line_user_id: lineUserId,
        line_display_name: lineDisplayName,
        updated_at: new Date().toISOString()
      })
      .eq('id', parentId)

    if (error) {
      console.error('Error linking parent to LINE:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error linking parent to LINE:', error)
    return false
  }
}
