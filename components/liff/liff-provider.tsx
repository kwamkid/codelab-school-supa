'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { Liff } from '@line/liff'
import { initializeLiff } from '@/lib/line/liff-client'
import { LiffLoading } from '@/components/liff/loading'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

// Define Profile type based on LIFF documentation
interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

interface LiffContextType {
  liff: Liff | null
  profile: LiffProfile | null
  isLoading: boolean
  error: Error | null
  isLoggedIn: boolean
  isInClient: boolean
}

const LiffContext = createContext<LiffContextType>({
  liff: null,
  profile: null,
  isLoading: true,
  error: null,
  isLoggedIn: false,
  isInClient: false
})

export function useLiff() {
  const context = useContext(LiffContext)
  if (!context) {
    throw new Error('useLiff must be used within LiffProvider')
  }
  return context
}

interface LiffProviderProps {
  children: React.ReactNode
  requireLogin?: boolean
}

export function LiffProvider({ children, requireLogin = false }: LiffProviderProps) {
  const [liff, setLiff] = useState<Liff | null>(null)
  const [profile, setProfile] = useState<LiffProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isInClient, setIsInClient] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    // Prevent double initialization
    if (initialized.current) {
      console.log('[LiffProvider] Already initialized, skipping...')
      return
    }
    initialized.current = true

    const init = async () => {
      console.log('[LiffProvider] Starting initialization...')
      
      try {
        // Initialize LIFF
        const liffInstance = await initializeLiff()
        console.log('[LiffProvider] LIFF initialized')
        
        setLiff(liffInstance)
        setIsInClient(liffInstance.isInClient())
        
        // Check login status
        const loggedIn = liffInstance.isLoggedIn()
        console.log('[LiffProvider] Logged in:', loggedIn)
        setIsLoggedIn(loggedIn)
        
        if (loggedIn) {
          try {
            // Get user profile
            console.log('[LiffProvider] Getting profile...')
            const userProfile = await liffInstance.getProfile()
            console.log('[LiffProvider] Got profile:', userProfile.displayName)
            setProfile(userProfile as LiffProfile)
            
            // Update parent last login if exists
            try {
              const { getParentByLineId, updateParent } = await import('@/lib/services/parents')
              const parent = await getParentByLineId(userProfile.userId)
              if (parent) {
                await updateParent(parent.id, {
                  lastLoginAt: new Date()
                })
              }
            } catch (error) {
              console.error('[LiffProvider] Error updating parent:', error)
            }
          } catch (profileError: any) {
            console.error('[LiffProvider] Error getting profile:', profileError)
            
            // If token expired, trigger login only if requireLogin is true
            if (profileError.message?.includes('expired') || 
                profileError.message?.includes('401')) {
              console.log('[LiffProvider] Token expired')
              if (requireLogin) {
                console.log('[LiffProvider] requireLogin is true, triggering login...')
                liffInstance.login()
              } else {
                console.log('[LiffProvider] requireLogin is false, not triggering login')
                // Clear login state
                setIsLoggedIn(false)
                setProfile(null)
              }
            } else {
              setError(profileError)
            }
          }
        } else if (requireLogin) {
          console.log('[LiffProvider] Not logged in and requireLogin is true, redirecting to login...')
          liffInstance.login()
        }
        
      } catch (err) {
        console.error('[LiffProvider] Init error:', err)
        setError(err instanceof Error ? err : new Error('Failed to initialize LIFF'))
      } finally {
        console.log('[LiffProvider] Initialization complete, setting loading to false')
        setIsLoading(false)
      }
    }

    init()
  }, [requireLogin])

  if (isLoading) {
    return <LiffLoading />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-red-50 to-white">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold">เกิดข้อผิดพลาด</h2>
              <p className="text-sm text-gray-600">
                {error.message === 'Failed to initialize LIFF' 
                  ? 'ไม่สามารถเริ่มต้นระบบได้ กรุณาลองใหม่อีกครั้ง' 
                  : error.message}
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700"
              >
                ลองใหม่
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <LiffContext.Provider 
      value={{ 
        liff, 
        profile, 
        isLoading, 
        error, 
        isLoggedIn,
        isInClient
      }}
    >
      {children}
    </LiffContext.Provider>
  )
}