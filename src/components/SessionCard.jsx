import { formatDistanceStrict } from 'date-fns'

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
  onSync,
  onRetryDeadLetters,
  onRetryAndSyncNow,
  syncBusy,
}) {
  return (
    <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{session.id}</p>
      <h3 className="mt-1 text-base font-semibold">{session.name}</h3>
      <p className="mt-1 text-sm text-slate-400">
        {new Date(session.startTime).toLocaleString()} • {getDuration(session.startTime, session.endTime)}
      </p>
      <p className="mt-2 text-sm">Entries: {session.entryCount ?? 0}</p>
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
          disabled={syncBusy}
          onClick={() => onSync(session.id)}
          className="rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {syncBusy ? 'Syncing…' : 'Sync'}
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
          disabled={syncBusy}
          onClick={() => onRetryAndSyncNow(session.id)}
          className="rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {syncBusy ? 'Retry+Sync…' : 'Retry + Sync now'}
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
