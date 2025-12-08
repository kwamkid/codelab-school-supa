'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Home, LogIn } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class LiffErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LIFF Error:', error, errorInfo)
    
    // Log more details for debugging
    console.error('Error stack:', error.stack)
    console.error('Component stack:', errorInfo.componentStack)
    
    // Check for token expired errors
    if (this.isTokenExpiredError(error)) {
      console.log('Token expired error detected')
      this.handleTokenExpired()
    }
    
    this.setState({
      error,
      errorInfo
    })
  }

  isTokenExpiredError = (error: Error): boolean => {
    const errorMessage = error.message?.toLowerCase() || ''
    const errorString = error.toString()?.toLowerCase() || ''
    
    return errorMessage.includes('expired') || 
           errorMessage.includes('401') ||
           errorMessage.includes('unauthorized') ||
           errorMessage.includes('token') ||
           errorString.includes('expired_access_token') ||
           errorString.includes('the access token expired')
  }

  handleTokenExpired = () => {
    console.log('Handling token expired...')
    
    // Clear any cached data
    if (typeof window !== 'undefined') {
      try {
        // Clear LIFF related localStorage
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('liff') || key.includes('line') || key.includes('LIFF'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => {
          console.log('Removing localStorage key:', key)
          localStorage.removeItem(key)
        })
        
        // Clear sessionStorage as well
        keysToRemove.length = 0
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && (key.includes('liff') || key.includes('line') || key.includes('LIFF'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => {
          console.log('Removing sessionStorage key:', key)
          sessionStorage.removeItem(key)
        })
        
      } catch (e) {
        console.error('Error clearing storage:', e)
      }
    }
  }

  handleReload = () => {
    this.handleTokenExpired()
    window.location.reload()
  }

  handleLogin = () => {
    this.handleTokenExpired()
    // Navigate to LIFF page which will trigger login
    window.location.href = '/liff'
  }

  render() {
    if (this.state.hasError) {
      const isTokenError = this.isTokenExpiredError(this.state.error!)

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                {isTokenError ? 'การเข้าสู่ระบบหมดอายุ' : 'เกิดข้อผิดพลาด'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {isTokenError ? (
                  <div className="space-y-2">
                    <p className="font-medium text-amber-600">
                      Session ของคุณหมดอายุแล้ว
                    </p>
                    <p>
                      กรุณาเข้าสู่ระบบใหม่เพื่อใช้งานต่อ
                    </p>
                    <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                      หากยังคงพบปัญหา ลองปิดแอป LINE แล้วเปิดใหม่
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">
                      {this.state.error?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}
                    </p>
                    {/* Show technical details in development */}
                    {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500">
                          รายละเอียดทางเทคนิค
                        </summary>
                        <pre className="text-xs mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
                          {this.state.error?.stack}
                          {'\n\nComponent Stack:'}
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                {isTokenError ? (
                  <>
                    <Button
                      onClick={this.handleLogin}
                      variant="default"
                      className="flex-1"
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      เข้าสู่ระบบใหม่
                    </Button>
                    <Button
                      onClick={this.handleReload}
                      variant="outline"
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      รีเฟรช
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => window.location.reload()}
                      variant="default"
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      โหลดใหม่
                    </Button>
                    <Button
                      onClick={() => window.location.href = '/'}
                      variant="outline"
                      className="flex-1"
                    >
                      <Home className="h-4 w-4 mr-2" />
                      กลับหน้าหลัก
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}