import { useEffect, useRef } from 'react'
import { useLiff } from '@/components/liff/liff-provider'

export function useTokenRefresh(intervalMinutes: number = 10) {
  const { liff, isLoggedIn } = useLiff()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!liff || !isLoggedIn) return

    const checkToken = async () => {
      console.log('[useTokenRefresh] Checking token...')
      try {
        // Instead of refreshTokenIfNeeded, check if user is still logged in
        const stillLoggedIn = liff.isLoggedIn()
        console.log('[useTokenRefresh] Still logged in:', stillLoggedIn)
        
        if (!stillLoggedIn) {
          console.log('[useTokenRefresh] Token invalid, need to login again')
          // Redirect to login
          liff.login()
        } else {
          try {
            // Try to get profile to verify token is still valid
            await liff.getProfile()
            console.log('[useTokenRefresh] Token is still valid')
          } catch (error: any) {
            console.error('[useTokenRefresh] Error getting profile:', error)
            if (error.message?.includes('401') || error.message?.includes('expired')) {
              console.log('[useTokenRefresh] Token expired, redirecting to login')
              liff.login()
            }
          }
        }
      } catch (error) {
        console.error('[useTokenRefresh] Error:', error)
      }
    }

    // Initial check
    checkToken()

    // Set up interval
    intervalRef.current = setInterval(checkToken, intervalMinutes * 60 * 1000)

    // Check on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useTokenRefresh] App became visible, checking token...')
        checkToken()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Check on focus
    const handleFocus = () => {
      console.log('[useTokenRefresh] Window focused, checking token...')
      checkToken()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [liff, isLoggedIn, intervalMinutes])
}