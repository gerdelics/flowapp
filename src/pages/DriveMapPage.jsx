import { useCallback, useEffect, useMemo, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { RouteMap, RouteOverlayLoader, RoutePickerModal, Toggle } from '../components'
import { useGeolocation } from '../hooks/useGeolocation'
import { useSavedRoutes } from '../hooks/useSavedRoutes'
import { useScreenWakeLock } from '../hooks/useScreenWakeLock'
import { useSettings } from '../hooks/useSettings'

export default function DriveMapPage() {
  const geolocation = useGeolocation()
  const { location, permissionState, requestOnce, startWatching, stopWatching } = geolocation
  const { settings, loading, setMapZoomLevel } = useSettings()
  const { routes: savedRoutes, cities: routeCities, filterByCity } = useSavedRoutes()
  const [routeCityFilter, setRouteCityFilter] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [routePoints, setRoutePoints] = useState([])
  const [routePickerOpen, setRoutePickerOpen] = useState(false)
  const [routeCityComboboxOpen, setRouteCityComboboxOpen] = useState(false)
  const [driveModeEnabled, setDriveModeEnabled] = useState(true)
  const [keepScreenOn, setKeepScreenOn] = useState(true)

  const mapZoomLevel = settings?.mapZoomLevel ?? 14
  const routePathColor = settings?.plannedRoutePathColor ?? '#ebfc01'
  // Only hold the wake lock while the user wants the screen kept on (and the
  // hook releases it whenever the tab is hidden). Previously this was hard-wired
  // on, pinning the display awake for as long as the page stayed open.
  const { wakeLockSupported } = useScreenWakeLock(keepScreenOn)

  useEffect(() => {
    requestOnce().catch(() => {
      // Non-blocking geolocation failure.
    })

    startWatching()

    return () => {
      stopWatching()
    }
  }, [requestOnce, startWatching, stopWatching])

  const filteredRoutes = useMemo(
    () => filterByCity(routeCityFilter),
    [filterByCity, routeCityFilter],
  )

  const selectedRoute = useMemo(
    () => savedRoutes.find((route) => route.id === selectedRouteId) || null,
    [savedRoutes, selectedRouteId],
  )

  const handleMapZoomChange = useCallback(
    (nextZoom) => {
      if (!Number.isFinite(nextZoom) || Math.round(nextZoom) === Math.round(mapZoomLevel)) {
        return
      }

      void setMapZoomLevel(Math.round(nextZoom))
    },
    [mapZoomLevel, setMapZoomLevel],
  )

  function handleSelectRoute(id) {
    setSelectedRouteId(id)

    if (!id) {
      setRoutePoints([])
      setRouteCityComboboxOpen(false)
      return
    }

    const route = savedRoutes.find((item) => item.id === id)
    setRoutePoints(route?.points ?? [])
    setRouteCityComboboxOpen(false)
  }

  function handleClearRoute() {
    setSelectedRouteId('')
    setRoutePoints([])
    setRouteCityFilter('')
    setRouteCityComboboxOpen(false)
  }

  function handleCityFilterChange(city) {
    setRouteCityFilter(city)
    setRouteCityComboboxOpen(false)
  }

  function closeRoutePicker() {
    setRoutePickerOpen(false)
    setRouteCityComboboxOpen(false)
  }

  if (loading || !settings) {
    return <p>Loading map…</p>
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] flex-col gap-3">
      <section className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Drive map</h2>
            <p className="text-xs text-slate-400">
              Follow your route without recording. GPS: {permissionState}
              {location ? ' • fix available' : ' • waiting for fix'}
            </p>
          </div>

          {wakeLockSupported ? (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <Toggle checked={keepScreenOn} onChange={setKeepScreenOn} id="keep-screen-on" />
              <span>Keep screen awake</span>
            </label>
          ) : (
            <p className="text-xs text-amber-300">
              Wake lock is not supported in this browser. The display may dim.
            </p>
          )}
        </div>

        <RouteOverlayLoader
          savedRoutes={savedRoutes}
          selectedOverlayRouteId={selectedRouteId}
          onOpenPicker={() => setRoutePickerOpen(true)}
          onClearOverlayRoute={handleClearRoute}
        />
      </section>

      <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
        <RouteMap
          className="h-full w-full"
          points={routePoints}
          pathColor={routePathColor}
          currentLocation={location}
          driveModeEnabled={driveModeEnabled}
          onDriveModeChange={setDriveModeEnabled}
          defaultZoom={mapZoomLevel}
          onZoomLevelChange={handleMapZoomChange}
          fitRoute
          fitRouteKey={selectedRoute?.id || 'empty'}
          showStartEndMarkers
          showCurrentMarker
        />
      </section>

      {routePickerOpen ? (
        <RoutePickerModal
          open={routePickerOpen}
          title="Select route"
          subtitle="Choose a city and then a route to load."
          selectedCity={routeCityFilter}
          onSelectCity={handleCityFilterChange}
          cityComboboxOpen={routeCityComboboxOpen}
          onToggleCityCombobox={() => setRouteCityComboboxOpen((prev) => !prev)}
          cities={routeCities}
          routes={filteredRoutes}
          selectedRouteId={selectedRouteId}
          onDone={handleSelectRoute}
          onClose={closeRoutePicker}
        />
      ) : null}
    </div>
  )
}
