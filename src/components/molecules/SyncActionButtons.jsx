export default function SyncActionButtons({
  syncing,
  canSync,
  onRetryDeadLetters,
  onRetryAndSync,
  onSync,
  retryLabel,
  retryAndSyncLabel,
  retryAndSyncBusyLabel,
  syncLabel,
  syncBusyLabel,
  className = 'flex flex-wrap gap-2',
  buttonClassName = '',
}) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onRetryDeadLetters}
        className={`rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 ${buttonClassName}`.trim()}
      >
        {retryLabel}
      </button>

      <button
        type="button"
        disabled={syncing || !canSync}
        onClick={onRetryAndSync}
        className={`rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-semibold disabled:opacity-50 ${buttonClassName}`.trim()}
      >
        {syncing ? retryAndSyncBusyLabel : canSync ? retryAndSyncLabel : 'Sync unavailable'}
      </button>

      <button
        type="button"
        disabled={syncing || !canSync}
        onClick={onSync}
        className={`rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-50 ${buttonClassName}`.trim()}
      >
        {syncing ? syncBusyLabel : canSync ? syncLabel : 'Sync unavailable'}
      </button>
    </div>
  )
}
