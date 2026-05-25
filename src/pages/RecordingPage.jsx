import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAutoRecord } from '../hooks/useAutoRecord'
import { useGeolocation } from '../hooks/useGeolocation'
import { useSession } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'
import RouteMap from '../components/RouteMap'
import { db } from '../db'

function sanitizePath(path) {
  if (!Array.isArray(path)) {
    return []
  }

  return path.filter((point) => typeof point?.lat === 'number' && typeof point?.lon === 'number')
}

const TRAFFIC_LEVELS = [
  {
    key: 'free',
    label: 'FREE',
    selectedClassName: 'border-emerald-300 bg-emerald-500 text-white shadow-md hover:bg-emerald-400',
    inactiveClassName: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
  },
  {
    key: 'medium',
    label: 'MED',
    selectedClassName: 'border-yellow-200 bg-yellow-400 text-slate-950 shadow-md hover:bg-yellow-300',
    inactiveClassName: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
  },
  {
    key: 'heavy',
    label: 'HEAVY',
    selectedClassName: 'border-red-300 bg-red-500 text-white shadow-md hover:bg-red-400',
    inactiveClassName: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
  },
]

const TOAST_LEVELS = {
  free: { label: 'FREE', className: 'bg-emerald-600 text-white' },
  medium: { label: 'MED', className: 'bg-amber-500 text-slate-950' },
  heavy: { label: 'HEAVY', className: 'bg-red-600 text-white' },
}

function getToastLevel(level) {
  return TOAST_LEVELS[level] || TOAST_LEVELS.medium
}

function RecordLevelRow({ name, levelKey, iconUrl }) {
  const level = getToastLevel(levelKey)

  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 shadow-sm ${level.className}`}>
      <div className="flex min-w-0 items-center gap-2">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-6 w-6 rounded bg-white object-contain p-0.5" />
        ) : null}
        <span className="truncate text-sm font-semibold">{name}</span>
      </div>

      <span className="shrink-0 rounded-full bg-black/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
        {level.label}
      </span>
    </li>
  )
}

function RecordToast({ record, onDismiss }) {
  if (!record) {
    return null
  }

  const channelLabel = record.channel === 'auto' ? 'Automatic reporting' : 'Manual reporting'

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-50 flex justify-center md:inset-x-auto md:right-4 md:justify-end">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              {channelLabel}
            </p>
            <p className="mt-1 text-base font-bold text-slate-50">New record saved</p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(record.timestamp).toLocaleString()}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Dismiss
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          <RecordLevelRow name="Observer" levelKey={record.observerAssessment} />

          {(record.providers || []).length ? (
            record.providers.map((provider) => (
              <RecordLevelRow
                key={`${provider.name}-${provider.level}`}
                name={provider.name}
                levelKey={provider.level}
                iconUrl={provider.iconUrl}
              />
            ))
          ) : (
            <li className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-400">
              No active providers were selected
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

function TrafficCard({ title, iconUrl, value, onSelect }) {
  return (
    <div className="h-full rounded-xl border border-slate-700 bg-slate-900 p-3">
      <div className="mb-2 flex items-center gap-2">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-7 w-7 rounded bg-white object-contain p-1" />
        ) : null}
        <p className="text-sm font-semibold text-slate-100 md:text-base">{title}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {TRAFFIC_LEVELS.map((level) => (
          <button
            key={level.key}
            type="button"
            onClick={() => onSelect(level.key)}
            aria-pressed={value === level.key}
            className={`rounded-md border px-3 py-2 text-sm font-bold transition ${
              value === level.key ? level.selectedClassName : level.inactiveClassName
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MobileTrafficRow({ title, iconUrl, value, onSelect }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-2">
      <div className="mb-2 flex items-center gap-2">
        {iconUrl ? (
          <img src={iconUrl} alt="" className="h-5 w-5 rounded bg-white object-contain p-0.5" />
        ) : null}
        <p className="truncate text-xs font-semibold text-slate-100">{title}</p>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {TRAFFIC_LEVELS.map((level) => (
          <button
            key={level.key}
            type="button"
            onClick={() => onSelect(level.key)}
            aria-pressed={value === level.key}
            className={`rounded px-1 py-2 text-[11px] font-bold transition ${
              value === level.key ? level.selectedClassName : level.inactiveClassName
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function playBeep() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    return
  }

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = 1040
  gain.gain.value = 0.06

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start()
  oscillator.stop(context.currentTime + 0.12)
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
    requestOnce()
    startWatching()

    return () => {
      stopWatching()
    }
  }, [requestOnce, startWatching, stopWatching])

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
    setMobileMapOpen(sessionActive)
  }, [sessionActive])

  useEffect(() => {
    if (!routePickerOpen) {
      setRouteCityComboboxOpen(false)
    }
  }, [routePickerOpen])

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

      requestOnce()
        .then(() => {
          startWatching()
        })
        .catch(() => {
          // Non-blocking geolocation failure: session continues without location.
        })
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
      playBeep()
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
              followCurrent={sessionActive && !sessionPaused}
              showCurrentMarker
              fitRoute={false}
              fitRouteKey={session.session?.id}
            />
          </div>
        </details>
      </section>

      {/* Route picker modal */}
      {routePickerOpen ? (
        <div
          className="fixed inset-0 z-[2000] flex flex-col bg-slate-950"
        >
          <div className="border-b border-slate-800 bg-slate-900/95" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setRoutePickerOpen(false)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-500 sm:px-3 sm:py-2 sm:text-sm"
              >
                Back
              </button>

              <div className="min-w-0 text-center">
                <p className="text-sm font-bold text-slate-100">Select route</p>
                <p className="text-xs text-slate-400">Choose a city and then a route to load.</p>
              </div>

              <button
                type="button"
                onClick={() => setRoutePickerOpen(false)}
                className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-500 sm:px-3 sm:py-2 sm:text-sm"
              >
                Done
              </button>
            </div>
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setRouteCityComboboxOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-500"
                aria-expanded={routeCityComboboxOpen}
                aria-haspopup="listbox"
              >
                <span className="truncate">
                  {routeCityFilter || 'All cities'}
                </span>
                <span
                  className={`text-slate-400 transition ${routeCityComboboxOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {routeCityComboboxOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[2100] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
                  <button
                    type="button"
                    onClick={() => handleCityFilterChange('')}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
                      !routeCityFilter ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
                    }`}
                  >
                    <span>All cities</span>
                  </button>
                  <div className="max-h-52 overflow-y-auto border-t border-slate-800">
                    {routeCities.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleCityFilterChange(c)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
                          routeCityFilter === c ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
                        }`}
                      >
                        <span className="truncate">{c}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-200">
                  Routes{filteredRoutes.length > 0 ? ` (${filteredRoutes.length})` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setRoutePickerOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
                {filteredRoutes.length === 0 ? (
                  <li className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-500">
                    No routes
                  </li>
                ) : (
                  filteredRoutes.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => handleOverlayRouteChange(r.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          r.id === selectedOverlayRouteId
                            ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{r.city}</p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
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
              followCurrent={sessionActive && !sessionPaused}
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
          {sessionPaused ? (
            <p className="mt-1 text-sm font-semibold text-amber-300">Session is paused.</p>
          ) : null}

          {/* Route overlay loader */}
          {savedRoutes.length > 0 ? (
            <div className="mt-4 border-t border-slate-700 pt-4">
              {selectedOverlayRouteId ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Loaded route</p>
                    <p className="truncate text-sm font-semibold text-orange-400">
                      {savedRoutes.find((r) => r.id === selectedOverlayRouteId)?.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setRoutePickerOpen(true)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleClearOverlayRoute}
                      className="text-xs text-slate-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRoutePickerOpen(true)}
                  className="text-sm text-slate-400 hover:text-slate-100"
                >
                  + Load route
                </button>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 p-2">
        <div className="grid grid-cols-1 gap-2 md:hidden sm:grid-cols-2">
          <MobileTrafficRow
            title="User Perception"
            value={session.observerAssessment}
            onSelect={session.setObserverAssessment}
          />

          {activeProviders.map((provider) => (
            <MobileTrafficRow
              key={provider.id}
              title={provider.name}
              iconUrl={provider.iconUrl}
              value={session.providerLevels[provider.name] || 'medium'}
              onSelect={(level) => session.updateProviderLevel(provider.name, level)}
            />
          ))}
        </div>

        <div className="hidden h-full gap-2 md:grid" style={{ gridTemplateColumns: gridColumns }}>
          <TrafficCard
            title="User Perception"
            value={session.observerAssessment}
            onSelect={session.setObserverAssessment}
          />

          {activeProviders.map((provider) => (
            <TrafficCard
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
