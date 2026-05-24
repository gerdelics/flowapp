const levels = [
  { key: 'free', label: 'FREE', className: 'bg-emerald-600 hover:bg-emerald-500' },
  {
    key: 'medium',
    label: 'MED',
    className: 'bg-amber-500 text-slate-900 hover:bg-amber-400',
  },
  { key: 'heavy', label: 'HEAVY', className: 'bg-red-600 hover:bg-red-500' },
]

function LevelButtons({ value, onPick }) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      {levels.map((level) => (
        <button
          key={level.key}
          type="button"
          onClick={() => onPick(level.key)}
          className={`min-h-14 rounded-lg px-3 py-3 text-sm font-bold tracking-wide transition md:min-h-16 md:text-base ${level.className} ${
            value === level.key ? 'ring-4 ring-white/90' : 'opacity-80'
          }`}
        >
          {level.label}
        </button>
      ))}
    </div>
  )
}

export default function ProviderButtons({
  providers,
  values,
  onChange,
  observerValue,
  onObserverChange,
}) {
  return (
    <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
      {providers.map((provider) => {
        const value = values[provider.name] || 'medium'
        return (
          <div
            key={provider.id}
            className="rounded-xl border border-slate-700 bg-slate-900 p-3"
          >
            <div className="mb-2 flex items-center gap-2.5">
              {provider.iconUrl ? (
                <img
                  src={provider.iconUrl}
                  alt=""
                  className="h-10 w-10 rounded-md bg-white object-contain p-1"
                />
              ) : (
                <div className="h-10 w-10 rounded-md bg-slate-700" />
              )}
              <p className="text-base font-semibold text-slate-100 md:text-lg">{provider.name}</p>
            </div>
            <LevelButtons value={value} onPick={(level) => onChange(provider.name, level)} />
          </div>
        )
      })}

      <div className="rounded-xl border border-cyan-700 bg-cyan-950/30 p-3">
        <p className="mb-2 text-base font-semibold text-cyan-200 md:text-lg">User Perception</p>
        <LevelButtons
          value={observerValue || 'medium'}
          onPick={(level) => onObserverChange(level)}
        />
      </div>
    </div>
  )
}
