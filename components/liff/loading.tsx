'use client'
import Image from 'next/image'

export function LiffLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center">
        <div className="animate-pulse">
          <Image
            src="/logo-just-logo.svg"
            alt="Loading"
            width={80}
            height={80}
            className="mx-auto"
            priority
          />
        </div>
        <p className="text-gray-500 mt-3 font-medium">กำลังโหลด...</p>
      </div>
    </div>
  )
}
