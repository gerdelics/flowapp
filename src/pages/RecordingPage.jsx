import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { useAutoRecord } from '../hooks/useAutoRecord'
import { useGeolocation } from '../hooks/useGeolocation'
import { useSession } from '../hooks/useSession'
import { useSettings } from '../hooks/useSettings'

const TRAFFIC_LEVELS = [
  { key: 'free', label: 'FREE', className: 'bg-emerald-600 hover:bg-emerald-500' },
  {
    key: 'medium',
    label: 'MED',
    className: 'bg-amber-500 text-slate-900 hover:bg-amber-400',
  },
  { key: 'heavy', label: 'HEAVY', className: 'bg-red-600 hover:bg-red-500' },
]

function getOsmEmbedUrl(location) {
  const fallback = {
    lat: 47.4979,
    lon: 19.0402,
  }

  const center = location || fallback
  const delta = 0.003
  const left = center.lon - delta
  const right = center.lon + delta
  const bottom = center.lat - delta
  const top = center.lat + delta

  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${center.lat}%2C${center.lon}`
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
            className={`min-h-11 rounded-md px-3 py-2 text-sm font-bold transition ${level.className} ${
              value === level.key ? 'ring-2 ring-white/90' : 'opacity-80'
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
  const [pathRenderVersion, setPathRenderVersion] = useState(0)
  const [togglingPause, setTogglingPause] = useState(false)
  const mapContainerRef = useRef(null)
  const leafletMapRef = useRef(null)
  const leafletPathRef = useRef(null)
  const leafletMarkerRef = useRef(null)
  const hasCenteredOnFixRef = useRef(false)
  const manualBeepEnabled = settings?.manualBeepEnabled ?? true

  const activeProviders = useMemo(
    () => settings?.providers?.filter((provider) => provider.active) || [],
    [settings],
  )

  const session = useSession(activeProviders)

  const autoRecord = useAutoRecord({
    enabled: autoEnabled && !!session.session && !session.session?.pausedAt,
    intervalSec: settings?.sampleIntervalSec || 30,
    onTick: async () => {
      await session.recordNow(geolocation.location)
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
    if (!session.session) {
      pathBufferRef.current = []
      return
    }

    pathBufferRef.current = Array.isArray(session.session.path)
      ? [...session.session.path]
      : []
  }, [session.session])

  useEffect(() => {
    if (!session.session) {
      return undefined
    }

    const sampler = setInterval(() => {
      if (!geolocation.location || session.session?.pausedAt) {
        return
      }

      pathBufferRef.current.push({
        lat: geolocation.location.lat,
        lon: geolocation.location.lon,
        accuracy: geolocation.location.accuracy,
        timestamp: new Date().toISOString(),
        fixTimestamp: geolocation.location.timestamp,
      })
      setPathRenderVersion((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(sampler)
  }, [geolocation.location, session.session])

  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) {
      return undefined
    }

    const container = mapContainerRef.current
    if (container._leaflet_id) {
      delete container._leaflet_id
    }

    const map = L.map(container, {
      zoomControl: true,
    }).setView([47.4979, 19.0402], 14)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    leafletMapRef.current = map

    const resizeSoon = setTimeout(() => {
      leafletMapRef.current?.invalidateSize()
    }, 50)

    return () => {
      clearTimeout(resizeSoon)
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
      leafletPathRef.current = null
      leafletMarkerRef.current = null
      hasCenteredOnFixRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) {
      return undefined
    }

    const invalidate = () => map.invalidateSize()
    const rafId = requestAnimationFrame(invalidate)
    window.addEventListener('resize', invalidate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', invalidate)
    }
  }, [session.session, activeProviders.length])

  useEffect(() => {
    const map = leafletMapRef.current
    if (!map) {
      return
    }

    if (geolocation.location) {
      const currentLatLng = [geolocation.location.lat, geolocation.location.lon]

      if (!leafletMarkerRef.current) {
        leafletMarkerRef.current = L.circleMarker(currentLatLng, {
          radius: 6,
          color: '#0ea5e9',
          fillColor: '#0ea5e9',
          fillOpacity: 0.95,
        }).addTo(map)
      } else {
        leafletMarkerRef.current.setLatLng(currentLatLng)
      }

      if (!hasCenteredOnFixRef.current) {
        map.setView(currentLatLng, 16)
        hasCenteredOnFixRef.current = true
      }
    }

    const pathPoints = session.session
      ? pathBufferRef.current
          .filter((point) => typeof point?.lat === 'number' && typeof point?.lon === 'number')
          .map((point) => [point.lat, point.lon])
      : []

    if (pathPoints.length > 0) {
      if (!leafletPathRef.current) {
        leafletPathRef.current = L.polyline(pathPoints, {
          color: '#22d3ee',
          weight: 5,
          opacity: 0.9,
        }).addTo(map)
      } else {
        leafletPathRef.current.setLatLngs(pathPoints)
      }
    } else if (leafletPathRef.current) {
      map.removeLayer(leafletPathRef.current)
      leafletPathRef.current = null
    }
  }, [geolocation.location, pathRenderVersion, session.session])

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
      if (createdSession?.name) {
        setSessionNameDraft(createdSession.name)
      }
      pathBufferRef.current = []

      if (geolocation.location) {
        pathBufferRef.current.push({
          lat: geolocation.location.lat,
          lon: geolocation.location.lon,
          accuracy: geolocation.location.accuracy,
          timestamp: new Date().toISOString(),
          fixTimestamp: geolocation.location.timestamp,
        })
        setPathRenderVersion((prev) => prev + 1)
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
      setPathRenderVersion(0)
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
    await session.recordNow(geolocation.location)
  }

  const sessionActive = Boolean(session.session)
  const sessionPaused = Boolean(session.session?.pausedAt)
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

  const mapUrl = useMemo(() => getOsmEmbedUrl(geolocation.location), [geolocation.location])

  if (loading || !settings) {
    return <p>Loading settings…</p>
  }

  return (
    <div className="grid h-[calc(100dvh-9.5rem)] min-h-[620px] grid-rows-[2fr_1fr] gap-3">
      <section className="grid min-h-0 grid-cols-[2fr_1fr] gap-3">
        <div className="min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <div className="relative h-full min-h-[320px] w-full">
            <iframe
              title="OpenStreetMap fallback"
              src={mapUrl}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
            />
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
          </div>
        </div>

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
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 p-2">
        <div
          className="grid h-full gap-2"
          style={{ gridTemplateColumns: gridColumns }}
        >
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
  )
}
