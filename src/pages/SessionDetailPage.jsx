import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import {
  db,
  getDeadLetterEntriesBySessionId,
  getEntriesBySessionId,
  getRetryableUnsyncedEntriesBySessionId,
  getSessionById,
  markEntriesSyncFailed,
  markEntriesSynced,
  MAX_SYNC_ATTEMPTS,
  resetEntriesForRetry,
  setSessionPlannedRoute,
} from '../db'
import { useSettings } from '../hooks/useSettings'
import { syncEntriesToAzure } from '../utils/azureSync'
import { exportLegacyCsv } from '../utils/csvExport'
import {
  buildSessionArchiveFilename,
  downloadSessionArchive,
} from '../utils/sessionArchive'
import {
  formatAverageSpeedKmh,
  formatDistanceKm,
  getSessionAverageSpeedKmh,
  getSessionPathDistanceKm,
} from '../utils/sessionMetrics'
import RouteMap from '../components/RouteMap'

function mapProviderLevels(entry) {
  const map = {}
  entry.providers.forEach((provider) => {
    map[provider.name] = provider.level
  })
  return map
}

const TRAFFIC_BADGES = {
  free: {
    label: 'FREEFLOW',
    className: 'bg-emerald-600 text-white',
  },
  medium: {
    label: 'MEDIUM',
    className: 'bg-amber-500 text-slate-950',
  },
  heavy: {
    label: 'HIGH',
    className: 'bg-red-600 text-white',
  },
}

function TrafficBadge({ level }) {
  const badge = TRAFFIC_BADGES[level] || null

  if (!badge) {
    return <span className="text-slate-400">—</span>
  }

  return (
    <span className={`inline-flex min-w-20 justify-center rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}>
      {badge.label}
    </span>
  )
}


export default function SessionDetailPage() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [entries, setEntries] = useState([])
  const [savedRoutes, setSavedRoutes] = useState([])
  const [routePickerOpen, setRoutePickerOpen] = useState(false)
  const [routeCityFilter, setRouteCityFilter] = useState('')
  const [routeCityComboboxOpen, setRouteCityComboboxOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [showPath, setShowPath] = useState(true)
  const { settings } = useSettings()
  const canSync = Boolean(settings?.azureEndpointUrl && settings?.azureApiKey)

  useEffect(() => {
    async function load() {
      const [loadedSession, loadedEntries, loadedRoutes] = await Promise.all([
        getSessionById(id),
        getEntriesBySessionId(id),
        db.routes.orderBy('city').toArray(),
      ])
      setSession(loadedSession)
      setEntries(loadedEntries)
      setSavedRoutes(loadedRoutes)
    }
    load()
  }, [id])

  const providers = useMemo(() => {
    if (entries.length === 0) {
      return []
    }
    return [...new Set(entries.flatMap((entry) => entry.providers.map((p) => p.name)))]
  }, [entries])

  const sessionPath = useMemo(() => {
    if (!Array.isArray(session?.path)) {
      return []
    }
    return session.path.filter(
      (point) =>
        typeof point?.lat === 'number' &&
        typeof point?.lon === 'number',
    )
  }, [session])

  const plannedRoutePoints = useMemo(() => {
    if (!Array.isArray(session?.plannedRoutePoints)) {
      return []
    }
    return session.plannedRoutePoints.filter(
      (point) => typeof point?.lat === 'number' && typeof point?.lon === 'number',
    )
  }, [session])

  const routeCities = useMemo(() => {
    const set = new Set(savedRoutes.map((route) => route.city).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'en'))
  }, [savedRoutes])

  const filteredRoutes = useMemo(() => {
    if (!routeCityFilter) {
      return savedRoutes
    }
    return savedRoutes.filter((route) => route.city === routeCityFilter)
  }, [savedRoutes, routeCityFilter])

  useEffect(() => {
    if (!routePickerOpen) {
      setRouteCityComboboxOpen(false)
    }
  }, [routePickerOpen])

  if (!session) {
    return <p>Loading session…</p>
  }

  async function handleExport() {
    if (!settings) {
      return
    }
    exportLegacyCsv(entries, settings, `${session.name || 'session'}-${session.id}.csv`)
  }

  async function handleExportJson() {
    downloadSessionArchive(session, entries, buildSessionArchiveFilename(session))
  }

  async function handleSync() {
    if (!canSync) {
      setStatusMessage('Add Cosmos DB endpoint and API key in Settings before sync.')
      return
    }

    setSyncing(true)
    setStatusMessage('')
    try {
      const retryable = await getRetryableUnsyncedEntriesBySessionId(session.id)
      if (retryable.length === 0) {
        setStatusMessage(
          `No retryable entries in this session (already synced or dead-letter after ${MAX_SYNC_ATTEMPTS} attempts).`,
        )
        return
      }

      await syncEntriesToAzure({
        entries: retryable,
        sessions: [session],
        endpointUrl: settings.azureEndpointUrl,
        apiKey: settings.azureApiKey,
      })
      await markEntriesSynced(retryable.map((entry) => entry.id))
      setStatusMessage('Session synced successfully.')
      setEntries(await getEntriesBySessionId(id))
    } catch (error) {
      const retryable = await getRetryableUnsyncedEntriesBySessionId(session.id)
      await markEntriesSyncFailed(
        retryable.map((entry) => entry.id),
        error.message || 'Session sync failed',
      )
      setStatusMessage(error.message || 'Session sync failed.')
      setEntries(await getEntriesBySessionId(id))
    } finally {
      setSyncing(false)
    }
  }

  async function handleRetryDeadLetters() {
    const deadLetters = await getDeadLetterEntriesBySessionId(session.id)
    if (deadLetters.length === 0) {
      setStatusMessage('No dead-letter entries in this session.')
      return
    }

    const resetCount = await resetEntriesForRetry(deadLetters.map((entry) => entry.id))
    setStatusMessage(`Reset ${resetCount} dead-letter entries to pending.`)
    setEntries(await getEntriesBySessionId(id))
  }

  async function handleRetryAndSyncNow() {
    const deadLetters = await getDeadLetterEntriesBySessionId(session.id)
    if (deadLetters.length > 0) {
      await resetEntriesForRetry(deadLetters.map((entry) => entry.id))
      setStatusMessage(`Reset ${deadLetters.length} dead-letter entries, starting sync…`)
      setEntries(await getEntriesBySessionId(id))
    }

    await handleSync()
  }

  async function handleAttachPlannedRoute(routeId) {
    const updated = await setSessionPlannedRoute(id, routeId)
    if (!updated) {
      return
    }

    setSession(updated)
  }

  function handleCityFilterChange(city) {
    setRouteCityFilter(city)
    setRouteCityComboboxOpen(false)
  }

  function handleOpenRoutePicker() {
    setRoutePickerOpen(true)
    setRouteCityComboboxOpen(false)
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">{session.name}</h2>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={handleExport}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold sm:w-auto"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="w-full rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold sm:w-auto"
          >
            Export JSON
          </button>
          <button
            type="button"
            disabled={syncing || !canSync}
            onClick={handleSync}
            className="w-full rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
          >
            {syncing ? 'Syncing…' : canSync ? 'Sync to Azure' : 'Sync unavailable'}
          </button>
          <button
            type="button"
            onClick={handleRetryDeadLetters}
            className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 sm:w-auto"
          >
            Retry dead-letter
          </button>
          <button
            type="button"
            disabled={syncing || !canSync}
            onClick={handleRetryAndSyncNow}
            className="w-full rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
          >
            {syncing ? 'Retry+Sync…' : canSync ? 'Retry + Sync now' : 'Sync unavailable'}
          </button>
          <button
            type="button"
            disabled={sessionPath.length === 0 && plannedRoutePoints.length === 0}
            onClick={() => setShowPath((prev) => !prev)}
            className="w-full rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
          >
            {showPath ? 'Hide path' : 'Show path'}
          </button>
        </div>
      </div>
      <p className="mb-4 mt-1 text-sm text-slate-400">
        {new Date(session.startTime).toLocaleString()}
      </p>

      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">Planned route</p>
            <p className="truncate text-sm font-semibold text-orange-400">
              {session.plannedRouteName
                ? `${session.plannedRouteName}${session.plannedRouteCity ? ` (${session.plannedRouteCity})` : ''}`
                : 'No planned route assigned'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleOpenRoutePicker}
              className="whitespace-nowrap text-xs text-slate-300 hover:text-white"
            >
              {session.plannedRouteId ? 'Replace' : 'Add'}
            </button>
            {session.plannedRouteId ? (
              <button
                type="button"
                onClick={() => handleAttachPlannedRoute(null)}
                className="whitespace-nowrap text-xs text-slate-500 hover:text-red-400"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Distance</p>
          <p className="mt-1 text-base font-semibold text-slate-100">
            {formatDistanceKm(getSessionPathDistanceKm(session.path))}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Average speed</p>
          <p className="mt-1 text-base font-semibold text-slate-100">
            {formatAverageSpeedKmh(getSessionAverageSpeedKmh(session))}
          </p>
        </div>
      </div>
      {statusMessage ? <p className="mb-4 text-sm text-slate-300">{statusMessage}</p> : null}

      {showPath ? (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
          {sessionPath.length === 0 && plannedRoutePoints.length === 0 ? (
            <p className="text-sm text-slate-400">No saved path for this session.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-300">
                Path points: {sessionPath.length} • Planned points: {plannedRoutePoints.length}
              </p>
              <RouteMap
                className="h-72 w-full rounded-md"
                points={sessionPath}
                overlayPoints={plannedRoutePoints}
                showCurrentMarker={false}
                showStartEndMarkers
                fitRoute
                fitRouteKey={session?.id}
              />
            </>
          )}
        </div>
      ) : null}

      {routePickerOpen ? (
        <div className="fixed inset-0 z-[2000] flex flex-col bg-slate-950">
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
                <p className="text-xs text-slate-400">Choose a city and then a route to assign.</p>
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

          <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-4 sm:px-6">
            <div
              className="flex w-full max-w-5xl min-h-0 flex-col gap-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRouteCityComboboxOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-500"
                  aria-expanded={routeCityComboboxOpen}
                  aria-haspopup="listbox"
                >
                  <span className="truncate">{routeCityFilter || 'All cities'}</span>
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
                      {routeCities.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handleCityFilterChange(city)}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
                            routeCityFilter === city ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
                          }`}
                        >
                          <span className="truncate">{city}</span>
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
                    filteredRoutes.map((route) => (
                      <li key={route.id}>
                        <button
                          type="button"
                          onClick={() => handleAttachPlannedRoute(route.id)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            route.id === session.plannedRouteId
                              ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          <p className="text-sm font-semibold">{route.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{route.city}</p>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700 text-sm">
          <thead className="bg-slate-900 text-left">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Lat</th>
              <th className="px-3 py-2">Lon</th>
              <th className="px-3 py-2">Observer</th>
              {providers.map((provider) => (
                <th key={provider} className="px-3 py-2">
                  {provider}
                </th>
              ))}
              <th className="px-3 py-2">Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {entries.map((entry) => {
              const levels = mapProviderLevels(entry)
              return (
                <tr key={entry.id} className="bg-slate-950/60">
                  <td className="px-3 py-2">{new Date(entry.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2">{entry.location?.lat ?? ''}</td>
                  <td className="px-3 py-2">{entry.location?.lon ?? ''}</td>
                  <td className="px-3 py-2">
                    <TrafficBadge level={entry.observerAssessment} />
                  </td>
                  {providers.map((provider) => (
                    <td key={provider} className="px-3 py-2">
                      <TrafficBadge level={levels[provider]} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {entry.synced
                      ? 'synced'
                      : `${entry.syncStatus || 'pending'} (${entry.syncAttempts || 0})`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
