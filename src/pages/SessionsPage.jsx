import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionCard, SessionsToolbar } from '../components'
import {
  deleteSession,
  getEntriesBySessionId,
  getSessionById,
  importSessionArchive,
  renameSession,
  subscribeSessionsWithCounts,
} from '../db'
import { useSettings } from '../hooks/useSettings'
import { exportLegacyCsv } from '../utils/csvExport'
import {
  buildSessionArchiveFilename,
  downloadSessionArchive,
  readSessionArchiveFile,
} from '../utils/sessionArchive'

export default function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [importingArchive, setImportingArchive] = useState(false)
  const importInputRef = useRef(null)
  const { settings } = useSettings()
  const navigate = useNavigate()

  // Live, shared sessions list (kept in sync across devices).
  useEffect(() => {
    const unsubscribe = subscribeSessionsWithCounts(setSessions)
    return unsubscribe
  }, [])

  async function handleDelete(id) {
    const confirmed = window.confirm('Delete this session and all its entries?')
    if (!confirmed) {
      return
    }
    await deleteSession(id)
  }

  async function handleRenameSession(id, name) {
    const renamed = renameSession(id, name)
    if (!renamed) {
      setStatusMessage('Session rename failed.')
      return
    }

    setStatusMessage(`Renamed session to "${renamed.name}".`)
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
      setStatusMessage('Session not found for export.')
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
    setStatusMessage('')
    try {
      const archive = await readSessionArchiveFile(file)
      const imported = await importSessionArchive(archive)
      setStatusMessage(
        `Imported session "${imported.session.name}" with ${imported.importedEntryCount} entries.`,
      )
      navigate(`/sessions/${imported.session.id}`)
    } catch (error) {
      setStatusMessage(error.message || 'Import failed.')
    } finally {
      setImportingArchive(false)
      event.target.value = ''
    }
  }

  return (
    <div>
      <SessionsToolbar
        importingArchive={importingArchive}
        onImportClick={() => importInputRef.current?.click()}
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportSessionArchive}
      />
      {statusMessage ? <p className="mb-3 text-sm text-slate-300">{statusMessage}</p> : null}
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
