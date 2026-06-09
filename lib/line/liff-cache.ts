// lib/line/liff-cache.ts
// Tiny in-memory cache so switching bottom-nav tabs shows the last data instantly
// instead of a fresh loading spinner every time. Pages read the cached value on
// mount (no spinner), then revalidate in the background and update silently.
// Lives at module scope so it survives route navigation (the data is plain JS, so
// Date objects etc. are preserved — not JSON).

const store = new Map<string, any>()

export function getLiffCache<T = any>(key: string): T | undefined {
  return store.get(key)
}

export function setLiffCache<T = any>(key: string, value: T): void {
  store.set(key, value)
}

export function clearLiffCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}
