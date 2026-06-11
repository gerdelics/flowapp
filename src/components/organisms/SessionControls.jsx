import { RouteOverlayLoader } from '../molecules'

// The "Active session" panel: name editing, start/stop/pause/auto/record
// controls, live status and the planned-route loader. Extracted from
// RecordingPage so the page reads as a thin orchestrator.
export default function SessionControls({
  sessionName,
  sessionActive,
  sessionPaused,
  sessionNameDraft,
  onNameDraftChange,
  onRename,
  renamingSession,
  startingSession,
  onStart,
  stoppingSession,
  onStop,
  togglingPause,
  onTogglePause,
  autoEnabled,
  onToggleAuto,
  recordButtonLabel,
  onRecordNow,
  recordDisabled,
  lastRecordedAt,
  permissionState,
  hasFix,
  wakeLockEnabled,
  wakeLockSupported,
  savedRoutes,
  selectedOverlayRouteId,
  onOpenPicker,
  onClearOverlayRoute,
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <p className="text-sm text-slate-400">Active session</p>
      <p className="mt-1 text-xl font-bold">{sessionName}</p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={sessionNameDraft}
          onChange={(e) => onNameDraftChange(e.target.value)}
          placeholder="Session name (before start or during recording)"
          className="min-h-11 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
        />
        {sessionActive ? (
          <button
            type="button"
            onClick={onRename}
            disabled={renamingSession || !sessionNameDraft.trim()}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {renamingSession ? 'Saving…' : 'Rename'}
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        {!sessionActive ? (
          <button
            type="button"
            disabled={startingSession}
            onClick={onStart}
            className="min-h-12 rounded-lg bg-emerald-600 px-4 py-2 text-base font-bold disabled:opacity-50"
          >
            {startingSession ? 'STARTING…' : 'START SESSION'}
          </button>
        ) : (
          <button
            type="button"
            disabled={stoppingSession}
            onClick={onStop}
            className="min-h-12 rounded-lg bg-red-600 px-4 py-2 text-base font-bold disabled:opacity-50"
          >
            {stoppingSession ? 'STOPPING…' : 'STOP SESSION'}
          </button>
        )}

        {sessionActive ? (
          <button
            type="button"
            disabled={togglingPause}
            onClick={onTogglePause}
            className="min-h-12 rounded-lg bg-amber-500 px-4 py-2 text-base font-bold text-slate-950 disabled:opacity-50"
          >
            {togglingPause
              ? sessionPaused
                ? 'RESUMING…'
                : 'PAUSING…'
              : sessionPaused
                ? 'RESUME SESSION'
                : 'PAUSE SESSION'}
          </button>
        ) : null}

        <button
          type="button"
          disabled={!sessionActive}
          onClick={onToggleAuto}
          className="min-h-12 rounded-lg bg-slate-700 px-4 py-2 text-base font-bold disabled:opacity-50"
        >
          Auto-record: {autoEnabled ? 'ON' : 'OFF'}
        </button>

        <button
          type="button"
          disabled={recordDisabled}
          onClick={onRecordNow}
          className="min-h-12 rounded-lg bg-cyan-500 px-4 py-2 text-base font-bold text-slate-950 disabled:opacity-50"
        >
          {recordButtonLabel}
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-400">
        Last recorded: {lastRecordedAt ? new Date(lastRecordedAt).toLocaleString() : '—'}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        GPS: {permissionState} {hasFix ? '• fix available' : '• no fix'}
      </p>
      {wakeLockEnabled && !wakeLockSupported ? (
        <p className="mt-1 text-xs text-amber-300">
          Screen wake lock is not supported in this browser. The display may dim during recording.
        </p>
      ) : null}
      {sessionPaused ? (
        <p className="mt-1 text-sm font-semibold text-amber-300">Session is paused.</p>
      ) : null}

      <RouteOverlayLoader
        savedRoutes={savedRoutes}
        selectedOverlayRouteId={selectedOverlayRouteId}
        onOpenPicker={onOpenPicker}
        onClearOverlayRoute={onClearOverlayRoute}
      />
    </div>
  )
}
