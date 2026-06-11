import { useEffect, useState } from 'react'

// A fix older than this (while actively recording) is treated as signal loss.
const STALE_AFTER_MS = 8000
const TICK_MS = 1000

/**
 * Watches the freshness of the latest GPS fix while a recording is active.
 * `geolocation.location.timestamp` is the ISO time of the most recent fix; when
 * the signal drops the watch stops delivering fixes, so the gap grows. This is
 * advisory only — the SessionBar already handles the "denied" / "no fix yet"
 * cases, so here we only flag loss after a fix had been acquired.
 */
export function useGpsHealth(geolocation, active) {
  const fixTimestamp = geolocation?.location?.timestamp || null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || !fixTimestamp) {
      return undefined
    }

    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [active, fixTimestamp])

  if (!active || !fixTimestamp) {
    return { stale: false, secondsSinceFix: null }
  }

  const fixMs = new Date(fixTimestamp).getTime()
  if (Number.isNaN(fixMs)) {
    return { stale: false, secondsSinceFix: null }
  }

  const elapsed = Math.max(0, now - fixMs)
  return {
    stale: elapsed > STALE_AFTER_MS,
    secondsSinceFix: Math.floor(elapsed / 1000),
  }
}
