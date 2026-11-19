// lib/fb/click-ids.ts — browser-side Meta click ids for the Conversions API.
//
// fbc = "fb.1.<ms timestamp>.<fbclid>" — built from ?fbclid= on the landing URL
// (LIFF may tuck the original query inside ?liff.state=…), or the _fbc cookie
// the Meta Pixel sets. fbp = the _fbp cookie. The fbc is remembered in
// localStorage for 90 days so it survives navigating away and coming back.

const STORE_KEY = 'meta:fbc'
const TTL_MS = 90 * 24 * 60 * 60 * 1000

function cookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : undefined
}

function fbclidFromUrl(): string | undefined {
  try {
    const url = new URL(window.location.href)
    const direct = url.searchParams.get('fbclid')
    if (direct) return direct
    const state = url.searchParams.get('liff.state')
    if (state) {
      const inner = new URLSearchParams(state.includes('?') ? state.slice(state.indexOf('?') + 1) : state)
      return inner.get('fbclid') || undefined
    }
  } catch {}
  return undefined
}

export function getMetaClickIds(): { fbc?: string; fbp?: string; clientUserAgent?: string } {
  if (typeof window === 'undefined') return {}
  let fbc = cookie('_fbc')
  const fbclid = fbclidFromUrl()
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`

  try {
    if (fbc) {
      localStorage.setItem(STORE_KEY, JSON.stringify({ fbc, at: Date.now() }))
    } else {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
      if (saved?.fbc && Date.now() - saved.at < TTL_MS) fbc = saved.fbc
    }
  } catch {}

  return { fbc, fbp: cookie('_fbp'), clientUserAgent: navigator.userAgent }
}
