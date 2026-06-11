const LOW_BATTERY_THRESHOLD = 0.15

function WarningRow({ tone, children }) {
  const toneClasses =
    tone === 'red'
      ? 'bg-red-950/70 text-red-300'
      : 'bg-amber-950/40 text-amber-400'

  return (
    <div className={`flex items-center gap-2 px-3 py-1 ${toneClasses}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="text-xs font-semibold">{children}</span>
    </div>
  )
}

/**
 * Advisory-only banner stack for the recording page: offline, in-recording GPS
 * signal loss, and low battery. None of these change recording behaviour — they
 * just tell the operator what is happening. Renders nothing when all is well.
 */
export default function SystemStatusBanner({
  online = true,
  gpsStale = false,
  gpsSecondsSinceFix = null,
  battery,
}) {
  const lowBattery =
    Boolean(battery?.supported) &&
    typeof battery?.level === 'number' &&
    battery.level <= LOW_BATTERY_THRESHOLD &&
    !battery.charging

  if (online && !gpsStale && !lowBattery) {
    return null
  }

  const batteryPercent =
    typeof battery?.level === 'number' ? Math.round(battery.level * 100) : null

  return (
    <div className="shrink-0">
      {!online ? (
        <WarningRow tone="amber">
          Offline — recording continues, data is saved locally and will sync when
          back online.
        </WarningRow>
      ) : null}

      {gpsStale ? (
        <WarningRow tone="amber">
          GPS signal lost
          {typeof gpsSecondsSinceFix === 'number'
            ? ` — last fix ${gpsSecondsSinceFix}s ago`
            : ''}
          . Recording continues.
        </WarningRow>
      ) : null}

      {lowBattery ? (
        <WarningRow tone="red">
          Battery low{batteryPercent !== null ? ` (${batteryPercent}%)` : ''} — keep
          the device charged to avoid interrupting the recording.
        </WarningRow>
      ) : null}
    </div>
  )
}
