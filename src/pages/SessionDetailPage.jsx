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
import { RouteMap, RoutePickerModal, SyncActionButtons, TrafficLevelBadge } from '../components'

function mapProviderLevels(entry) {
  const map = {}
  entry.providers.forEach((provider) => {
    map[provider.name] = provider.level
  })
  return map
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

  function handleCloseRoutePicker() {
    setRoutePickerOpen(false)
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
          <SyncActionButtons
            syncing={syncing}
            canSync={canSync}
            onRetryDeadLetters={handleRetryDeadLetters}
            onRetryAndSync={handleRetryAndSyncNow}
            onSync={handleSync}
            retryLabel="Retry dead-letter"
            retryAndSyncLabel="Retry + Sync now"
            retryAndSyncBusyLabel="Retry+Sync…"
            syncLabel="Sync to Azure"
            syncBusyLabel="Syncing…"
            className="contents"
            buttonClassName="w-full sm:w-auto"
          />
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

      <RoutePickerModal
        open={routePickerOpen}
        title="Select route"
        subtitle="Choose a city and then a route to assign."
        selectedCity={routeCityFilter}
        onSelectCity={handleCityFilterChange}
        cityComboboxOpen={routeCityComboboxOpen}
        onToggleCityCombobox={() => setRouteCityComboboxOpen((prev) => !prev)}
        cities={routeCities}
        routes={filteredRoutes}
        selectedRouteId={session.plannedRouteId || ''}
        onSelectRoute={handleAttachPlannedRoute}
        onClose={handleCloseRoutePicker}
      />

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
                    <TrafficLevelBadge level={entry.observerAssessment} />
                  </td>
                  {providers.map((provider) => (
                    <td key={provider} className="px-3 py-2">
                      <TrafficLevelBadge level={levels[provider]} />
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
