import { useEffect, useState } from 'react'

const INITIAL = { supported: false, level: null, charging: null }

/**
 * Exposes the device battery level/charging state via the Battery Status API.
 * Feature-detected and wrapped in try/catch because support is partial (and the
 * API is unavailable on iOS). Used only to surface a low-battery warning; it
 * never changes recording behaviour.
 */
export function useBatteryStatus() {
  const [status, setStatus] = useState(INITIAL)

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') {
      return undefined
    }

    let battery = null
    let cancelled = false

    const sync = () => {
      if (!battery || cancelled) {
        return
      }
      setStatus({ supported: true, level: battery.level, charging: battery.charging })
    }

    navigator
      .getBattery()
      .then((result) => {
        if (cancelled) {
          return
        }
        battery = result
        battery.addEventListener('levelchange', sync)
        battery.addEventListener('chargingchange', sync)
        sync()
      })
      .catch(() => {
        // Battery API unavailable or blocked — leave status unsupported.
      })

    return () => {
      cancelled = true
      if (battery) {
        battery.removeEventListener('levelchange', sync)
        battery.removeEventListener('chargingchange', sync)
      }
    }
  }, [])

  return status
}
