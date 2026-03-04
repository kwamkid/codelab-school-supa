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

// Section-level loading — centered within parent
export function SectionLoading({ text }: { text?: string } = {}) {
  return (
    <div className="flex items-center justify-center py-12 min-h-[200px]">
      <Loading size="md" text={text} />
    </div>
  )
}
