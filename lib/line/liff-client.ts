// This file is for client-side LIFF operations only
import type { Liff } from '@line/liff'

let liffInstance: Liff | null = null
let liffId: string | null = null
let isInitializing = false

// Get LIFF ID
async function getLiffId(): Promise<string> {
  if (liffId) return liffId
  
  try {
    // Use env variable if available
    const envLiffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (envLiffId) {
      liffId = envLiffId
      return liffId
    }

    // Fallback to hardcoded
    liffId = '2007575627-GmKBZJdo'
    return liffId
  } catch (error) {
    console.error('Failed to get LIFF ID:', error)
    liffId = '2007575627-GmKBZJdo'
    return liffId
  }
}

export async function initializeLiff(): Promise<Liff> {
  console.log('[LIFF] initializeLiff called')
  
  // Prevent multiple simultaneous initialization
  if (isInitializing) {
    console.log('[LIFF] Already initializing, waiting...')
    // Wait for the current initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (liffInstance) {
      return liffInstance
    }
  }
  
  // Check if already initialized and valid
  if (liffInstance && typeof (window as any).liff !== 'undefined') {
    console.log('[LIFF] Already initialized, checking if logged in...')
    try {
      const loggedIn = liffInstance.isLoggedIn()
      console.log('[LIFF] Login status:', loggedIn)
      return liffInstance
    } catch (error) {
      console.log('[LIFF] Error checking login status, re-initializing...')
      liffInstance = null
    }
  }

  try {
    isInitializing = true
    console.log('[LIFF] Starting fresh initialization...')
    
    // Get LIFF ID
    const liffIdValue = await getLiffId()
    console.log('[LIFF] Using LIFF ID:', liffIdValue)
    
    // Import LIFF SDK
    console.log('[LIFF] Importing LIFF SDK...')
    const liff = (await import('@line/liff')).default
    
    // Initialize LIFF
    console.log('[LIFF] Calling liff.init()...')
    await liff.init({ 
      liffId: liffIdValue,
      withLoginOnExternalBrowser: true
    })
    
    console.log('[LIFF] Init completed successfully')
    console.log('[LIFF] isLoggedIn:', liff.isLoggedIn())
    console.log('[LIFF] isInClient:', liff.isInClient())
    
    liffInstance = liff
    ;(window as any).liff = liff
    
    return liff
  } catch (error: any) {
    console.error('[LIFF] Initialization error:', error)
    throw error
  } finally {
    isInitializing = false
  }
}

export function getLiffInstance(): Liff | null {
  return liffInstance
}

export async function getLiffProfile() {
  const liff = await initializeLiff()
  
  if (!liff.isLoggedIn()) {
    throw new Error('User is not logged in')
  }
  
  return await liff.getProfile()
}

export function isLiffLoggedIn(): boolean {
  if (!liffInstance) return false
  try {
    return liffInstance.isLoggedIn()
  } catch {
    return false
  }
}

export function clearLiffCache() {
  liffId = null
  liffInstance = null
  isInitializing = false
  if (typeof window !== 'undefined') {
    ;(window as any).liff = null
  }
}