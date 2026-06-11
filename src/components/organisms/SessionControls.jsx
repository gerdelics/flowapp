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
}) {
  const gpsPermissionDenied = permissionState === 'denied'
  const gpsNoFix = !hasFix && !gpsPermissionDenied

  const statusLabel = !sessionActive
    ? 'No active session'
    : sessionPaused
      ? 'Paused'
      : 'Recording'

  const statusDotClass = !sessionActive
    ? 'bg-slate-500'
    : sessionPaused
      ? 'bg-amber-400'
      : 'bg-emerald-400 animate-pulse'

  const statusTextClass = !sessionActive
    ? 'text-slate-500'
    : sessionPaused
      ? 'text-amber-400'
      : 'text-emerald-400'

  return (
    <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-900 p-4">
      {gpsPermissionDenied ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-700 bg-red-950/60 px-3 py-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-300">GPS access denied</p>
            <p className="text-xs text-red-400/80">Recording is not possible without GPS. Enable location access in browser settings.</p>
          </div>
        </div>
      ) : gpsNoFix ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
          <p className="text-sm text-amber-300">Searching for GPS signal…</p>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${statusDotClass}`} aria-hidden="true" />
        <span className={`text-xs font-semibold uppercase tracking-widest ${statusTextClass}`}>
          {statusLabel}
        </span>
      </div>

      {sessionActive ? (
        <p className="mt-1 truncate text-lg font-bold text-slate-100">{sessionName}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={sessionNameDraft}
          onChange={(e) => onNameDraftChange(e.target.value)}
          placeholder="Session name"
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
          <>
            <button
              type="button"
              disabled={stoppingSession}
              onClick={onStop}
              className="min-h-12 rounded-lg bg-red-600 px-4 py-2 text-base font-bold disabled:opacity-50"
            >
              {stoppingSession ? 'STOPPING…' : 'STOP SESSION'}
            </button>

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
          </>
        )}

        {sessionActive ? (
          <div className="flex min-h-12 items-center justify-between rounded-lg border border-slate-600 bg-slate-800 px-3">
            <span className="text-sm font-semibold text-slate-300">Auto-record</span>
            <button
              type="button"
              onClick={onToggleAuto}
              role="switch"
              aria-checked={autoEnabled}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                autoEnabled ? 'bg-cyan-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  autoEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ) : null}

        {sessionActive ? (
          <button
            type="button"
            disabled={recordDisabled}
            onClick={onRecordNow}
            className="min-h-12 rounded-lg bg-cyan-500 px-4 py-2 text-base font-bold text-slate-950 disabled:opacity-50"
          >
            {recordButtonLabel}
          </button>
        ) : null}
      </div>

      {lastRecordedAt ? (
        <p className="mt-3 text-sm text-slate-400">
          Last recorded: {new Date(lastRecordedAt).toLocaleString()}
        </p>
      ) : null}

      {sessionPaused ? (
        <p className="mt-2 text-sm font-semibold text-amber-300">Session is paused.</p>
      ) : null}

      {wakeLockEnabled && !wakeLockSupported ? (
        <p className="mt-2 text-xs text-amber-300">
          Screen wake lock is not supported in this browser. The display may dim during recording.
        </p>
      ) : null}

    </div>
  )
}
