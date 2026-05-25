export default function SessionActionButtons({
  session,
  syncBusy,
  syncDisabled,
  onOpen,
  onExport,
  onExportJson,
  onSync,
  onRetryDeadLetters,
  onRetryAndSyncNow,
  onDelete,
}) {
  return (
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
  )
}
