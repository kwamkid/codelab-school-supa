'use client'

import { useEffect, useState } from 'react'
import { Code2, Binary, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingProps {
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function Loading({ 
  fullScreen = false, 
  size = 'md',
  text,
  className 
}: LoadingProps = {}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const icons = [Code2, Binary, Cpu]
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % icons.length)
    }, 500)
    return () => clearInterval(interval)
  }, [icons.length])

  const ActiveIcon = icons[activeIndex]
  
  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'w-16 h-16',
      icon: 'h-8 w-8',
      text: 'text-sm'
    },
    md: {
      container: 'w-24 h-24',
      icon: 'h-12 w-12',
      text: 'text-base'
    },
    lg: {
      container: 'w-32 h-32',
      icon: 'h-16 w-16',
      text: 'text-lg'
    }
  }
  
  const containerClass = fullScreen 
    ? "fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center"
    : "flex items-center justify-center"
    
  return (
    <div className={cn(containerClass, className)}>
      <div className="text-center">
        <div className={cn("relative mx-auto mb-4", sizeConfig[size].container)}>
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
          <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping animation-delay-200" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ActiveIcon className={cn(sizeConfig[size].icon, "text-red-500 animate-pulse")} />
          </div>
        </div>
        {text && (
          <p className={cn("text-gray-600 font-medium", sizeConfig[size].text)}>
            {text}
          </p>
        )}
      </div>
      
      <style jsx>{`
        @keyframes ping {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        
        .animate-ping {
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        .animation-delay-200 {
          animation-delay: 200ms;
        }
      `}</style>
    </div>
  )
}

// Wrapper components for common use cases
export function PageLoading() {
  return <Loading fullScreen />
}

export function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loading size="md" />
    </div>
  )
}

export function ButtonLoading() {
  return <Loading size="sm" />
}