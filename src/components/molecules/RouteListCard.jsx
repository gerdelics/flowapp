import { memo } from 'react'
import RouteMap from '../RouteMap'

function RouteListCard({
  route,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  lengthKm,
  routePathColor,
  compact = false,
}) {
  return (
    <div
      className={`w-full rounded-lg border text-left transition ${compact ? 'p-2' : 'rounded-xl p-3'} ${
        isSelected
          ? 'border-orange-500 bg-slate-800 ring-2 ring-orange-500/50'
          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
      }`}
    >
      <div className={`flex items-center justify-between gap-3 ${compact ? '' : 'items-start'}`}>
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          {compact ? (
            <p className="truncate text-sm font-semibold text-slate-100">
              {route.name}
              <span className="ml-2 text-xs font-normal text-slate-500">{lengthKm.toFixed(2)} km</span>
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {route.city}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-100 sm:text-base">{route.name}</p>
              <p className="mt-1 text-xs text-slate-500">{lengthKm.toFixed(2)} km</p>
            </>
          )}
        </button>

        <div className="flex shrink-0 items-start gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onEdit(route)
            }}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-600"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(route.id)
            }}
            className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
            aria-label="Delete route"
            title="Delete route"
          >
            🗑️
          </button>
        </div>
      </div>

      {isSelected ? (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">Preview</p>
            <p className="text-xs text-slate-500">{route.points?.length ?? 0} points</p>
          </div>
          <RouteMap
            className="h-56 w-full rounded-lg sm:h-64"
            points={route.points}
            pathColor={routePathColor}
            showMapControls={false}
            fitRoute
            fitRouteKey={route.id}
            showStartEndMarkers
          />
        </div>
      ) : null}
    </div>
  )
}

export default memo(RouteListCard)
