export default function SessionBar({
  sessionActive,
  sessionPaused,
  sessionName,
  sessionCity,
  sessionNameDraft,
  onNameDraftChange,
  cityDraft,
  onCityDraftChange,
  cities = [],
  startingSession,
  startDisabled,
  onStart,
  stoppingSession,
  onStop,
  togglingPause,
  onTogglePause,
  autoEnabled,
  onToggleAuto,
  nextRecordingIn,
  onRecordNow,
  recordDisabled,
  permissionState,
  hasFix,
  showPrimaryAction = true,
}) {
  const gpsDenied = permissionState === 'denied'
  const gpsNoFix = !hasFix && !gpsDenied

  return (
    <div className="shrink-0">
      {gpsDenied ? (
        <div className="flex items-center gap-2 bg-red-950/70 px-3 py-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-xs font-semibold text-red-300">GPS access denied — enable location in browser settings</span>
        </div>
      ) : gpsNoFix ? (
        <div className="flex items-center gap-2 bg-amber-950/40 px-3 py-1">
          <span className="text-xs text-amber-400">Searching for GPS signal…</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${
          !sessionActive ? 'bg-slate-500' :
          sessionPaused ? 'bg-amber-400' :
          'animate-pulse bg-emerald-400'
        }`} aria-hidden="true" />

        {!sessionActive ? (
          <>
            <input
              type="text"
              value={sessionNameDraft}
              onChange={(e) => onNameDraftChange(e.target.value)}
              placeholder="Session name"
              className="min-h-8 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
            <select
              value={cityDraft || ''}
              onChange={(e) => onCityDraftChange(e.target.value)}
              required
              title="City (required, from Routes)"
              className={`min-h-8 w-28 shrink-0 rounded-lg border bg-slate-800 px-2 py-1 text-sm transition focus:border-cyan-500 focus:outline-none ${
                cityDraft ? 'border-slate-600 text-slate-100' : 'border-amber-500/60 text-slate-400'
              }`}
            >
              <option value="" disabled>
                {cities.length === 0 ? 'Add a route' : 'City…'}
              </option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            {showPrimaryAction ? (
              <button
                type="button"
                onClick={onStart}
                disabled={startDisabled}
                className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-bold disabled:opacity-50"
              >
                {startingSession ? 'Starting…' : 'Start session'}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <span className="flex-1 truncate text-sm font-semibold text-slate-100">
              {sessionName}
              {sessionCity ? <span className="ml-1.5 font-normal text-slate-400">· {sessionCity}</span> : null}
            </span>

            {!sessionPaused ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs text-slate-500">Auto</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoEnabled}
                  onClick={onToggleAuto}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${autoEnabled ? 'bg-cyan-500' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${autoEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ) : null}

            {showPrimaryAction && !sessionPaused ? (
              autoEnabled ? (
                <span className="shrink-0 text-xs tabular-nums text-slate-400">⏱ {nextRecordingIn}s</span>
              ) : (
                <button
                  type="button"
                  onClick={onRecordNow}
                  disabled={recordDisabled}
                  className="shrink-0 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  REC
                </button>
              )
            ) : null}

            <button
              type="button"
              onClick={onTogglePause}
              disabled={togglingPause}
              className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {togglingPause
                ? sessionPaused ? 'Resuming…' : 'Pausing…'
                : sessionPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              type="button"
              onClick={onStop}
              disabled={stoppingSession}
              className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-sm font-bold disabled:opacity-50"
            >
              {stoppingSession ? 'Stopping…' : 'Stop'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
