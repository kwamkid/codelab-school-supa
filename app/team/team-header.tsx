'use client'

// Shared header for the public /team parent pages: CodeLab logo top-left +
// page title / team / parent. Full-width bar, mobile-first, responsive.

interface TeamHeaderProps {
  title: string
  teamLabel?: string
  parentName?: string | null
}

export function TeamHeader({ title, teamLabel, parentName }: TeamHeaderProps) {
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-5">
        {/* Logo (icon only) + title on one row */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-just-logo.svg"
            alt="CodeLab"
            className="h-8 sm:h-9 w-auto brightness-0 invert shrink-0"
          />
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
        </div>

        {(teamLabel || parentName) && (
          <div className="mt-2">
            {teamLabel && <p className="text-white/90 text-sm">{teamLabel}</p>}
            {parentName && <p className="text-white/75 text-xs mt-0.5">ผู้ปกครอง: {parentName}</p>}
          </div>
        )}
      </div>
    </header>
  )
}
