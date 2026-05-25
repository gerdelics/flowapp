export const TRAFFIC_LEVELS = [
  {
    key: 'free',
    shortLabel: 'FREE',
    badgeLabel: 'FREEFLOW',
    csvColor: 'Green',
    selectedClassName: 'border-emerald-300 bg-emerald-500 text-white shadow-md hover:bg-emerald-400',
    inactiveClassName: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
    toastClassName: 'bg-emerald-600 text-white',
    badgeClassName: 'bg-emerald-600 text-white',
  },
  {
    key: 'medium',
    shortLabel: 'MED',
    badgeLabel: 'MEDIUM',
    csvColor: 'Yellow',
    selectedClassName: 'border-yellow-200 bg-yellow-400 text-slate-950 shadow-md hover:bg-yellow-300',
    inactiveClassName: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
    toastClassName: 'bg-amber-500 text-slate-950',
    badgeClassName: 'bg-amber-500 text-slate-950',
  },
  {
    key: 'heavy',
    shortLabel: 'HEAVY',
    badgeLabel: 'HIGH',
    csvColor: 'Red',
    selectedClassName: 'border-red-300 bg-red-500 text-white shadow-md hover:bg-red-400',
    inactiveClassName: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700',
    toastClassName: 'bg-red-600 text-white',
    badgeClassName: 'bg-red-600 text-white',
  },
]

export const TRAFFIC_LEVEL_MAP = TRAFFIC_LEVELS.reduce((map, level) => {
  map[level.key] = level
  return map
}, {})

export function getTrafficLevel(level) {
  return TRAFFIC_LEVEL_MAP[level] || TRAFFIC_LEVEL_MAP.medium
}

export function getTrafficCsvColor(level) {
  return getTrafficLevel(level).csvColor || ''
}
