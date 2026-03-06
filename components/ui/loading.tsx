'use client'

import { useEffect } from 'react'
import Image from 'next/image'
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
      <div className="animate-pulse">
        <Image
          src="/logo-just-logo.svg"
          alt="Loading"
          width={config.logo}
          height={config.logo}
          className="mx-auto"
          priority
        />
      </div>
      {text && (
        <p className={cn('text-gray-500 mt-3 font-medium', config.text)}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm',
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

// Section-level loading — spinner icon, centered within parent
export function SectionLoading({ text }: { text?: string } = {}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 min-h-[200px]">
      <svg
        className="animate-spin h-8 w-8 text-gray-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text && <p className="text-gray-500 mt-3 text-base font-medium">{text}</p>}
    </div>
  )
}
