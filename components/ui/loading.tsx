'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface LoadingProps {
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

const sizeConfig = {
  sm: { logo: 40, text: 'text-sm' },
  md: { logo: 64, text: 'text-base' },
  lg: { logo: 80, text: 'text-lg' },
}

export function Loading({
  fullScreen = false,
  size = 'md',
  text,
  className,
}: LoadingProps) {
  // Prevent body scroll when fullScreen
  useEffect(() => {
    if (!fullScreen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [fullScreen])

  const config = sizeConfig[size]

  const content = (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center">
        {/* Ping ring */}
        <span
          className="absolute rounded-full bg-[#ef443a]/20"
          style={{
            width: config.logo * 1.6,
            height: config.logo * 1.6,
            animation: 'loading-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
        {/* Logo with bounce */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-just-logo.svg"
          alt="Loading"
          width={config.logo}
          height={config.logo}
          className="relative z-10"
          style={{ animation: 'loading-bounce 1.5s ease-in-out infinite' }}
        />
      </div>
      {text && (
        <p className={cn('text-muted-foreground mt-3 font-medium', config.text)}>
          {text}
        </p>
      )}
      <style jsx>{`
        @keyframes loading-ping {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        @keyframes loading-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )

  if (fullScreen) {
    return (
      <div className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm',
        className
      )}>
        {content}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      {content}
    </div>
  )
}

// Full-screen overlay — blocks scroll, covers everything
export function PageLoading({ text }: { text?: string } = {}) {
  return <Loading fullScreen size="lg" text={text} />
}

// Inline loading — tiny spinner for table cells / inline text
export function InlineLoading({ className }: { className?: string } = {}) {
  return (
    <svg
      className={cn('animate-spin h-4 w-4 text-muted-foreground/60', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// Section-level loading — spinner icon, centered within parent
export function SectionLoading({ text }: { text?: string } = {}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 min-h-[200px]">
      <svg
        className="animate-spin h-8 w-8 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text && <p className="text-muted-foreground mt-3 text-base font-medium">{text}</p>}
    </div>
  )
}
