import { RouteCityFilterCombobox } from '../molecules'

export default function RoutePickerModal({
  open,
  title = 'Select route',
  subtitle = 'Choose a city and then a route.',
  selectedCity,
  onSelectCity,
  cityComboboxOpen,
  onToggleCityCombobox,
  cities,
  routes,
  selectedRouteId,
  onSelectRoute,
  onClose,
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/95" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-500 sm:px-3 sm:py-2 sm:text-sm"
          >
            Back
          </button>

          <div className="min-w-0 text-center">
            <p className="text-sm font-bold text-slate-100">{title}</p>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-slate-500 sm:px-3 sm:py-2 sm:text-sm"
          >
            Done
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-4 sm:px-6">
        <div className="flex w-full max-w-5xl min-h-0 flex-col gap-4" onClick={(event) => event.stopPropagation()}>
          <RouteCityFilterCombobox
            isOpen={cityComboboxOpen}
            selectedCity={selectedCity}
            cities={cities}
            onToggle={onToggleCityCombobox}
            onSelect={onSelectCity}
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-200">
                Routes{routes.length > 0 ? ` (${routes.length})` : ''}
              </p>
              <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
                Close
              </button>
            </div>

            <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
              {routes.length === 0 ? (
                <li className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-center text-sm text-slate-500">
                  No routes
                </li>
              ) : (
                routes.map((route) => (
                  <li key={route.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRoute(route.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        route.id === selectedRouteId
                          ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <p className="text-sm font-semibold">{route.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{route.city}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
