import { memo, useState } from 'react'
import { formatDistanceStrict } from 'date-fns'
import {
  formatAverageSpeedKmh,
  formatDistanceKm,
  getSessionAverageSpeedKmh,
  getSessionPathDistanceKm,
} from '../../utils/sessionMetrics'

function timeLabel(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? '--:--'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function durationLabel(startTime, endTime) {
  const start = new Date(startTime)
  if (Number.isNaN(start.getTime())) {
    return ''
  }
  return formatDistanceStrict(start, endTime ? new Date(endTime) : new Date())
}

// Compact, expandable session row. Collapsed it's a dense one-liner; expanded it
// reveals metrics and actions (so long lists of sessions stay scannable).
function SessionRow({ session, onOpen, onDelete, onExport, onExportJson, onRename }) {
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(session.name || '')

  const distanceKm = getSessionPathDistanceKm(session.path)

  async function handleRename() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === session.name) {
      setRenaming(false)
      return
    }
    await onRename(session.id, trimmed)
    setRenaming(false)
  }

  return (
    <div className="border-b border-slate-800 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-800/50"
        aria-expanded={expanded}
      >
        <span className="w-12 shrink-0 tabular-nums text-slate-400">{timeLabel(session.startTime)}</span>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-slate-100">{session.name || 'Untitled'}</span>
          {session.city ? <span className="ml-1.5 text-slate-400">· {session.city}</span> : null}
          {!session.endTime ? (
            <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">
              active
            </span>
          ) : null}
        </span>
        <span className="shrink-0 tabular-nums text-xs text-slate-400">
          {session.entryCount ?? 0} · {distanceKm.toFixed(1)} km
        </span>
        <span
          className={`shrink-0 text-slate-500 transition ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {expanded ? (
        <div className="space-y-2 bg-slate-900/40 px-3 pb-3 pt-1">
          <p className="text-xs text-slate-400">
            {new Date(session.startTime).toLocaleString()} · {durationLabel(session.startTime, session.endTime)} ·
            avg {formatAverageSpeedKmh(getSessionAverageSpeedKmh(session))} · {formatDistanceKm(distanceKm)}
          </p>

          {renaming ? (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Session name"
                className="min-h-9 flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleRename}
                disabled={!nameDraft.trim() || nameDraft.trim() === session.name}
                className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false)
                  setNameDraft(session.name || '')
                }}
                className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(session.name || '')
                  setRenaming(true)
                }}
                className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => onExport(session.id)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => onExportJson(session.id)}
                className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold"
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => onDelete(session.id)}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default memo(SessionRow)
