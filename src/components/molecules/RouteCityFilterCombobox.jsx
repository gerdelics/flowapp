export default function RouteCityFilterCombobox({
  isOpen,
  selectedCity,
  cities,
  onToggle,
  onSelect,
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-500"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{selectedCity || 'All cities'}</span>
        <span className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[2100] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40">
          <button
            type="button"
            onClick={() => onSelect('')}
            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
              !selectedCity ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
            }`}
          >
            <span>All cities</span>
          </button>

          <div className="max-h-52 overflow-y-auto border-t border-slate-800">
            {cities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => onSelect(city)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
                  selectedCity === city ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
                }`}
              >
                <span className="truncate">{city}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
