import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  const [permissionState, setPermissionState] = useState('unknown')
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)

  const available = useMemo(
    () => typeof navigator !== 'undefined' && !!navigator.geolocation,
    [],
  )

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
          setLocation(normalized)
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
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        },
      )
    })
  }, [available])

  const startWatching = useCallback(() => {
    if (!available || watchIdRef.current !== null) {
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation(normalizePosition(position))
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
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      },
    )
  }, [available])

  const stopWatching = useCallback(() => {
    if (!available || watchIdRef.current === null) {
      return
    }

    navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
  }, [available])

  return {
    available,
    permissionState,
    location,
    error,
    refreshPermission,
    requestOnce,
    startWatching,
    stopWatching,
  }
}
