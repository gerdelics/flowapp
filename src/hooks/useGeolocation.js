import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// How often the `location` React state may update. The GPS watch keeps an
// always-fresh value in `locationRef` for high-frequency consumers (the path
// sampler); state updates are throttled so the UI marker re-renders at most
// once per second regardless of how fast the device delivers fixes.
const STATE_THROTTLE_MS = 1000

const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 20000,
}

const ONE_SHOT_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
}

function normalizePosition(position) {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: new Date(position.timestamp).toISOString(),
  }
}

function getGeolocationErrorInfo(err) {
  const code = err?.code
  if (code === 1) {
    return {
      permissionState: 'denied',
      message: 'Location permission denied by user/browser.',
    }
  }
  if (code === 2) {
    return {
      permissionState: null,
      message: 'Position unavailable. Trying again…',
    }
  }
  if (code === 3) {
    return {
      permissionState: null,
      message: 'Location request timed out. Trying again…',
    }
  }
  return {
    permissionState: null,
    message: err?.message || 'Geolocation error.',
  }
}

export function useGeolocation() {
  const watchIdRef = useRef(null)
  const wantsWatchRef = useRef(false)
  const locationRef = useRef(null)
  const lastStateUpdateRef = useRef(0)
  const trailingTimerRef = useRef(null)
  const [permissionState, setPermissionState] = useState('unknown')
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)

  const available = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.geolocation,
    [],
  )

  // Push the latest position into `locationRef` immediately and into React
  // state at most once per STATE_THROTTLE_MS (with a trailing update so the
  // final position is never dropped).
  const publishLocation = useCallback((normalized, immediate = false) => {
    locationRef.current = normalized

    if (immediate) {
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
      lastStateUpdateRef.current = Date.now()
      setLocation(normalized)
      return
    }

    const now = Date.now()
    const elapsed = now - lastStateUpdateRef.current

    if (elapsed >= STATE_THROTTLE_MS) {
      lastStateUpdateRef.current = now
      setLocation(normalized)
      return
    }

    if (!trailingTimerRef.current) {
      trailingTimerRef.current = setTimeout(() => {
        trailingTimerRef.current = null
        lastStateUpdateRef.current = Date.now()
        setLocation(locationRef.current)
      }, STATE_THROTTLE_MS - elapsed)
    }
  }, [])

  const beginWatch = useCallback(() => {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (!available || watchIdRef.current !== null || hidden) {
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        publishLocation(normalizePosition(position))
        setPermissionState('granted')
        setError(null)
      },
      (err) => {
        const info = getGeolocationErrorInfo(err)
        if (info.permissionState) {
          setPermissionState(info.permissionState)
        }
        setError(info.message)
      },
      WATCH_OPTIONS,
    )
  }, [available, publishLocation])

  const endWatch = useCallback(() => {
    if (!available || watchIdRef.current === null) {
      return
    }

    navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
  }, [available])

  useEffect(() => {
    if (!available || !navigator.permissions?.query) {
      return undefined
    }

    let cancelled = false
    let permissionStatus = null

    async function initPermissionState() {
      try {
        permissionStatus = await navigator.permissions.query({ name: 'geolocation' })
        if (!cancelled) {
          setPermissionState(permissionStatus.state)
        }

        permissionStatus.onchange = () => {
          setPermissionState(permissionStatus.state)
        }
      } catch {
        // Ignore permissions API failures (browser support differences).
      }
    }

    initPermissionState()

    return () => {
      cancelled = true
      if (permissionStatus) {
        permissionStatus.onchange = null
      }
    }
  }, [available])

  // Pause the GPS watch whenever the page is backgrounded and resume it when
  // the page becomes visible again. A hidden tab can't show the map, so keeping
  // the high-accuracy radio alive there is pure battery waste.
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        endWatch()
      } else if (wantsWatchRef.current) {
        beginWatch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      endWatch()
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current)
        trailingTimerRef.current = null
      }
    }
  }, [beginWatch, endWatch])

  const refreshPermission = useCallback(async () => {
    if (!available || !navigator.permissions?.query) {
      return permissionState
    }

    try {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      setPermissionState(status.state)
      return status.state
    } catch {
      return permissionState
    }
  }, [available, permissionState])

  const requestOnce = useCallback(async () => {
    if (!available) {
      setError('Geolocation API is not available in this browser.')
      return null
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const normalized = normalizePosition(position)
          publishLocation(normalized, true)
          setPermissionState('granted')
          setError(null)
          resolve(normalized)
        },
        (err) => {
          const info = getGeolocationErrorInfo(err)
          if (info.permissionState) {
            setPermissionState(info.permissionState)
          }
          setError(info.message)
          resolve(null)
        },
        ONE_SHOT_OPTIONS,
      )
    })
  }, [available, publishLocation])

  const startWatching = useCallback(() => {
    wantsWatchRef.current = true
    beginWatch()
  }, [beginWatch])

  const stopWatching = useCallback(() => {
    wantsWatchRef.current = false
    endWatch()
  }, [endWatch])

  return {
    available,
    permissionState,
    location,
    locationRef,
    error,
    refreshPermission,
    requestOnce,
    startWatching,
    stopWatching,
  }
}
