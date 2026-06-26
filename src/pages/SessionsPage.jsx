import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SessionFilters, SessionRow, SessionsToolbar } from '../components'
import {
  deleteSession,
  getEntriesBySessionId,
  getSessionById,
  importSessionArchive,
  renameSession,
  subscribeSessionsWithCounts,
} from '../db'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../hooks/useSettings'
import { exportLegacyCsv } from '../utils/csvExport'
import {
  buildSessionArchiveFilename,
  downloadSessionArchive,
  readSessionArchiveFile,
} from '../utils/sessionArchive'

function dayKey(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayLabel(key) {
  const date = new Date(`${key}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return key
  }
  return date.toLocaleDateString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [importingArchive, setImportingArchive] = useState(false)
  const importInputRef = useRef(null)
  const { user } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [onlyMine, setOnlyMine] = useState(true)
  const [cityFilter, setCityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Live, shared sessions list (kept in sync across devices).
  useEffect(() => {
    const unsubscribe = subscribeSessionsWithCounts(setSessions)
    return unsubscribe
  }, [])

  const cities = useMemo(() => {
    const set = new Set(sessions.map((session) => session.city).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'en'))
  }, [sessions])

  const hasActiveFilters = !onlyMine || Boolean(cityFilter) || Boolean(dateFrom) || Boolean(dateTo)

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      if (onlyMine && session.owner !== user?.uid) {
        return false
      }
      if (cityFilter && session.city !== cityFilter) {
        return false
      }
      const key = dayKey(session.startTime)
      if (dateFrom && key < dateFrom) {
        return false
      }
      if (dateTo && key > dateTo) {
        return false
      }
      return true
    })
  }, [sessions, onlyMine, cityFilter, dateFrom, dateTo, user?.uid])

  // Group filtered sessions by day. The source list is already sorted by
  // startTime descending, so insertion order yields newest day/session first.
  const groups = useMemo(() => {
    const map = new Map()
    filteredSessions.forEach((session) => {
      const key = dayKey(session.startTime)
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key).push(session)
    })
    return Array.from(map.entries())
  }, [filteredSessions])

  function clearFilters() {
    setOnlyMine(true)
    setCityFilter('')
    setDateFrom('')
    setDateTo('')
  }

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

      <SessionFilters
        onlyMine={onlyMine}
        onOnlyMineChange={setOnlyMine}
        city={cityFilter}
        onCityChange={setCityFilter}
        cities={cities}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {statusMessage ? <p className="mb-3 text-sm text-slate-300">{statusMessage}</p> : null}

      {filteredSessions.length === 0 ? (
        <p className="text-slate-400">
          {sessions.length === 0 ? 'No sessions yet.' : 'No sessions match the current filters.'}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([key, daySessions]) => (
            <section key={key} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2">
                <h3 className="text-sm font-semibold text-slate-200">{dayLabel(key)}</h3>
                <span className="text-xs text-slate-400">
                  {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
                </span>
              </div>
              {daySessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onOpen={(id) => navigate(`/sessions/${id}`)}
                  onDelete={handleDelete}
                  onExport={handleExportSession}
                  onExportJson={handleExportSessionJson}
                  onRename={handleRenameSession}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
