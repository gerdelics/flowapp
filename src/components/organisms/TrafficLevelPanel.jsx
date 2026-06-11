import { memo, useMemo } from 'react'
import { TrafficLevelSelector } from '../molecules'

// Observer perception + per-provider traffic-level selectors (mobile and
// desktop layouts). Memoized with stable per-provider handlers so the grid is
// untouched by the recording page's per-second countdown re-renders.
function TrafficLevelPanel({
  observerAssessment,
  onObserverSelect,
  providers,
  providerLevels,
  onProviderSelect,
  gridColumns,
}) {
  const providerHandlers = useMemo(() => {
    const handlers = {}
    providers.forEach((provider) => {
      handlers[provider.id] = (level) => onProviderSelect(provider.name, level)
    })
    return handlers
  }, [providers, onProviderSelect])

  return (
    <section className="min-h-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 p-2">
      <div className="grid grid-cols-1 gap-2 md:hidden sm:grid-cols-2">
        <TrafficLevelSelector
          title="User Perception"
          value={observerAssessment}
          onSelect={onObserverSelect}
          compact
        />

        {providers.map((provider) => (
          <TrafficLevelSelector
            key={provider.id}
            title={provider.name}
            iconUrl={provider.iconUrl}
            value={providerLevels[provider.name] || 'medium'}
            onSelect={providerHandlers[provider.id]}
            compact
          />
        ))}
      </div>

      <div className="hidden h-full gap-2 md:grid" style={{ gridTemplateColumns: gridColumns }}>
        <TrafficLevelSelector
          title="User Perception"
          value={observerAssessment}
          onSelect={onObserverSelect}
        />

        {providers.map((provider) => (
          <TrafficLevelSelector
            key={provider.id}
            title={provider.name}
            iconUrl={provider.iconUrl}
            value={providerLevels[provider.name] || 'medium'}
            onSelect={providerHandlers[provider.id]}
          />
        ))}
      </div>
    </section>
  )
}

export default memo(TrafficLevelPanel)
