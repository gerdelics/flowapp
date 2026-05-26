import SyncActionButtons from './SyncActionButtons'

export default function SessionsToolbar({
  importingArchive,
  onImportClick,
  syncingAll,
  canSync,
  onRetryDeadLettersAll,
  onRetryAndSyncAll,
  onSyncAll,
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-semibold">Sessions</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={importingArchive}
          onClick={onImportClick}
          className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {importingArchive ? 'Importing…' : 'Import session JSON'}
        </button>
        <SyncActionButtons
          syncing={syncingAll}
          canSync={canSync}
          onRetryDeadLetters={onRetryDeadLettersAll}
          onRetryAndSync={onRetryAndSyncAll}
          onSync={onSyncAll}
          retryLabel="Retry dead-letter (all)"
          retryAndSyncLabel="Retry + Sync now (all)"
          retryAndSyncBusyLabel="Retry+Sync all…"
          syncLabel="Sync all unsynced"
          syncBusyLabel="Syncing all…"
        />
      </div>
    </div>
  )
}
