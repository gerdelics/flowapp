import { getTrafficLevel } from '../../utils/trafficLevels'

export default function TrafficLevelBadge({
  level,
  compact = false,
  showFallback = true,
  className = '',
}) {
  if (!level && showFallback) {
    return <span className="text-slate-400">—</span>
  }

  const trafficLevel = getTrafficLevel(level)

  return (
    <span
      className={`inline-flex min-w-20 justify-center rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${trafficLevel.badgeClassName} ${className}`.trim()}
    >
      {compact ? trafficLevel.shortLabel : trafficLevel.badgeLabel}
    </span>
  )
}
