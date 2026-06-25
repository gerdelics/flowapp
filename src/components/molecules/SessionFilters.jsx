export default function SessionFilters({
  onlyMine,
  onOnlyMineChange,
  city,
  onCityChange,
  cities = [],
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClear,
  hasActiveFilters,
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={onlyMine}
          onChange={(e) => onOnlyMineChange(e.target.checked)}
          className="h-4 w-4 accent-cyan-500"
        />
        Only my sessions
      </label>

      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        City
        <select
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="mt-1 block min-w-32 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-100"
        >
          <option value="">All cities</option>
          {cities.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        From
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="mt-1 block rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm font-normal text-slate-100"
        />
      </label>

      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        To
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => onDateToChange(e.target.value)}
          className="mt-1 block rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm font-normal text-slate-100"
        />
      </label>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
