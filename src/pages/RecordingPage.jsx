import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAutoRecord } from '../hooks/useAutoRecord'
import { useGeolocation } from '../hooks/useGeolocation'
import { useScreenWakeLock } from '../hooks/useScreenWakeLock'
import { useSession } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import {
  RecordToast,
  RouteMap,
  RouteOverlayLoader,
  RoutePickerModal,
  TrafficLevelSelector,
} from '../components'
import { db } from '../db'
import { playNotificationBeep } from '../utils/audio'

function sanitizePath(path) {
  if (!Array.isArray(path)) {
    return []
  }

  return path.filter((point) => typeof point?.lat === 'number' && typeof point?.lon === 'number')
}

export default function RecordingPage() {
  const { settings, loading } = useSettings()
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [manualSecondsLeft, setManualSecondsLeft] = useState(0)
  const [startingSession, setStartingSession] = useState(false)
  const [stoppingSession, setStoppingSession] = useState(false)
  const [sessionNameDraft, setSessionNameDraft] = useState('')
  const [renamingSession, setRenamingSession] = useState(false)
  const geolocation = useGeolocation()
  const { requestOnce, startWatching, stopWatching } = geolocation
  const manualExpiryBeepedRef = useRef(false)
  const pathBufferRef = useRef([])
  const [livePathPoints, setLivePathPoints] = useState([])

  // Route overlay state
  const [savedRoutes, setSavedRoutes] = useState([])
  const [routeCityFilter, setRouteCityFilter] = useState('')
  const [selectedOverlayRouteId, setSelectedOverlayRouteId] = useState('')
  const [overlayPoints, setOverlayPoints] = useState([])
  const [routePickerOpen, setRoutePickerOpen] = useState(false)
  const [routeCityComboboxOpen, setRouteCityComboboxOpen] = useState(false)
  const [mobileMapOpen, setMobileMapOpen] = useState(false)
  const [followCurrentLocation, setFollowCurrentLocation] = useState(false)
  const [isMdUp, setIsMdUp] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.matchMedia('(min-width: 640px)').matches
  })
  const [togglingPause, setTogglingPause] = useState(false)
  const [recordToast, setRecordToast] = useState(null)
  const recordToastTimerRef = useRef(null)
  const manualBeepEnabled = settings?.manualBeepEnabled ?? true

  const activeProviders = useMemo(
    () => settings?.providers?.filter((provider) => provider.active) || [],
    [settings],
  )

  const session = useSession(activeProviders)
  const sessionActive = Boolean(session.session)
  const sessionPaused = Boolean(session.session?.pausedAt)
  const wakeLockEnabled = sessionActive && !sessionPaused
  const activeSessionId = session.session?.id
  const saveActiveSessionPath = session.saveActiveSessionPath
  const { wakeLockSupported } = useScreenWakeLock(wakeLockEnabled)

  // Load saved routes from DB
  useEffect(() => {
    db.routes.orderBy('city').toArray().then(setSavedRoutes)
  }, [])

  // Unique cities from saved routes
  const routeCities = useMemo(() => {
    const set = new Set(savedRoutes.map((r) => r.city))
    return Array.from(set).sort()
  }, [savedRoutes])

  // Routes filtered by selected city
  const filteredRoutes = useMemo(() => {
    if (!routeCityFilter) return savedRoutes
    return savedRoutes.filter((r) => r.city === routeCityFilter)
  }, [savedRoutes, routeCityFilter])

  function handleCityFilterChange(city) {
    setRouteCityFilter(city)
    setRouteCityComboboxOpen(false)
  }

  function handleOverlayRouteChange(id) {
    setSelectedOverlayRouteId(id)
    if (!id) {
      setOverlayPoints([])
      if (session.session) {
        session.assignRouteToActiveSession(null)
      }
      setRouteCityComboboxOpen(false)
      return
    }
    const route = savedRoutes.find((r) => r.id === id)
    setOverlayPoints(route?.points ?? [])
    if (session.session) {
      session.assignRouteToActiveSession(id)
    }
    setRouteCityComboboxOpen(false)
  }

  function handleClearOverlayRoute() {
    setSelectedOverlayRouteId('')
    setOverlayPoints([])
    setRouteCityFilter('')
    setRouteCityComboboxOpen(false)
    if (session.session) {
      session.assignRouteToActiveSession(null)
    }
  }

  function closeRoutePicker() {
    setRoutePickerOpen(false)
    setRouteCityComboboxOpen(false)
  }

  const dismissRecordToast = useCallback(() => {
    if (recordToastTimerRef.current) {
      clearTimeout(recordToastTimerRef.current)
      recordToastTimerRef.current = null
    }

    setRecordToast(null)
  }, [])

  const showRecordToast = useCallback((savedRecord, channel) => {
    if (!savedRecord) {
      return
    }

    if (recordToastTimerRef.current) {
      clearTimeout(recordToastTimerRef.current)
    }

    setRecordToast({
      channel,
      timestamp: savedRecord.timestamp,
      observerAssessment: savedRecord.observerAssessment,
      providers: Array.isArray(savedRecord.providers) ? savedRecord.providers : [],
    })

    recordToastTimerRef.current = window.setTimeout(() => {
      setRecordToast(null)
      recordToastTimerRef.current = null
    }, 5500)
  }, [])

  const handleFollowLost = useCallback(() => {
    setFollowCurrentLocation(false)
  }, [])

  const handleRequestFollow = useCallback(() => {
    if (!sessionActive || sessionPaused) {
      return
    }
    setFollowCurrentLocation(true)
  }, [sessionActive, sessionPaused])

  useEffect(() => {
    return () => {
      if (recordToastTimerRef.current) {
        clearTimeout(recordToastTimerRef.current)
      }
    }
  }, [])

  const autoRecord = useAutoRecord({
    enabled: autoEnabled && !!session.session && !session.session?.pausedAt,
    intervalSec: settings?.sampleIntervalSec || 30,
    onTick: async () => {
      const saved = await session.recordNow(geolocation.location)
      showRecordToast(saved, 'auto')
      setManualSecondsLeft(settings?.sampleIntervalSec || 30)
    },
  })

  useEffect(() => {
    requestOnce().catch(() => {
      // Non-blocking: location can become available later.
    })
  }, [requestOnce])

  useEffect(() => {
    if (!sessionActive) {
      stopWatching()
      return undefined
    }

    requestOnce()
      .then(() => {
        startWatching()
      })
      .catch(() => {
        // Non-blocking geolocation failure.
      })

    return () => {
      stopWatching()
    }
  }, [requestOnce, sessionActive, startWatching, stopWatching])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const media = window.matchMedia('(min-width: 640px)')
    const onChange = (event) => {
      setIsMdUp(event.matches)
    }

    media.addEventListener('change', onChange)

    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    if (!session.session) {
      pathBufferRef.current = []
      const bump = setTimeout(() => {
        setLivePathPoints([])
      }, 0)
      return () => clearTimeout(bump)
    }

    pathBufferRef.current = sanitizePath(session.session.path)

    const plannedRoutePoints = Array.isArray(session.session.plannedRoutePoints)
      ? session.session.plannedRoutePoints
      : []

    const syncPlannedRouteState = setTimeout(() => {
      if (plannedRoutePoints.length > 0) {
        setSelectedOverlayRouteId(session.session.plannedRouteId || '')
        setOverlayPoints(plannedRoutePoints)
      } else {
        setSelectedOverlayRouteId('')
        setOverlayPoints([])
      }
    }, 0)

    const bump = setTimeout(() => {
      setLivePathPoints([...pathBufferRef.current])
    }, 0)
    return () => {
      clearTimeout(syncPlannedRouteState)
      clearTimeout(bump)
    }
  }, [session.session])

  useEffect(() => {
    if (!session.session) {
      return undefined
    }

    const sampler = setInterval(() => {
      if (!geolocation.location || session.session?.pausedAt) {
        return
      }

      const point = {
        lat: geolocation.location.lat,
        lon: geolocation.location.lon,
        accuracy: geolocation.location.accuracy,
        timestamp: new Date().toISOString(),
        fixTimestamp: geolocation.location.timestamp,
      }

      pathBufferRef.current.push(point)
      setLivePathPoints((prev) => [...prev, point])
    }, 1000)

    return () => clearInterval(sampler)
  }, [geolocation.location, session.session])

  useEffect(() => {
    if (!activeSessionId) {
      return undefined
    }

    const saver = setInterval(() => {
      saveActiveSessionPath(pathBufferRef.current)
    }, 10000)

    return () => clearInterval(saver)
  }, [activeSessionId, saveActiveSessionPath])

  useEffect(() => {
    if (!session.session) {
      const resetTimer = setTimeout(() => {
        setManualSecondsLeft(0)
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    const intervalSec = settings?.sampleIntervalSec || 30
    const initTimer = setTimeout(() => {
      setManualSecondsLeft(intervalSec)
    }, 0)

    const timer = setInterval(() => {
      setManualSecondsLeft((prev) => {
        if (session.session?.pausedAt) {
          return prev
        }
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearTimeout(initTimer)
      clearInterval(timer)
    }
  }, [session.session, settings?.sampleIntervalSec])

  async function handleStartSession() {
    if (startingSession || session.session) {
      return
    }

    setStartingSession(true)
    try {
      const createdSession = await session.beginSession(sessionNameDraft)
      if (selectedOverlayRouteId && createdSession?.id) {
        await session.assignRouteToActiveSession(selectedOverlayRouteId)
      }
      if (createdSession?.name) {
        setSessionNameDraft(createdSession.name)
      }
      setMobileMapOpen(true)
      setFollowCurrentLocation(true)
      pathBufferRef.current = []

      if (geolocation.location) {
        const point = {
          lat: geolocation.location.lat,
          lon: geolocation.location.lon,
          accuracy: geolocation.location.accuracy,
          timestamp: new Date().toISOString(),
          fixTimestamp: geolocation.location.timestamp,
        }
        pathBufferRef.current.push(point)
        setLivePathPoints((prev) => [...prev, point])
      }

      setManualSecondsLeft(settings?.sampleIntervalSec || 30)
      manualExpiryBeepedRef.current = false
    } finally {
      setStartingSession(false)
    }
  }

  async function handleRenameSession() {
    if (!session.session || renamingSession) {
      return
    }

    setRenamingSession(true)
    try {
      const renamed = await session.renameActiveSession(sessionNameDraft)
      if (renamed?.name) {
        setSessionNameDraft(renamed.name)
      }
    } finally {
      setRenamingSession(false)
    }
  }

  async function handleStopSession() {
    if (stoppingSession || !session.session) {
      return
    }

    setStoppingSession(true)
    stopWatching()
    setAutoEnabled(false)
    try {
      await session.saveActiveSessionPath(pathBufferRef.current)
      await session.endSession()
      setManualSecondsLeft(0)
      manualExpiryBeepedRef.current = false
      pathBufferRef.current = []
      setLivePathPoints([])
      setFollowCurrentLocation(false)
      setMobileMapOpen(false)
    } finally {
      setStoppingSession(false)
    }
  }

  async function handleTogglePause() {
    if (!session.session || togglingPause) {
      return
    }

    setTogglingPause(true)
    try {
      if (session.session.pausedAt) {
        await session.resumeActiveSession()
      } else {
        setFollowCurrentLocation(false)
        await session.pauseActiveSession()
      }
    } finally {
      setTogglingPause(false)
    }
  }

  async function handleRecordNow() {
    if (!sessionActive || autoEnabled || sessionPaused) {
      return
    }

    const intervalSec = settings?.sampleIntervalSec || 30
    setManualSecondsLeft(intervalSec)
    manualExpiryBeepedRef.current = false
    const saved = await session.recordNow(geolocation.location)
    showRecordToast(saved, 'manual')
  }

  const nextRecordingIn = autoEnabled ? autoRecord.secondsLeft : manualSecondsLeft
  const manualDue = sessionActive && !sessionPaused && !autoEnabled && manualSecondsLeft <= 0
  const recordButtonLabel = !sessionActive
    ? 'RECORD NOW'
    : sessionPaused
      ? 'PAUSED'
    : autoEnabled
      ? `Next Recording in ${nextRecordingIn}s`
      : manualDue
        ? 'RECORD NOW'
        : `Next Recording in ${nextRecordingIn}s`

  useEffect(() => {
    if (!sessionActive || sessionPaused || autoEnabled || manualSecondsLeft > 0) {
      manualExpiryBeepedRef.current = false
      return
    }

    if (manualBeepEnabled && !manualExpiryBeepedRef.current) {
      playNotificationBeep()
      manualExpiryBeepedRef.current = true
    }
  }, [
    sessionActive,
    sessionPaused,
    autoEnabled,
    manualSecondsLeft,
    manualBeepEnabled,
  ])

  const gridColumns = useMemo(() => {
    if (!activeProviders.length) {
      return '1fr'
    }
    return `1.5fr repeat(${activeProviders.length}, minmax(130px, 1fr))`
  }, [activeProviders.length])

  if (loading || !settings) {
    return <p>Loading settings…</p>
  }

  return (
    <>
      <RecordToast record={recordToast} onDismiss={dismissRecordToast} />

      <section className="mb-4 md:hidden">
        <details
          className="group overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
          open={mobileMapOpen}
          onToggle={(event) => setMobileMapOpen(event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Recording map
              </p>
              <p className="truncate text-sm font-bold text-slate-100">
                {session.session ? session.session.name : 'No running session'}
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
              <span>{mobileMapOpen ? 'Hide' : 'Show'}</span>
              <span className="transition group-open:rotate-180" aria-hidden="true">
                ▾
              </span>
            </span>
          </summary>

          <div className="border-t border-slate-700 p-3">
            <RouteMap
              className="h-[42vh] min-h-[250px] w-full rounded-lg"
              points={livePathPoints}
              overlayPoints={overlayPoints}
              currentLocation={geolocation.location}
              followCurrent={followCurrentLocation}
              isFollowing={followCurrentLocation}
              onFollowLost={handleFollowLost}
              onRequestFollow={handleRequestFollow}
              showCurrentMarker
              fitRoute={false}
              fitRouteKey={session.session?.id}
            />
          </div>
        </details>
      </section>

      {routePickerOpen ? (
        <RoutePickerModal
          open={routePickerOpen}
          title="Select route"
          subtitle="Choose a city and then a route to load."
          selectedCity={routeCityFilter}
          onSelectCity={handleCityFilterChange}
          cityComboboxOpen={routeCityComboboxOpen}
          onToggleCityCombobox={() => setRouteCityComboboxOpen((prev) => !prev)}
          cities={routeCities}
          routes={filteredRoutes}
          selectedRouteId={selectedOverlayRouteId}
          onDone={handleOverlayRouteChange}
          onClose={closeRoutePicker}
        />
      ) : null}

      <div className="grid min-h-[calc(100dvh-9.5rem)] gap-3 md:h-[calc(100dvh-9.5rem)] md:min-h-[620px] md:grid-rows-[2fr_1fr]">
      <section className="grid min-h-0 gap-3 md:grid-cols-[2fr_1fr]">
        {isMdUp ? (
          <div className="min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <RouteMap
              className="h-[40dvh] min-h-[260px] w-full sm:h-[42dvh] md:h-full md:min-h-[320px]"
              points={livePathPoints}
              overlayPoints={overlayPoints}
              currentLocation={geolocation.location}
              followCurrent={followCurrentLocation}
              isFollowing={followCurrentLocation}
              onFollowLost={handleFollowLost}
              onRequestFollow={handleRequestFollow}
              showCurrentMarker
              fitRoute={false}
              fitRouteKey={session.session?.id}
            />
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-400">Active session</p>
          <p className="mt-1 text-xl font-bold">
            {session.session ? session.session.name : 'No running session'}
          </p>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={sessionNameDraft}
              onChange={(e) => setSessionNameDraft(e.target.value)}
              placeholder="Session name (before start or during recording)"
              className="min-h-11 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            />
            {session.session ? (
              <button
                type="button"
                onClick={handleRenameSession}
                disabled={renamingSession || !sessionNameDraft.trim()}
                className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {renamingSession ? 'Saving…' : 'Rename'}
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2">
            {!session.session ? (
              <button
                type="button"
                disabled={startingSession}
                onClick={handleStartSession}
                className="min-h-12 rounded-lg bg-emerald-600 px-4 py-2 text-base font-bold disabled:opacity-50"
              >
                {startingSession ? 'STARTING…' : 'START SESSION'}
              </button>
            ) : (
              <button
                type="button"
                disabled={stoppingSession}
                onClick={handleStopSession}
                className="min-h-12 rounded-lg bg-red-600 px-4 py-2 text-base font-bold disabled:opacity-50"
              >
                {stoppingSession ? 'STOPPING…' : 'STOP SESSION'}
              </button>
            )}

            {session.session ? (
              <button
                type="button"
                disabled={togglingPause}
                onClick={handleTogglePause}
                className="min-h-12 rounded-lg bg-amber-500 px-4 py-2 text-base font-bold text-slate-950 disabled:opacity-50"
              >
                {togglingPause
                  ? sessionPaused
                    ? 'RESUMING…'
                    : 'PAUSING…'
                  : sessionPaused
                    ? 'RESUME SESSION'
                    : 'PAUSE SESSION'}
              </button>
            ) : null}

            <button
              type="button"
              disabled={!session.session}
              onClick={() => setAutoEnabled((prev) => !prev)}
              className="min-h-12 rounded-lg bg-slate-700 px-4 py-2 text-base font-bold disabled:opacity-50"
            >
              Auto-record: {autoEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              disabled={!sessionActive || autoEnabled || sessionPaused}
              onClick={handleRecordNow}
              className="min-h-12 rounded-lg bg-cyan-500 px-4 py-2 text-base font-bold text-slate-950 disabled:opacity-50"
            >
              {recordButtonLabel}
            </button>
          </div>

          <p className="mt-3 text-sm text-slate-400">
            Last recorded:{' '}
            {session.lastRecordedAt ? new Date(session.lastRecordedAt).toLocaleString() : '—'}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            GPS: {geolocation.permissionState} {geolocation.location ? '• fix available' : '• no fix'}
          </p>
          {wakeLockEnabled && !wakeLockSupported ? (
            <p className="mt-1 text-xs text-amber-300">
              Screen wake lock is not supported in this browser. The display may dim during recording.
            </p>
          ) : null}
          {sessionPaused ? (
            <p className="mt-1 text-sm font-semibold text-amber-300">Session is paused.</p>
          ) : null}

          <RouteOverlayLoader
            savedRoutes={savedRoutes}
            selectedOverlayRouteId={selectedOverlayRouteId}
            onOpenPicker={() => setRoutePickerOpen(true)}
            onClearOverlayRoute={handleClearOverlayRoute}
          />
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 p-2">
        <div className="grid grid-cols-1 gap-2 md:hidden sm:grid-cols-2">
          <TrafficLevelSelector
            title="User Perception"
            value={session.observerAssessment}
            onSelect={session.setObserverAssessment}
            compact
          />

          {activeProviders.map((provider) => (
            <TrafficLevelSelector
              key={provider.id}
              title={provider.name}
              iconUrl={provider.iconUrl}
              value={session.providerLevels[provider.name] || 'medium'}
              onSelect={(level) => session.updateProviderLevel(provider.name, level)}
              compact
            />
          ))}
        </div>

        <div className="hidden h-full gap-2 md:grid" style={{ gridTemplateColumns: gridColumns }}>
          <TrafficLevelSelector
            title="User Perception"
            value={session.observerAssessment}
            onSelect={session.setObserverAssessment}
          />

          {activeProviders.map((provider) => (
            <TrafficLevelSelector
              key={provider.id}
              title={provider.name}
              iconUrl={provider.iconUrl}
              value={session.providerLevels[provider.name] || 'medium'}
              onSelect={(level) => session.updateProviderLevel(provider.name, level)}
            />
          ))}
        </div>
      </section>
      </div>
    </>
  )
}
