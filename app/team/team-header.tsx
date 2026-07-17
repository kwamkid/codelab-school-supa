'use client'

// Shared header for the public /team parent pages, styled like the LIFF parent
// portal's gradient header: CodeLab logo left + page title, LINE profile photo
// right, then "ทีม <no> — <name>" underneath. Used by both /team/e and /team/p.

import { useLiff } from '@/components/liff/liff-provider'
import { User } from 'lucide-react'

interface TeamHeaderProps {
  title: string
  teamLabel?: string
  parentName?: string | null
}

export function TeamHeader({ title, teamLabel, parentName }: TeamHeaderProps) {
  // Inside LINE (LIFF) we have the profile photo; web-login visitors get a
  // neutral icon instead.
  const { profile } = useLiff()

  return (
    <header className="bg-gradient-to-br from-primary to-orange-500 text-white rounded-b-3xl">
      <div className="mx-auto max-w-6xl px-5 pt-7 pb-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-just-logo.svg"
            alt="CodeLab"
            className="h-8 sm:h-9 w-auto brightness-0 invert shrink-0"
          />
          <h1 className="text-xl font-bold leading-tight flex-1 min-w-0 truncate">{title}</h1>
          <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden border border-white/30 shrink-0">
            {profile?.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.pictureUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-6 w-6" />
            )}
          </div>
        </div>

        {(teamLabel || parentName) && (
          <div className="mt-2">
            {teamLabel && <p className="text-white/90 text-sm font-medium">{teamLabel}</p>}
            {parentName && <p className="text-white/75 text-xs mt-0.5">ผู้ปกครอง: {parentName}</p>}
          </div>
        )}
      </div>
    </header>
  )
}
