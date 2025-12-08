// Mobile-specific LIFF initialization utilities
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod|android/.test(userAgent)
}

export function isLineApp(): boolean {
  if (typeof window === 'undefined') return false
  
  const userAgent = window.navigator.userAgent.toLowerCase()
  return userAgent.includes('line')
}

export function getLiffErrorMessage(error: any): string {
  console.error('[LIFF] Full error object:', error)
  
  // Common LIFF errors
  if (error.code === 'INIT_FAILED') {
    return 'ไม่สามารถเริ่มต้น LIFF ได้ กรุณาเปิดผ่าน LINE app'
  }
  
  if (error.code === 'INVALID_CONFIG') {
    return 'การตั้งค่า LIFF ไม่ถูกต้อง'
  }
  
  if (error.code === 'FORBIDDEN') {
    return 'ไม่อนุญาตให้เข้าถึงจาก URL นี้'
  }
  
  if (error.message?.includes('Load failed')) {
    return 'ไม่สามารถโหลด LIFF SDK ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
  }
  
  if (error.message?.includes('net::ERR_BLOCKED_BY_CLIENT')) {
    return 'LIFF ถูกบล็อคโดย Ad Blocker หรือการตั้งค่าเบราว์เซอร์'
  }
  
  return error.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'
}

// Retry logic for mobile
export async function initializeLiffWithRetry(
  liffId: string, 
  maxRetries: number = 3,
  delay: number = 1000
): Promise<any> {
  let lastError: any
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[LIFF] Mobile init attempt ${i + 1}/${maxRetries}`)
      
      // Import LIFF SDK
      const liff = (await import('@line/liff')).default
      
      // Add delay before init (helps with mobile loading issues)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      
      // Initialize LIFF
      await liff.init({ 
        liffId,
        withLoginOnExternalBrowser: true
      })
      
      console.log('[LIFF] Mobile init successful!')
      return liff
      
    } catch (error) {
      console.error(`[LIFF] Mobile init attempt ${i + 1} failed:`, error)
      lastError = error
      
      // Increase delay for next retry
      delay = delay * 1.5
    }
  }
  
  throw lastError
}

// Check network connectivity
export async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/v2/health', {
      method: 'HEAD',
      mode: 'no-cors'
    })
    return true
  } catch (error) {
    console.error('[LIFF] Connectivity check failed:', error)
    return false
  }
}

// Alternative loading method for problematic devices
export function loadLiffSdkViaScript(liffId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).liff) {
      resolve((window as any).liff)
      return
    }
    
    // Create script tag
    const script = document.createElement('script')
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
    script.async = true
    
    script.onload = async () => {
      try {
        const liff = (window as any).liff
        if (!liff) {
          reject(new Error('LIFF not found after script load'))
          return
        }
        
        await liff.init({ liffId })
        resolve(liff)
      } catch (error) {
        reject(error)
      }
    }
    
    script.onerror = () => {
      reject(new Error('Failed to load LIFF SDK script'))
    }
    
    document.head.appendChild(script)
  })
}