import { useState } from 'react'
import { formatDistanceStrict } from 'date-fns'
import { SessionActionButtons, SessionNameEditor } from './molecules'
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
      <SessionNameEditor
        sessionName={session.name}
        nameDraft={nameDraft}
        setNameDraft={setNameDraft}
        showNameEditor={showNameEditor}
        setShowNameEditor={setShowNameEditor}
        onSave={handleRename}
      />
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
      <SessionActionButtons
        session={session}
        syncBusy={syncBusy}
        syncDisabled={syncDisabled}
        onOpen={onOpen}
        onExport={onExport}
        onExportJson={onExportJson}
        onSync={onSync}
        onRetryDeadLetters={onRetryDeadLetters}
        onRetryAndSyncNow={onRetryAndSyncNow}
        onDelete={onDelete}
      />
    </article>
  )
}
