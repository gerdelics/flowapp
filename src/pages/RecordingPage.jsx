import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBatteryStatus } from '../hooks/useBatteryStatus'
import { useGeolocation } from '../hooks/useGeolocation'
import { useGpsHealth } from '../hooks/useGpsHealth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useRecordingSession } from '../hooks/useRecordingSession'
import { useSavedRoutes } from '../hooks/useSavedRoutes'
import { useSession } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import {
  ConfirmDialog,
  CrashRecoveryModal,
  RecordingMap,
  RecordToast,
  RoutePickerModal,
  SessionBar,
  SystemStatusBanner,
  TrafficLevelPanel,
} from '../components'

const CONFIRM_CONFIG = {
  start: {
    title: 'Start recording?',
    message: 'This begins a new recording session and starts collecting GPS points.',
    confirmLabel: 'Start',
    tone: 'emerald',
  },
  pause: {
    title: 'Pause recording?',
    message: 'GPS sampling stops until you resume. Everything recorded so far is kept.',
    confirmLabel: 'Pause',
    tone: 'amber',
  },
  resume: {
    title: 'Resume recording?',
    message: 'GPS sampling restarts and points are collected again.',
    confirmLabel: 'Resume',
    tone: 'emerald',
  },
  stop: {
    title: 'Stop recording?',
    message: 'This ends the session and saves it. You can review it later under Sessions.',
    confirmLabel: 'Stop',
    tone: 'red',
  },
}

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
  const [pendingConfirm, setPendingConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  const [routeCityFilter, setRouteCityFilter] = useState('')
  const [selectedOverlayRouteId, setSelectedOverlayRouteId] = useState('')
  const [overlayPoints, setOverlayPoints] = useState([])
  const [routePickerOpen, setRoutePickerOpen] = useState(false)
  const [routeCityComboboxOpen, setRouteCityComboboxOpen] = useState(false)

  const [followCurrentLocation, setFollowCurrentLocation] = useState(true)
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(orientation: landscape)').matches
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

  const online = useOnlineStatus()
  const battery = useBatteryStatus()
  const gpsHealth = useGpsHealth(geolocation, sessionActive && !sessionPaused)

  const dismissRecordToast = useCallback(() => {
    if (recordToastTimerRef.current) {
      clearTimeout(recordToastTimerRef.current)
      recordToastTimerRef.current = null
    }
    setRecordToast(null)
  }, [])

  const showRecordToast = useCallback((savedRecord, channel) => {
    if (!savedRecord) return

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

  const { livePathPoints, nextRecordingIn, manualDue, wakeLockSupported, recordNow, startFreshPath, flushPath, clearPath } = recording

  useEffect(() => {
    if (!isActive) return undefined

    const refreshTimer = window.setTimeout(() => {
      void reload()
      void reloadRoutes()
      void refreshActiveSession()
    }, 0)

    return () => clearTimeout(refreshTimer)
  }, [isActive, reload, reloadRoutes, refreshActiveSession])

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

    if (plannedRoutePoints.length === 0) return undefined

    const sync = setTimeout(() => {
      setSelectedOverlayRouteId(current.plannedRouteId || '')
      setOverlayPoints(plannedRoutePoints)
    }, 0)
    return () => clearTimeout(sync)
  }, [activeSessionId])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const media = window.matchMedia('(orientation: landscape)')
    const onChange = (e) => setIsLandscape(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    return () => {
      if (recordToastTimerRef.current) clearTimeout(recordToastTimerRef.current)
    }
  }, [])

  const filteredRoutes = useMemo(
    () => filterByCity(routeCityFilter),
    [filterByCity, routeCityFilter],
  )

  const selectedOverlayRouteName = useMemo(() => {
    if (!selectedOverlayRouteId) return ''
    return savedRoutes.find((route) => route.id === selectedOverlayRouteId)?.name || ''
  }, [savedRoutes, selectedOverlayRouteId])

  const handleMapZoomChange = useCallback(
    (nextZoom) => {
      if (!Number.isFinite(nextZoom) || Math.round(nextZoom) === Math.round(mapZoomLevel)) return
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
      if (session.session) session.assignRouteToActiveSession(null)
      setRouteCityComboboxOpen(false)
      return
    }

    const route = savedRoutes.find((r) => r.id === id)
    setOverlayPoints(route?.points ?? [])
    if (session.session) session.assignRouteToActiveSession(id)
    setRouteCityComboboxOpen(false)
  }

  function handleClearOverlayRoute() {
    setSelectedOverlayRouteId('')
    setOverlayPoints([])
    setRouteCityFilter('')
    setRouteCityComboboxOpen(false)
    if (session.session) session.assignRouteToActiveSession(null)
  }

  function closeRoutePicker() {
    setRoutePickerOpen(false)
    setRouteCityComboboxOpen(false)
  }

  async function handleStartSession() {
    if (startingSession || session.session) return

    setStartingSession(true)
    try {
      const createdSession = await session.beginSession(sessionNameDraft)
      if (selectedOverlayRouteId && createdSession?.id) {
        await session.assignRouteToActiveSession(selectedOverlayRouteId, createdSession.id)
      }
      if (createdSession?.name) setSessionNameDraft(createdSession.name)
      setFollowCurrentLocation(true)
      startFreshPath()
    } finally {
      setStartingSession(false)
    }
  }

  async function handleStopSession() {
    if (stoppingSession || !session.session) return

    setStoppingSession(true)
    setAutoEnabled(false)
    try {
      await flushPath()
      await session.endSession()
      clearPath()
    } finally {
      setStoppingSession(false)
    }
  }

  async function handleTogglePause() {
    if (!session.session || togglingPause) return

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

  // Start/Pause/Resume/Stop are gated behind a mandatory confirmation. The
  // request* handlers only open the dialog; the real mutation runs on confirm.
  function requestStart() {
    if (session.session) return
    setPendingConfirm({ kind: 'start' })
  }

  function requestStop() {
    if (!session.session) return
    setPendingConfirm({ kind: 'stop' })
  }

  function requestTogglePause() {
    if (!session.session) return
    setPendingConfirm({ kind: session.session.pausedAt ? 'resume' : 'pause' })
  }

  function closeConfirm() {
    if (confirmBusy) return
    setPendingConfirm(null)
  }

  async function handleConfirm() {
    if (!pendingConfirm) return

    setConfirmBusy(true)
    try {
      if (pendingConfirm.kind === 'start') {
        await handleStartSession()
      } else if (pendingConfirm.kind === 'stop') {
        await handleStopSession()
      } else {
        await handleTogglePause()
      }
    } finally {
      setConfirmBusy(false)
      setPendingConfirm(null)
    }
  }

  async function handleRecoveryResume() {
    setRecoveryBusy(true)
    try {
      await session.confirmRecoveryResume()
      setFollowCurrentLocation(true)
    } finally {
      setRecoveryBusy(false)
    }
  }

  async function handleRecoveryFinalize() {
    setRecoveryBusy(true)
    setAutoEnabled(false)
    try {
      await session.confirmRecoveryFinalize()
    } finally {
      setRecoveryBusy(false)
    }
  }

  async function handleRecoveryDiscard() {
    setRecoveryBusy(true)
    setAutoEnabled(false)
    try {
      await session.confirmRecoveryDiscard()
    } finally {
      setRecoveryBusy(false)
    }
  }

  const recordDisabled = !sessionActive || autoEnabled || sessionPaused

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

  const sessionBarProps = {
    sessionActive,
    sessionPaused,
    sessionName: session.session ? session.session.name : '',
    sessionNameDraft,
    onNameDraftChange: setSessionNameDraft,
    startingSession,
    onStart: requestStart,
    stoppingSession,
    onStop: requestStop,
    togglingPause,
    onTogglePause: requestTogglePause,
    autoEnabled,
    onToggleAuto: () => setAutoEnabled((prev) => !prev),
    nextRecordingIn,
    onRecordNow: recordNow,
    recordDisabled,
    permissionState: geolocation.permissionState,
    hasFix: Boolean(geolocation.location),
  }

  const trafficPanelProps = {
    observerAssessment: session.observerAssessment,
    onObserverSelect: session.setObserverAssessment,
    providers: activeProviders,
    providerLevels: session.providerLevels,
    onProviderSelect: session.updateProviderLevel,
  }

  if (loading || !settings) {
    return <p>Loading settings…</p>
  }

  if (routePickerOpen) {
    return (
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
    )
  }

  const confirmConfig = pendingConfirm ? CONFIRM_CONFIG[pendingConfirm.kind] : null

  return (
    <>
      <RecordToast record={recordToast} onDismiss={dismissRecordToast} />

      <CrashRecoveryModal
        open={session.recoveryPending}
        meta={session.recoveredMeta}
        busy={recoveryBusy}
        onResume={handleRecoveryResume}
        onFinalize={handleRecoveryFinalize}
        onDiscard={handleRecoveryDiscard}
      />

      {confirmConfig ? (
        <ConfirmDialog
          open
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          tone={confirmConfig.tone}
          busy={confirmBusy}
          onConfirm={handleConfirm}
          onCancel={closeConfirm}
        />
      ) : null}

      {isLandscape ? (
        <div className="flex gap-3" style={{ height: 'calc(100dvh - 9.5rem)' }}>
          <div className="w-[42%] shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <RecordingMap className="h-full w-full" {...mapProps} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <SystemStatusBanner
              online={online}
              gpsStale={gpsHealth.stale}
              gpsSecondsSinceFix={gpsHealth.secondsSinceFix}
              battery={battery}
            />
            <SessionBar showPrimaryAction={false} {...sessionBarProps} />
            <TrafficLevelPanel className="flex min-h-0 flex-1 flex-col" {...trafficPanelProps} />
            <button
              type="button"
              onClick={!sessionActive ? requestStart : recordNow}
              disabled={!sessionActive ? startingSession : recordDisabled}
              className={`shrink-0 w-full rounded-xl py-3 text-base font-bold transition disabled:opacity-50 ${
                !sessionActive
                  ? 'bg-emerald-600 text-white'
                  : sessionPaused
                    ? 'cursor-default bg-slate-700 text-slate-400'
                    : autoEnabled
                      ? 'cursor-default bg-slate-700 text-slate-300'
                      : 'bg-cyan-500 text-slate-950'
              }`}
            >
              {!sessionActive
                ? startingSession ? 'Starting…' : 'START SESSION'
                : sessionPaused
                  ? 'SESSION PAUSED'
                  : nextRecordingIn > 0
                    ? `⏱  Next recording in ${nextRecordingIn}s`
                    : 'RECORD NOW'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2" style={{ height: 'calc(100dvh - 9.5rem)' }}>
          <SystemStatusBanner
            online={online}
            gpsStale={gpsHealth.stale}
            gpsSecondsSinceFix={gpsHealth.secondsSinceFix}
            battery={battery}
          />
          <SessionBar showPrimaryAction={false} {...sessionBarProps} />
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <RecordingMap className="h-full w-full" {...mapProps} />
          </div>
          <TrafficLevelPanel className="shrink-0" {...trafficPanelProps} />
          <button
            type="button"
            onClick={!sessionActive ? requestStart : recordNow}
            disabled={!sessionActive ? startingSession : recordDisabled}
            className={`shrink-0 w-full rounded-xl py-4 text-base font-bold transition disabled:opacity-50 ${
              !sessionActive
                ? 'bg-emerald-600 text-white'
                : sessionPaused
                  ? 'cursor-default bg-slate-700 text-slate-400'
                  : autoEnabled
                    ? 'cursor-default bg-slate-700 text-slate-300'
                    : 'bg-cyan-500 text-slate-950'
            }`}
          >
            {!sessionActive
              ? startingSession ? 'Starting…' : 'START SESSION'
              : sessionPaused
                ? 'SESSION PAUSED'
                : nextRecordingIn > 0
                  ? `⏱  Next recording in ${nextRecordingIn}s`
                  : 'RECORD NOW'}
          </button>
        </div>
      )}
    </>
  )
}
