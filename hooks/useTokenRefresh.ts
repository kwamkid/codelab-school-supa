import { useEffect, useRef, useCallback } from 'react'
import { useLiff } from '@/components/liff/liff-provider'

export function useTokenRefresh(intervalMinutes: number = 10) {
  const { liff, isLoggedIn } = useLiff()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckRef = useRef<number>(0)

  // Debounced check - skip if checked within last 60 seconds
  const checkToken = useCallback(async () => {
    const now = Date.now()
    if (now - lastCheckRef.current < 60_000) return
    lastCheckRef.current = now

    if (!liff) return

    try {
      const stillLoggedIn = liff.isLoggedIn()
      if (!stillLoggedIn) {
        liff.login()
      } else {
        try {
          await liff.getProfile()
        } catch (error: any) {
          if (error.message?.includes('401') || error.message?.includes('expired')) {
            liff.login()
          }
        }
      }
    } catch (error) {
      console.error('[useTokenRefresh] Error:', error)
    }
  }, [liff])

  useEffect(() => {
    if (!liff || !isLoggedIn) return

    // Initial check
    checkToken()

    // Set up interval
    intervalRef.current = setInterval(checkToken, intervalMinutes * 60 * 1000)

    // Check on visibility change (debounced via lastCheckRef)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkToken()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [liff, isLoggedIn, intervalMinutes, checkToken])
}