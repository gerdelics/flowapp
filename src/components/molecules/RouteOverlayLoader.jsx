export default function RouteOverlayLoader({
  savedRoutes,
  selectedOverlayRouteId,
  onOpenPicker,
  onClearOverlayRoute,
}) {
  if (savedRoutes.length === 0) {
    return null
  }

  if (selectedOverlayRouteId) {
    return (
      <div className="mt-4 border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Loaded route</p>
            <p className="truncate text-sm font-semibold text-orange-400">
              {savedRoutes.find((route) => route.id === selectedOverlayRouteId)?.name}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={onOpenPicker}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onClearOverlayRoute}
              className="text-xs text-slate-500 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-slate-700 pt-4">
      <button
        type="button"
        onClick={onOpenPicker}
        className="text-sm text-slate-400 hover:text-slate-100"
      >
        + Load route
      </button>
    </div>
  )
}
