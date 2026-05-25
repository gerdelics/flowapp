import { TRAFFIC_LEVELS } from '../../utils/trafficLevels'
import { IconAvatar, TrafficLevelButton } from '../atoms'

export default function TrafficLevelSelector({
  title,
  iconUrl,
  value,
  onSelect,
  compact = false,
}) {
  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900 ${compact ? 'p-2' : 'p-3'}`}>
      <div className={`mb-2 flex items-center gap-2 ${compact ? '' : 'min-h-7'}`}>
        <IconAvatar src={iconUrl} sizeClassName={compact ? 'h-5 w-5' : 'h-7 w-7'} className={compact ? 'p-0.5' : ''} />
        <p className={`${compact ? 'truncate text-xs' : 'text-sm md:text-base'} font-semibold text-slate-100`}>
          {title}
        </p>
      </div>

      <div className={`grid ${compact ? 'grid-cols-3 gap-1.5' : 'grid-cols-1 gap-2'}`}>
        {TRAFFIC_LEVELS.map((level) => (
          <TrafficLevelButton
            key={level.key}
            level={level}
            selected={value === level.key}
            onClick={() => onSelect(level.key)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}
