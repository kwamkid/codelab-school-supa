// lib/line/liff-cache.ts
// Tiny cache so switching bottom-nav tabs shows the last data instantly instead
// of a fresh loading spinner every time. Pages read the cached value on mount
// (no spinner), then revalidate in the background and update silently.
//
// Two layers:
// - module-scope Map: survives route navigation within a live page
// - sessionStorage: survives the LIFF webview reloading the page (backgrounding
//   LINE, opening a chat and coming back), which wipes module state
//
// Values MUST be JSON-serializable (the sessionStorage layer round-trips them).
// Store raw API data (strings) and revive Dates at read time in the page.

const store = new Map<string, any>()
const SS_PREFIX = 'liffcache:'

export function getLiffCache<T = any>(key: string): T | undefined {
  if (store.has(key)) return store.get(key)
  try {
    const raw = window.sessionStorage.getItem(SS_PREFIX + key)
    if (raw != null) {
      const value = JSON.parse(raw)
      store.set(key, value)
      return value
    }
  } catch {
    // SSR or storage unavailable — memory layer only
  }
  return undefined
}

export function setLiffCache<T = any>(key: string, value: T): void {
  store.set(key, value)
  try {
    window.sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value))
  } catch {
    // quota/unavailable — memory layer still works
  }
}

export function clearLiffCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    try {
      const dead: string[] = []
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i)
        if (k?.startsWith(SS_PREFIX)) dead.push(k)
      }
      dead.forEach((k) => window.sessionStorage.removeItem(k))
    } catch {}
    return
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
  try {
    const dead: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k?.startsWith(SS_PREFIX + prefix)) dead.push(k)
    }
    dead.forEach((k) => window.sessionStorage.removeItem(k))
  } catch {}
}
