// Client-side helpers for event short links (/e/<code>).
// The API route does the real work; these keep the callers consistent so a page
// can't accidentally hand out the long /liff/events/register/<uuid> URL.

/** Long registration URL — the fallback when no short link can be made. */
export function longEventRegistrationUrl(eventId: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/liff/events/register/${eventId}`
}

/** Short registration URL for a known code. */
export function shortEventUrl(code: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/e/${code}`
}

/**
 * Fetch (or create) the short code for an event's registration link.
 * Returns null if the API is unreachable or errors, so callers can fall back.
 */
export async function fetchEventShortCode(eventId: string): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/short-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    })
    const data = await res.json()
    if (!res.ok || !data.code) return null
    return data.code as string
  } catch {
    return null
  }
}

/**
 * Resolve the best registration URL for an event: the short /e/<code> link when
 * available, otherwise the long one.
 */
export async function getEventRegistrationUrl(eventId: string): Promise<string> {
  const code = await fetchEventShortCode(eventId)
  return code ? shortEventUrl(code) : longEventRegistrationUrl(eventId)
}
