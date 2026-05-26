import { IconAvatar, TrafficLevelBadge } from '../atoms'
import { getTrafficLevel } from '../../utils/trafficLevels'

function RecordLevelRow({ name, levelKey, iconUrl }) {
  const level = getTrafficLevel(levelKey)

  return (
    <li className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 shadow-sm ${level.toastClassName}`}>
      <div className="flex min-w-0 items-center gap-2">
        <IconAvatar src={iconUrl} sizeClassName="h-6 w-6" className="p-0.5" />
        <span className="truncate text-sm font-semibold">{name}</span>
      </div>

      <TrafficLevelBadge level={level.key} compact className="shrink-0 bg-black/15" />
    </li>
  )
}

export default function RecordToast({ record, onDismiss }) {
  if (!record) {
    return null
  }

  const channelLabel = record.channel === 'auto' ? 'Automatic reporting' : 'Manual reporting'

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[1100] flex justify-center md:inset-x-auto md:right-4 md:justify-end">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              {channelLabel}
            </p>
            <p className="mt-1 text-base font-bold text-slate-50">New record saved</p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(record.timestamp).toLocaleString()}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Dismiss
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          <RecordLevelRow name="Observer" levelKey={record.observerAssessment} />

          {(record.providers || []).length ? (
            record.providers.map((provider) => (
              <RecordLevelRow
                key={`${provider.name}-${provider.level}`}
                name={provider.name}
                levelKey={provider.level}
                iconUrl={provider.iconUrl}
              />
            ))
          ) : (
            <li className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-400">
              No active providers were selected
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
