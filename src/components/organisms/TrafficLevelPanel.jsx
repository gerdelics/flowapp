import { memo, useMemo } from 'react'
import { TrafficLevelSelector } from '../molecules'

function TrafficLevelPanel({
  observerAssessment,
  onObserverSelect,
  providers,
  providerLevels,
  onProviderSelect,
  className = '',
}) {
  const providerHandlers = useMemo(() => {
    const handlers = {}
    providers.forEach((provider) => {
      handlers[provider.id] = (level) => onProviderSelect(provider.name, level)
    })
    return handlers
  }, [providers, onProviderSelect])

  return (
    <section className={`overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 ${className}`}>
      <div className="shrink-0 border-b border-slate-700 bg-slate-900/80">
        <TrafficLevelSelector
          title="My perception"
          value={observerAssessment}
          onSelect={onObserverSelect}
          layout="row"
        />
      </div>
      <div className="overflow-y-auto">
        {providers.map((provider) => (
          <TrafficLevelSelector
            key={provider.id}
            title={provider.name}
            iconUrl={provider.iconUrl}
            value={providerLevels[provider.name] || 'medium'}
            onSelect={providerHandlers[provider.id]}
            layout="row"
          />
        ))}
      </div>
    </section>
  )
}

export default memo(TrafficLevelPanel)
