import { useCallback, useEffect, useMemo, useRef } from 'react'

export function useScreenWakeLock(enabled) {
  const wakeLockRef = useRef(null)
  const enabledRef = useRef(Boolean(enabled))

  const wakeLockSupported = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof navigator.wakeLock?.request === 'function'
  }, [])

  useEffect(() => {
    enabledRef.current = Boolean(enabled)
  }, [enabled])

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLockRef.current
    wakeLockRef.current = null

    if (!current) {
      return
    }

    try {
      await current.release()
    } catch {
      // Ignore release failures from stale/already-released sentinels.
    }
  }, [])

  const acquireWakeLock = useCallback(async () => {
    if (!wakeLockSupported || !enabledRef.current || typeof document === 'undefined') {
      return
    }

    if (document.visibilityState !== 'visible' || wakeLockRef.current) {
      return
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen')
      wakeLockRef.current = sentinel

      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) {
          wakeLockRef.current = null
        }
      })
    } catch {
      // Some browsers reject requests without fresh user interaction.
    }
  }, [wakeLockSupported])

  useEffect(() => {
    if (!enabled) {
      releaseWakeLock()
      return undefined
    }

    acquireWakeLock()

    if (typeof document === 'undefined') {
      return () => {
        releaseWakeLock()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock()
      } else {
        releaseWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseWakeLock()
    }
  }, [acquireWakeLock, enabled, releaseWakeLock])

  return {
    wakeLockSupported,
  }
}