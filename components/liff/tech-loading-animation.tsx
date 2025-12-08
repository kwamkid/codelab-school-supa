'use client'

import { useEffect, useState } from 'react'
import { Code2, Binary, Cpu } from 'lucide-react'

export default function TechLoadingAnimation() {
  const [activeIndex, setActiveIndex] = useState(0)
  const icons = [Code2, Binary, Cpu]
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % icons.length)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const ActiveIcon = icons[activeIndex]
  
  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
          <div className="absolute inset-0 bg-red-500/30 rounded-full animate-ping animation-delay-200" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ActiveIcon className="h-12 w-12 text-red-500 animate-pulse" />
          </div>
        </div>
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