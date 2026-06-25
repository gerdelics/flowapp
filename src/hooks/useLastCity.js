import { useCallback, useState } from 'react'

// Remembers a recently-chosen city so a form can default to it, surviving
// reloads. Device-local (localStorage), not synced. Pass a distinct storageKey
// to keep independent caches (e.g. one for sessions, one for the route modal).
const DEFAULT_KEY = 'flowapp_last_city'

function readCity(storageKey) {
  try {
    return localStorage.getItem(storageKey) || ''
  } catch {
    return ''
  }
}

export function useLastCity(storageKey = DEFAULT_KEY) {
  const [city, setCityState] = useState(() => readCity(storageKey))

  const setCity = useCallback(
    (next) => {
      const value = typeof next === 'string' ? next : ''
      setCityState(value)
      try {
        if (value) {
          localStorage.setItem(storageKey, value)
        } else {
          localStorage.removeItem(storageKey)
        }
      } catch {
        // Storage unavailable — keep the in-memory value.
      }
    },
    [storageKey],
  )

  return { city, setCity }
}
