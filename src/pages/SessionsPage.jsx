import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionsToolbar } from '../components'
import SessionCard from '../components/SessionCard'
import {
  deleteSession,
  getDeadLetterEntriesBySessionId,
  getEntriesBySessionId,
  getSessionById,
  getDeadLetterEntries,
  getRetryableUnsyncedEntries,
  getRetryableUnsyncedEntriesBySessionId,
  importSessionArchive,
  listSessionsWithCounts,
  markEntriesSyncFailed,
  markEntriesSynced,
  MAX_SYNC_ATTEMPTS,
  renameSession,
  resetEntriesForRetry,
} from '../db'
import { useSettings } from '../hooks/useSettings'
import { syncEntriesToAzure } from '../utils/azureSync'
import { exportLegacyCsv } from '../utils/csvExport'
import {
  buildSessionArchiveFilename,
  downloadSessionArchive,
  readSessionArchiveFile,
} from '../utils/sessionArchive'

export default function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [syncingSessionId, setSyncingSessionId] = useState(null)
  const [syncMessage, setSyncMessage] = useState('')
  const [importingArchive, setImportingArchive] = useState(false)
  const importInputRef = useRef(null)
  const { settings } = useSettings()
  const navigate = useNavigate()
  const canSync = Boolean(settings?.azureEndpointUrl && settings?.azureApiKey)

  async function refresh() {
    setSessions(await listSessionsWithCounts())
  }

  useEffect(() => {
    let mounted = true

    async function loadInitial() {
      const list = await listSessionsWithCounts()
      if (mounted) {
        setSessions(list)
      }
    }

    loadInitial()

    return () => {
      mounted = false
    }
  }, [])

  async function handleDelete(id) {
    const confirmed = window.confirm('Delete this session and all its entries?')
    if (!confirmed) {
      return
    }
    await deleteSession(id)
    await refresh()
  }

  async function handleRenameSession(id, name) {
    const renamed = await renameSession(id, name)
    if (!renamed) {
      setSyncMessage('Session rename failed.')
      return
    }

    setSyncMessage(`Renamed session to "${renamed.name}".`)
    await refresh()
  }

  async function handleExportSession(id) {
    if (!settings) {
      return
    }

    const entries = await getEntriesBySessionId(id)
    const session = sessions.find((item) => item.id === id)
    exportLegacyCsv(entries, settings, `${session?.name || 'session'}-${id}.csv`)
  }

  async function handleExportSessionJson(id) {
    const [session, entries] = await Promise.all([
      getSessionById(id),
      getEntriesBySessionId(id),
    ])

    if (!session) {
      setSyncMessage('Session not found for export.')
      return
    }

    downloadSessionArchive(session, entries, buildSessionArchiveFilename(session))
  }

  async function handleImportSessionArchive(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setImportingArchive(true)
    setSyncMessage('')
    try {
      const archive = await readSessionArchiveFile(file)
      const imported = await importSessionArchive(archive)
      setSyncMessage(
        `Imported session "${imported.session.name}" with ${imported.importedEntryCount} entries.`,
      )
      await refresh()
      navigate(`/sessions/${imported.session.id}`)
    } catch (error) {
      setSyncMessage(error.message || 'Import failed.')
    } finally {
      setImportingArchive(false)
      event.target.value = ''
    }
  }

  async function handleSyncSession(id) {
    if (!canSync) {
      setSyncMessage('Add Cosmos DB endpoint and API key in Settings before sync.')
      return
    }

    setSyncMessage('')
    setSyncingSessionId(id)
    try {
      const entries = await getRetryableUnsyncedEntriesBySessionId(id)
      if (entries.length === 0) {
        setSyncMessage('No retryable entries in this session (maybe already synced or dead-letter).')
        return
      }

      const currentSession = sessions.find((item) => item.id === id)
      await syncEntriesToAzure({
        entries,
        sessions: currentSession ? [currentSession] : [],
        endpointUrl: settings.azureEndpointUrl,
        apiKey: settings.azureApiKey,
      })
      await markEntriesSynced(entries.map((entry) => entry.id))
      setSyncMessage('Session synced successfully.')
      await refresh()
    } catch (error) {
      const retryable = await getRetryableUnsyncedEntriesBySessionId(id)
      await markEntriesSyncFailed(
        retryable.map((entry) => entry.id),
        error.message || 'Session sync failed',
      )
      setSyncMessage(error.message || 'Session sync failed.')
      await refresh()
    } finally {
      setSyncingSessionId(null)
    }
  }

  async function handleSyncAll() {
    if (!canSync) {
      setSyncMessage('Add Cosmos DB endpoint and API key in Settings before sync.')
      return
    }

    setSyncingSessionId('all')
    setSyncMessage('')
    try {
      const retryableEntries = await getRetryableUnsyncedEntries()
      if (retryableEntries.length === 0) {
        const deadLetters = await getDeadLetterEntries()
        if (deadLetters.length > 0) {
          setSyncMessage(
            `No retryable entries. ${deadLetters.length} entries are in dead-letter (>${MAX_SYNC_ATTEMPTS - 1} attempts).`,
          )
          return
        }
        setSyncMessage('Nothing to sync. All entries are already synced.')
        return
      }

      await syncEntriesToAzure({
        entries: retryableEntries,
        sessions,
        endpointUrl: settings.azureEndpointUrl,
        apiKey: settings.azureApiKey,
      })
      await markEntriesSynced(retryableEntries.map((entry) => entry.id))
      setSyncMessage(`Synced ${retryableEntries.length} entries.`)
      await refresh()
    } catch (error) {
      const retryableEntries = await getRetryableUnsyncedEntries()
      await markEntriesSyncFailed(
        retryableEntries.map((entry) => entry.id),
        error.message || 'Sync all failed',
      )
      setSyncMessage(error.message || 'Sync all failed.')
      await refresh()
    } finally {
      setSyncingSessionId(null)
    }
  }

  async function handleRetryDeadLettersAll() {
    const deadLetters = await getDeadLetterEntries()
    if (deadLetters.length === 0) {
      setSyncMessage('No dead-letter entries to retry.')
      return
    }

    const resetCount = await resetEntriesForRetry(deadLetters.map((entry) => entry.id))
    setSyncMessage(`Reset ${resetCount} dead-letter entries to pending.`)
    await refresh()
  }

  async function handleRetryAndSyncAll() {
    const deadLetters = await getDeadLetterEntries()
    if (deadLetters.length > 0) {
      await resetEntriesForRetry(deadLetters.map((entry) => entry.id))
      await refresh()
      setSyncMessage(`Reset ${deadLetters.length} dead-letter entries, starting sync…`)
    }

    await handleSyncAll()
  }

  async function handleRetryDeadLettersSession(id) {
    const deadLetters = await getDeadLetterEntriesBySessionId(id)
    if (deadLetters.length === 0) {
      setSyncMessage('No dead-letter entries in this session.')
      return
    }

    const resetCount = await resetEntriesForRetry(deadLetters.map((entry) => entry.id))
    setSyncMessage(`Session dead-letter reset complete: ${resetCount} entries set to pending.`)
    await refresh()
  }

  async function handleRetryAndSyncSession(id) {
    const deadLetters = await getDeadLetterEntriesBySessionId(id)
    if (deadLetters.length > 0) {
      await resetEntriesForRetry(deadLetters.map((entry) => entry.id))
      await refresh()
      setSyncMessage(`Session dead-letter reset complete: ${deadLetters.length} entries reset, starting sync…`)
    }

    await handleSyncSession(id)
  }

  return (
    <div>
      <SessionsToolbar
        importingArchive={importingArchive}
        onImportClick={() => importInputRef.current?.click()}
        syncingAll={syncingSessionId === 'all'}
        canSync={canSync}
        onRetryDeadLettersAll={handleRetryDeadLettersAll}
        onRetryAndSyncAll={handleRetryAndSyncAll}
        onSyncAll={handleSyncAll}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportSessionArchive}
      />
      {syncMessage ? <p className="mb-3 text-sm text-slate-300">{syncMessage}</p> : null}
      {sessions.length === 0 ? (
        <p className="text-slate-400">No sessions yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard
              key={`${session.id}-${session.name}`}
              session={session}
              onOpen={(id) => navigate(`/sessions/${id}`)}
              onDelete={handleDelete}
              onExport={handleExportSession}
              onExportJson={handleExportSessionJson}
              onRename={handleRenameSession}
              onSync={handleSyncSession}
              onRetryDeadLetters={handleRetryDeadLettersSession}
              onRetryAndSyncNow={handleRetryAndSyncSession}
              syncBusy={syncingSessionId === session.id}
              syncDisabled={!canSync}
            />
          ))}
        </div>
      )}
    </div>
  )
}
