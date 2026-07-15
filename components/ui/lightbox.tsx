"use client"

import { useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface LightboxProps {
  /** Image(s) to show. A single string is treated as a one-image gallery. */
  images: string | string[]
  /** Index of the image currently shown. Ignored for a single image. */
  index?: number
  /** Called with the new index when navigating. Required for multi-image galleries. */
  onIndexChange?: (index: number) => void
  /** Close handler — fires on ESC, backdrop click, and the close button. */
  onClose: () => void
  /** Rendered under the image (e.g. a caption or event name). */
  caption?: string
  className?: string
}

/**
 * Full-screen image viewer. Renders in a portal on document.body so it is never
 * clipped or stacked below page content (cards with overflow-hidden, sticky bars).
 * Supports ESC to close and ←/→ to navigate a multi-image gallery.
 */
export function Lightbox({
  images,
  index = 0,
  onIndexChange,
  onClose,
  caption,
  className,
}: LightboxProps) {
  const urls = Array.isArray(images) ? images : [images]
  const total = urls.length
  const safeIndex = Math.min(Math.max(index, 0), Math.max(total - 1, 0))
  const current = urls[safeIndex]

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next > total - 1) return
      onIndexChange?.(next)
    },
    [onIndexChange, total]
  )

  // ESC closes; arrows navigate.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (total > 1) {
        if (e.key === "ArrowLeft") goTo(safeIndex - 1)
        if (e.key === "ArrowRight") goTo(safeIndex + 1)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, goTo, safeIndex, total])

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (typeof document === "undefined" || !current) return null

  const btn =
    "absolute z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[130] flex items-center justify-center bg-black/80",
        className
      )}
      onClick={onClose}
    >
      <button onClick={onClose} className={cn(btn, "top-4 right-4")} aria-label="ปิด">
        <X className="w-5 h-5" />
      </button>

      {total > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/40 text-white text-sm tabular-nums">
          {safeIndex + 1} / {total}
        </div>
      )}

      {total > 1 && safeIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goTo(safeIndex - 1)
          }}
          className={cn(btn, "left-3")}
          aria-label="รูปก่อนหน้า"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      <div
        className="flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Natural aspect ratio: bounded by viewport, never upscaled or cropped. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={caption || ""}
          className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain"
        />
        {caption && (
          <p className="max-w-[90vw] truncate text-center text-sm text-white/80">
            {caption}
          </p>
        )}
      </div>

      {total > 1 && safeIndex < total - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goTo(safeIndex + 1)
          }}
          className={cn(btn, "right-3")}
          aria-label="รูปถัดไป"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>,
    document.body
  )
}
