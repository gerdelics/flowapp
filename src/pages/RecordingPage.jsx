import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGeolocation } from '../hooks/useGeolocation'
import { useRecordingSession } from '../hooks/useRecordingSession'
import { useSavedRoutes } from '../hooks/useSavedRoutes'
import { useSession } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import {
  RecordingMap,
  RecordToast,
  RoutePickerModal,
  SessionControls,
  TrafficLevelPanel,
} from '../components'

export default function RecordingPage({ isActive = true }) {
  const { settings, loading, reload, setMapZoomLevel } = useSettings()
  const geolocation = useGeolocation()
  const {
    routes: savedRoutes,
    cities: routeCities,
    filterByCity,
    reload: reloadRoutes,
  } = useSavedRoutes()

  const [autoEnabled, setAutoEnabled] = useState(false)
  const [startingSession, setStartingSession] = useState(false)
  const [stoppingSession, setStoppingSession] = useState(false)
  const [togglingPause, setTogglingPause] = useState(false)
  const [sessionNameDraft, setSessionNameDraft] = useState('')
  const [renamingSession, setRenamingSession] = useState(false)

  // Route overlay (planned route shown under the recorded path)
  const [routeCityFilter, setRouteCityFilter] = useState('')
  const [selectedOverlayRouteId, setSelectedOverlayRouteId] = useState('')
  const [overlayPoints, setOverlayPoints] = useState([])
  const [routePickerOpen, setRoutePickerOpen] = useState(false)
  const [routeCityComboboxOpen, setRouteCityComboboxOpen] = useState(false)

  const [mobileMapOpen, setMobileMapOpen] = useState(false)
  const [followCurrentLocation, setFollowCurrentLocation] = useState(true)
  const [isMdUp, setIsMdUp] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }
    return window.matchMedia('(min-width: 768px)').matches
  })

  const [recordToast, setRecordToast] = useState(null)
  const recordToastTimerRef = useRef(null)

  const recordedPathColor = settings?.recordedPathColor ?? '#e002c3'
  const plannedRoutePathColor = settings?.plannedRoutePathColor ?? '#ebfc01'
  const mapZoomLevel = settings?.mapZoomLevel ?? 14

  const activeProviders = useMemo(
    () => settings?.providers?.filter((provider) => provider.active) || [],
    [settings],
  )

  const session = useSession(activeProviders)
  const sessionActive = Boolean(session.session)
  const sessionPaused = Boolean(session.session?.pausedAt)
  const activeSessionId = session.session?.id
  const wakeLockEnabled = sessionActive && !sessionPaused
  const refreshActiveSession = session.refreshActiveSession

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
    }, 3000)
  }, [])

  const recording = useRecordingSession({
    session,
    geolocation,
    settings,
    isActive,
    autoEnabled,
    onRecordSaved: showRecordToast,
  })

  const {
    livePathPoints,
    nextRecordingIn,
    manualDue,
    wakeLockSupported,
    recordNow,
    startFreshPath,
    flushPath,
    clearPath,
  } = recording

  // Keep the (always-mounted) page fresh when navigating back to it.
  useEffect(() => {
    if (!isActive) {
      return undefined
    }

    const refreshTimer = window.setTimeout(() => {
      void reload()
      void reloadRoutes()
      void refreshActiveSession()
    }, 0)

    return () => clearTimeout(refreshTimer)
  }, [isActive, reload, reloadRoutes, refreshActiveSession])

  // Sync the planned-route overlay when the active session identity changes
  // (clearing it when no session, adopting the session's route when present —
  // but never wiping a selection the user made just before starting).
  const sessionForOverlayRef = useRef(session.session)
  useEffect(() => {
    sessionForOverlayRef.current = session.session
  })
  useEffect(() => {
    if (!activeSessionId) {
      const clear = setTimeout(() => {
        setSelectedOverlayRouteId('')
        setOverlayPoints([])
      }, 0)
      return () => clearTimeout(clear)
    }

    const current = sessionForOverlayRef.current
    const plannedRoutePoints = Array.isArray(current?.plannedRoutePoints)
      ? current.plannedRoutePoints
      : []

    if (plannedRoutePoints.length === 0) {
      return undefined
    }

    const sync = setTimeout(() => {
      setSelectedOverlayRouteId(current.plannedRouteId || '')
      setOverlayPoints(plannedRoutePoints)
    }, 0)
    return () => clearTimeout(sync)
  }, [activeSessionId])

  // Track the responsive breakpoint to avoid mounting two maps at once.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const media = window.matchMedia('(min-width: 768px)')
    const onChange = (event) => setIsMdUp(event.matches)
    media.addEventListener('change', onChange)

    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    return () => {
      if (recordToastTimerRef.current) {
        clearTimeout(recordToastTimerRef.current)
      }
    }
  }, [])

  const filteredRoutes = useMemo(
    () => filterByCity(routeCityFilter),
    [filterByCity, routeCityFilter],
  )

  const selectedOverlayRouteName = useMemo(() => {
    if (!selectedOverlayRouteId) {
      return ''
    }

    return savedRoutes.find((route) => route.id === selectedOverlayRouteId)?.name || ''
  }, [savedRoutes, selectedOverlayRouteId])

  const handleMapZoomChange = useCallback(
    (nextZoom) => {
      if (!Number.isFinite(nextZoom) || Math.round(nextZoom) === Math.round(mapZoomLevel)) {
        return
      }

      void setMapZoomLevel(Math.round(nextZoom))
    },
    [mapZoomLevel, setMapZoomLevel],
  )

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

  async function handleStartSession() {
    if (startingSession || session.session) {
      return
    }

    setStartingSession(true)
    try {
      const createdSession = await session.beginSession(sessionNameDraft)
      if (selectedOverlayRouteId && createdSession?.id) {
        await session.assignRouteToActiveSession(selectedOverlayRouteId, createdSession.id)
      }
      if (createdSession?.name) {
        setSessionNameDraft(createdSession.name)
      }
      setMobileMapOpen(true)
      setFollowCurrentLocation(true)
      startFreshPath()
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
    setAutoEnabled(false)
    try {
      await flushPath()
      await session.endSession()
      clearPath()
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
        await flushPath()
        await session.pauseActiveSession()
      }
    } finally {
      setTogglingPause(false)
    }
  }

  const recordButtonLabel = !sessionActive
    ? 'RECORD NOW'
    : sessionPaused
      ? 'PAUSED'
      : autoEnabled
        ? `Next Recording in ${nextRecordingIn}s`
        : manualDue
          ? 'RECORD NOW'
          : `Next Recording in ${nextRecordingIn}s`

  const gridColumns = useMemo(() => {
    if (!activeProviders.length) {
      return '1fr'
    }
    return `1.5fr repeat(${activeProviders.length}, minmax(130px, 1fr))`
  }, [activeProviders.length])

  if (loading || !settings) {
    return <p>Loading settings…</p>
  }

  const mapProps = {
    points: livePathPoints,
    overlayPoints,
    recordedPathColor,
    plannedRoutePathColor,
    currentLocation: geolocation.location,
    followCurrentLocation,
    onFollowChange: setFollowCurrentLocation,
    defaultZoom: mapZoomLevel,
    onZoomLevelChange: handleMapZoomChange,
    fitRouteKey: activeSessionId,
    onRefreshCurrentLocation: geolocation.requestOnce,
    selectedRouteName: selectedOverlayRouteName,
    onOpenRoutePicker: () => setRoutePickerOpen(true),
    onClearSelectedRoute: handleClearOverlayRoute,
  }

  return (
    <>
      <RecordToast record={recordToast} onDismiss={dismissRecordToast} />

      {!isMdUp ? (
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
              <RecordingMap className="h-[42vh] min-h-[250px] w-full rounded-lg" {...mapProps} />
            </div>
          </details>
        </section>
      ) : null}

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
              <RecordingMap
                className="h-[40dvh] min-h-[260px] w-full sm:h-[42dvh] md:h-full md:min-h-[320px]"
                {...mapProps}
              />
            </div>
          ) : null}

          <SessionControls
            sessionName={session.session ? session.session.name : 'No running session'}
            sessionActive={sessionActive}
            sessionPaused={sessionPaused}
            sessionNameDraft={sessionNameDraft}
            onNameDraftChange={setSessionNameDraft}
            onRename={handleRenameSession}
            renamingSession={renamingSession}
            startingSession={startingSession}
            onStart={handleStartSession}
            stoppingSession={stoppingSession}
            onStop={handleStopSession}
            togglingPause={togglingPause}
            onTogglePause={handleTogglePause}
            autoEnabled={autoEnabled}
            onToggleAuto={() => setAutoEnabled((prev) => !prev)}
            recordButtonLabel={recordButtonLabel}
            onRecordNow={recordNow}
            recordDisabled={!sessionActive || autoEnabled || sessionPaused}
            lastRecordedAt={session.lastRecordedAt}
            permissionState={geolocation.permissionState}
            hasFix={Boolean(geolocation.location)}
            wakeLockEnabled={wakeLockEnabled}
            wakeLockSupported={wakeLockSupported}
          />
        </section>

        <TrafficLevelPanel
          observerAssessment={session.observerAssessment}
          onObserverSelect={session.setObserverAssessment}
          providers={activeProviders}
          providerLevels={session.providerLevels}
          onProviderSelect={session.updateProviderLevel}
          gridColumns={gridColumns}
        />
      </div>
    </>
  )
}
