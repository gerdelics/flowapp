import { useCallback, useEffect, useRef, useState } from 'react'
import { useScreenWakeLock } from './useScreenWakeLock'
import { playNotificationBeep } from '../utils/audio'
import { touchSessionHeartbeat } from '../db'

function sanitizePath(path) {
  if (!Array.isArray(path)) {
    return []
  }

  return path.filter((point) => typeof point?.lat === 'number' && typeof point?.lon === 'number')
}

function pointFromLocation(location) {
  if (!location) {
    return null
  }

  return {
    lat: location.lat,
    lon: location.lon,
    accuracy: location.accuracy,
    timestamp: new Date().toISOString(),
    fixTimestamp: location.timestamp,
  }
}

function isDocumentHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/**
 * Owns the recording runtime: GPS path sampling, periodic autosave, the
 * record countdown, auto-record, screen wake lock and the warning beeps.
 *
 * Battery-relevant design choices:
 * - A single stable 1s sampler interval reads the latest fix from
 *   geolocation.locationRef, so it is created once per session instead of being
 *   torn down and recreated on every GPS fix.
 * - The high-accuracy GPS watch runs only while a session is active and not
 *   paused (and the hook pauses it when the tab is hidden via useGeolocation);
 *   otherwise a single requestOnce() provides a fix for the map.
 * - Sampling and the wake lock stop while paused or backgrounded.
 */
export function useRecordingSession({
  session,
  geolocation,
  settings,
  isActive,
  autoEnabled,
  onRecordSaved,
}) {
  const { requestOnce, startWatching, stopWatching, locationRef } = geolocation

  const pathBufferRef = useRef([])
  const [livePathPoints, setLivePathPoints] = useState([])
  const [manualSecondsLeft, setManualSecondsLeft] = useState(0)

  const previousCountdownRef = useRef(null)
  const manualOverdueSecondsRef = useRef(0)
  const manualExpiryBeepedRef = useRef(false)

  const sessionActive = Boolean(session.session)
  const sessionPaused = Boolean(session.session?.pausedAt)
  const activeSessionId = session.session?.id
  const intervalSec = settings?.sampleIntervalSec || 30
  const manualBeepEnabled = settings?.manualBeepEnabled ?? true
  const warningVibrationEnabled = settings?.warningVibrationEnabled ?? true
  const warningSoundEnabled = settings?.warningSoundEnabled ?? false
  const warningLeadSec = settings?.recordingWarningLeadSec ?? 5

  // A single shared countdown drives both manual and auto recording. Keeping one
  // source of truth means the value carries over when the user flips the auto
  // toggle mid-interval (switching at t-10 keeps ticking from 10 instead of
  // resetting to the full interval), in both directions.
  const secondsLeftRef = useRef(0)
  const setCountdown = useCallback((value) => {
    secondsLeftRef.current = value
    setManualSecondsLeft(value)
  }, [])

  // Refs mirror fast-changing values so the long-lived interval/effects below
  // can read them without listing them as dependencies (which would recreate
  // the timers every tick).
  const sessionPausedRef = useRef(sessionPaused)
  const sessionRef = useRef(session.session)
  const autoEnabledRef = useRef(autoEnabled)
  const intervalSecRef = useRef(intervalSec)
  const fireAutoRecordRef = useRef(null)
  useEffect(() => {
    sessionPausedRef.current = sessionPaused
  }, [sessionPaused])
  useEffect(() => {
    sessionRef.current = session.session
  })
  useEffect(() => {
    autoEnabledRef.current = autoEnabled
  }, [autoEnabled])
  useEffect(() => {
    intervalSecRef.current = intervalSec
  }, [intervalSec])
  useEffect(() => {
    fireAutoRecordRef.current = async () => {
      const saved = await session.recordNow(locationRef.current)
      onRecordSaved?.(saved, 'auto')
    }
  }, [session, locationRef, onRecordSaved])

  const saveActiveSessionPath = session.saveActiveSessionPath
  const refreshActiveSession = session.refreshActiveSession

  const { wakeLockSupported } = useScreenWakeLock(sessionActive && !sessionPaused)

  // Seed/reset the in-memory path buffer when the active session *identity*
  // changes (start, stop, or loading an existing session). Keying on the id —
  // not the whole session object — keeps the buffer authoritative across
  // pause/resume/rename so recent points are never dropped.
  useEffect(() => {
    if (!activeSessionId) {
      pathBufferRef.current = []
      const reset = setTimeout(() => setLivePathPoints([]), 0)
      return () => clearTimeout(reset)
    }

    const current = sessionRef.current
    pathBufferRef.current = sanitizePath(current?.path)
    const snapshot = [...pathBufferRef.current]
    const seed = setTimeout(() => setLivePathPoints(snapshot), 0)
    return () => clearTimeout(seed)
  }, [activeSessionId])

  // Ask for one fix whenever the page becomes active so the map can render the
  // current position even before recording starts.
  useEffect(() => {
    if (!isActive) {
      return
    }

    requestOnce().catch(() => {
      // Non-blocking: a fix may arrive later.
    })
  }, [isActive, requestOnce])

  // Keep the GPS watch running whenever this page is active so the map marker
  // updates continuously regardless of whether a session is in progress.
  // useGeolocation automatically pauses the watch when the tab is hidden.
  useEffect(() => {
    if (!isActive) return undefined

    startWatching()
    return () => stopWatching()
  }, [isActive, startWatching, stopWatching])

  // Single stable sampler: one point per second from the freshest fix.
  useEffect(() => {
    if (!sessionActive) {
      return undefined
    }

    const sampler = setInterval(() => {
      if (sessionPausedRef.current || isDocumentHidden()) {
        return
      }

      const point = pointFromLocation(locationRef.current)
      if (!point) {
        return
      }

      pathBufferRef.current.push(point)
      setLivePathPoints((prev) => [...prev, point])
    }, 1000)

    return () => clearInterval(sampler)
  }, [sessionActive, locationRef])

  // Persist the buffer to IndexedDB every 10s (write-only; see useSession).
  useEffect(() => {
    if (!activeSessionId) {
      return undefined
    }

    const saver = setInterval(() => {
      saveActiveSessionPath(pathBufferRef.current)
    }, 10000)

    return () => clearInterval(saver)
  }, [activeSessionId, saveActiveSessionPath])

  // Liveness heartbeat every 5s so crash recovery can tell how long ago the
  // session was last alive. Runs even while paused (the runtime is still up);
  // it is a cheap, non-indexed write that triggers no React re-render.
  useEffect(() => {
    if (!activeSessionId) {
      return undefined
    }

    void touchSessionHeartbeat(activeSessionId)
    const beat = setInterval(() => {
      void touchSessionHeartbeat(activeSessionId)
    }, 5000)

    return () => clearInterval(beat)
  }, [activeSessionId])

  // Initialise the shared countdown when a session starts / interval changes.
  useEffect(() => {
    const target = activeSessionId ? intervalSec : 0
    const timer = setTimeout(() => setCountdown(target), 0)
    return () => clearTimeout(timer)
  }, [activeSessionId, intervalSec, setCountdown])

  // Shared countdown tick — one stable interval; reads pause/mode from refs.
  // In auto mode reaching zero fires a recording and rolls over to the next
  // interval; in manual mode it parks at zero (overdue) until the user records.
  useEffect(() => {
    if (!activeSessionId) {
      return undefined
    }

    const timer = setInterval(() => {
      if (sessionPausedRef.current) {
        return
      }

      const prev = secondsLeftRef.current
      if (prev <= 1) {
        if (autoEnabledRef.current) {
          setCountdown(intervalSecRef.current)
          void fireAutoRecordRef.current?.()
        } else {
          setCountdown(0)
        }
      } else {
        setCountdown(prev - 1)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [activeSessionId, setCountdown])

  const nextRecordingIn = manualSecondsLeft
  const manualDue = sessionActive && !sessionPaused && !autoEnabled && manualSecondsLeft <= 0

  // Warning beep/vibration as the auto-record countdown nears zero.
  useEffect(() => {
    if (!sessionActive || sessionPaused || !autoEnabled) {
      previousCountdownRef.current = null
      return
    }

    const effectiveWarningLeadSec = Math.max(1, Math.min(warningLeadSec, intervalSec - 1))
    const previous = previousCountdownRef.current
    const reachedWarning =
      typeof previous === 'number' &&
      previous > effectiveWarningLeadSec &&
      nextRecordingIn === effectiveWarningLeadSec

    if (reachedWarning) {
      if (
        warningVibrationEnabled &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(180)
      }
      if (warningSoundEnabled) {
        playNotificationBeep()
      }
    }

    previousCountdownRef.current = nextRecordingIn
  }, [
    nextRecordingIn,
    sessionActive,
    sessionPaused,
    autoEnabled,
    intervalSec,
    warningLeadSec,
    warningSoundEnabled,
    warningVibrationEnabled,
  ])

  // Recurring reminder while a manual recording is overdue.
  useEffect(() => {
    if (!sessionActive || sessionPaused || autoEnabled || manualSecondsLeft > 0) {
      manualOverdueSecondsRef.current = 0
      return undefined
    }

    const reminderIntervalSec = Math.max(1, warningLeadSec)

    const timer = setInterval(() => {
      manualOverdueSecondsRef.current += 1

      if (manualOverdueSecondsRef.current % reminderIntervalSec !== 0) {
        return
      }

      if (
        warningVibrationEnabled &&
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(180)
      }
      if (warningSoundEnabled) {
        playNotificationBeep()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [
    sessionActive,
    sessionPaused,
    autoEnabled,
    manualSecondsLeft,
    warningLeadSec,
    warningVibrationEnabled,
    warningSoundEnabled,
  ])

  // Single beep the moment a manual recording becomes due.
  useEffect(() => {
    if (!sessionActive || sessionPaused || autoEnabled || manualSecondsLeft > 0) {
      manualExpiryBeepedRef.current = false
      return
    }

    if (manualBeepEnabled && !manualExpiryBeepedRef.current) {
      playNotificationBeep()
      manualExpiryBeepedRef.current = true
    }
  }, [sessionActive, sessionPaused, autoEnabled, manualSecondsLeft, manualBeepEnabled])

  const seedPathWithCurrentLocation = useCallback(() => {
    const point = pointFromLocation(locationRef.current)
    if (!point) {
      return
    }

    pathBufferRef.current.push(point)
    setLivePathPoints((prev) => [...prev, point])
  }, [locationRef])

  const startFreshPath = useCallback(() => {
    pathBufferRef.current = []
    setLivePathPoints([])
    seedPathWithCurrentLocation()
    setCountdown(intervalSec)
    manualExpiryBeepedRef.current = false
  }, [intervalSec, seedPathWithCurrentLocation, setCountdown])

  const flushPath = useCallback(async () => {
    await saveActiveSessionPath(pathBufferRef.current)
  }, [saveActiveSessionPath])

  const clearPath = useCallback(() => {
    pathBufferRef.current = []
    setLivePathPoints([])
    setCountdown(0)
    manualExpiryBeepedRef.current = false
  }, [setCountdown])

  const recordNow = useCallback(async () => {
    if (!sessionActive || autoEnabled || sessionPaused) {
      return null
    }

    setCountdown(intervalSec)
    manualExpiryBeepedRef.current = false
    const saved = await session.recordNow(locationRef.current)
    onRecordSaved?.(saved, 'manual')
    manualOverdueSecondsRef.current = 0
    return saved
  }, [
    autoEnabled,
    intervalSec,
    locationRef,
    onRecordSaved,
    session,
    sessionActive,
    sessionPaused,
    setCountdown,
  ])

  return {
    livePathPoints,
    manualSecondsLeft,
    nextRecordingIn,
    manualDue,
    wakeLockSupported,
    recordNow,
    seedPathWithCurrentLocation,
    startFreshPath,
    flushPath,
    clearPath,
    refreshActiveSession,
  }
}
