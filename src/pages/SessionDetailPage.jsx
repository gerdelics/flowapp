import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import {
  getDeadLetterEntriesBySessionId,
  getEntriesBySessionId,
  getRetryableUnsyncedEntriesBySessionId,
  getSessionById,
  markEntriesSyncFailed,
  markEntriesSynced,
  MAX_SYNC_ATTEMPTS,
  resetEntriesForRetry,
} from '../db'
import { useSettings } from '../hooks/useSettings'
import { syncEntriesToAzure } from '../utils/azureSync'
import { exportLegacyCsv } from '../utils/csvExport'
import RouteMap from '../components/RouteMap'

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
  const [syncing, setSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [showPath, setShowPath] = useState(true)
  const { settings } = useSettings()

  useEffect(() => {
    async function load() {
      setSession(await getSessionById(id))
      setEntries(await getEntriesBySessionId(id))
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

  if (!session) {
    return <p>Loading session…</p>
  }

  async function handleExport() {
    if (!settings) {
      return
    }
    exportLegacyCsv(entries, settings, `${session.name || 'session'}-${session.id}.csv`)
  }

  async function handleSync() {
    if (!settings?.azureEndpointUrl) {
      setStatusMessage('Add Azure endpoint in Settings before sync.')
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{session.name}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={handleSync}
            className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync to Azure'}
          </button>
          <button
            type="button"
            onClick={handleRetryDeadLetters}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            Retry dead-letter
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={handleRetryAndSyncNow}
            className="rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {syncing ? 'Retry+Sync…' : 'Retry + Sync now'}
          </button>
          <button
            type="button"
            disabled={sessionPath.length === 0}
            onClick={() => setShowPath((prev) => !prev)}
            className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {showPath ? 'Hide path' : 'Show path'}
          </button>
        </div>
      </div>
      <p className="mb-4 mt-1 text-sm text-slate-400">
        {new Date(session.startTime).toLocaleString()}
      </p>
      {statusMessage ? <p className="mb-4 text-sm text-slate-300">{statusMessage}</p> : null}

      {showPath ? (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
          {sessionPath.length === 0 ? (
            <p className="text-sm text-slate-400">No saved path for this session.</p>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-300">
                Path points: {sessionPath.length}
              </p>
              <RouteMap
                className="h-72 w-full rounded-md"
                points={sessionPath}
                showCurrentMarker={false}
                showStartEndMarkers
                fitRoute
                fitRouteKey={session?.id}
              />
            </>
          )}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700 text-sm">
          <thead className="bg-slate-900 text-left">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Lat</th>
              <th className="px-3 py-2">Lon</th>
              {providers.map((provider) => (
                <th key={provider} className="px-3 py-2">
                  {provider}
                </th>
              ))}
              <th className="px-3 py-2">Observer</th>
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
                  {providers.map((provider) => (
                    <td key={provider} className="px-3 py-2">
                      {levels[provider] || ''}
                    </td>
                  ))}
                  <td className="px-3 py-2">{entry.observerAssessment}</td>
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
