import { useState } from 'react'
import { formatDistanceStrict } from 'date-fns'
import {
  formatAverageSpeedKmh,
  formatDistanceKm,
  getSessionAverageSpeedKmh,
  getSessionPathDistanceKm,
} from '../utils/sessionMetrics'

function getDuration(startTime, endTime) {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  return formatDistanceStrict(start, end)
}

export default function SessionCard({
  session,
  onOpen,
  onDelete,
  onExport,
  onExportJson,
  onRename,
  onSync,
  onRetryDeadLetters,
  onRetryAndSyncNow,
  syncBusy,
  syncDisabled,
}) {
  const [nameDraft, setNameDraft] = useState(session.name || '')
  const [showNameEditor, setShowNameEditor] = useState(!session.name?.trim())

  async function handleRename() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === session.name) {
      return
    }

    await onRename(session.id, trimmed)
    setShowNameEditor(false)
  }

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{session.id}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{session.name}</h3>
        <button
          type="button"
          onClick={() => {
            setNameDraft(session.name || '')
            setShowNameEditor(true)
          }}
          className="text-sm font-medium text-cyan-400 transition hover:text-cyan-300"
        >
          {session.name?.trim() ? 'Edit name' : 'Add name'}
        </button>
      </div>
      {showNameEditor ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="min-h-10 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
            placeholder="Session name"
          />
          <button
            type="button"
            onClick={handleRename}
            disabled={!nameDraft.trim() || nameDraft.trim() === session.name}
            className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Save name
          </button>
          <button
            type="button"
            onClick={() => setShowNameEditor(false)}
            className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      ) : null}
      <p className="mt-1 text-sm text-slate-400">
        {new Date(session.startTime).toLocaleString()} • {getDuration(session.startTime, session.endTime)}
      </p>
      <div className="mt-2 grid gap-1 text-sm">
        <p>Entries: {session.entryCount ?? 0}</p>
        <p>
          Distance: {formatDistanceKm(getSessionPathDistanceKm(session.path))}
        </p>
        <p>
          Avg speed: {formatAverageSpeedKmh(getSessionAverageSpeedKmh(session))}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Unsynced: {session.unsyncedCount ?? 0} • Failed: {session.failedCount ?? 0} • Dead-letter:{' '}
        {session.deadLetterCount ?? 0}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpen(session.id)}
          className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => onExport(session.id)}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold"
        >
          CSV
        </button>
        <button
          type="button"
          onClick={() => onExportJson(session.id)}
          className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold"
        >
          JSON
        </button>
        <button
          type="button"
          disabled={syncBusy || syncDisabled}
          onClick={() => onSync(session.id)}
          className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {syncBusy ? 'Syncing…' : syncDisabled ? 'Sync unavailable' : 'Sync'}
        </button>
        {session.deadLetterCount > 0 ? (
          <button
            type="button"
            onClick={() => onRetryDeadLetters(session.id)}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            Retry dead-letter
          </button>
        ) : null}
        <button
          type="button"
          disabled={syncBusy || syncDisabled}
          onClick={() => onRetryAndSyncNow(session.id)}
          className="rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {syncBusy ? 'Retry+Sync…' : syncDisabled ? 'Sync unavailable' : 'Retry + Sync now'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(session.id)}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold"
        >
          Delete
        </button>
      </div>
    </article>
  )
}
