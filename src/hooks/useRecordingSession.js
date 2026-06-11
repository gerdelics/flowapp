import { useCallback, useEffect, useRef, useState } from 'react'
import { useAutoRecord } from './useAutoRecord'
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

  // Refs mirror fast-changing values so the long-lived interval/effects below
  // can read them without listing them as dependencies (which would recreate
  // the timers every tick).
  const sessionPausedRef = useRef(sessionPaused)
  const sessionRef = useRef(session.session)
  useEffect(() => {
    sessionPausedRef.current = sessionPaused
  }, [sessionPaused])
  useEffect(() => {
    sessionRef.current = session.session
  })

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

  // Continuous high-accuracy watch only while actively recording (and not
  // paused). It keeps running across in-app navigation so a session started by
  // the user is never silently dropped; useGeolocation still pauses it whenever
  // the tab is hidden. Outside an active session the map relies on the one-shot
  // fix above instead of pinning the GPS radio on.
  useEffect(() => {
    if (!sessionActive || sessionPaused) {
      stopWatching()
      return undefined
    }

    startWatching()

    return () => {
      stopWatching()
    }
  }, [sessionActive, sessionPaused, startWatching, stopWatching])

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

  // Initialise the manual countdown when a session starts / interval changes.
  useEffect(() => {
    const target = activeSessionId ? intervalSec : 0
    const timer = setTimeout(() => setManualSecondsLeft(target), 0)
    return () => clearTimeout(timer)
  }, [activeSessionId, intervalSec])

  // Manual countdown tick — one stable interval; reads pause state from a ref.
  useEffect(() => {
    if (!activeSessionId) {
      return undefined
    }

    const timer = setInterval(() => {
      setManualSecondsLeft((prev) => {
        if (sessionPausedRef.current) {
          return prev
        }
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [activeSessionId])

  const autoRecord = useAutoRecord({
    enabled: autoEnabled && sessionActive && !sessionPaused,
    intervalSec,
    onTick: async () => {
      const saved = await session.recordNow(locationRef.current)
      onRecordSaved?.(saved, 'auto')
      setManualSecondsLeft(intervalSec)
    },
  })

  const nextRecordingIn = autoEnabled ? autoRecord.secondsLeft : manualSecondsLeft
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
    setManualSecondsLeft(intervalSec)
    manualExpiryBeepedRef.current = false
  }, [intervalSec, seedPathWithCurrentLocation])

  const flushPath = useCallback(async () => {
    await saveActiveSessionPath(pathBufferRef.current)
  }, [saveActiveSessionPath])

  const clearPath = useCallback(() => {
    pathBufferRef.current = []
    setLivePathPoints([])
    setManualSecondsLeft(0)
    manualExpiryBeepedRef.current = false
  }, [])

  const recordNow = useCallback(async () => {
    if (!sessionActive || autoEnabled || sessionPaused) {
      return null
    }

    setManualSecondsLeft(intervalSec)
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
