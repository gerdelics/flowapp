import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'

const DEFAULT_CENTER = [47.4979, 19.0402]
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors'

function normalizePoints(points) {
  if (!Array.isArray(points)) {
    return []
  }

  return points
    .filter((point) => typeof point?.lat === 'number' && typeof point?.lon === 'number')
    .map((point) => [point.lat, point.lon])
}

function RouteMap({
  className,
  points,
  overlayPoints,
  pathColor = '#e002c3',
  overlayPathColor = '#ebfc01',
  currentLocation,
  followCurrent = false,
  onFollowLost,
  onRequestFollow,
  isFollowing = false,
  showCurrentMarker = true,
  showStartEndMarkers = false,
  fitRoute = true,
  fitRouteKey,
  driveModeEnabled,
  onDriveModeChange,
  showMapControls = true,
  showResetControl = true,
  showDriveModeControl = true,
  showFullscreenControl = false,
  showRouteControl = false,
  selectedRouteName,
  onOpenRoutePicker,
  onClearSelectedRoute,
  onRefreshCurrentLocation,
  resetZoomLevel = 16,
  onZoomLevelChange,
  defaultZoom = 14,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const currentLocationRef = useRef(null)
  const pathRef = useRef(null)
  const overlayPathRef = useRef(null)
  const currentMarkerRef = useRef(null)
  const startMarkerRef = useRef(null)
  const endMarkerRef = useRef(null)
  const routeFittedRef = useRef(false)
  const renderedCountRef = useRef(0)
  const prevPathColorRef = useRef(null)
  const driveModeRef = useRef(false)
  const onZoomLevelChangeRef = useRef(onZoomLevelChange)
  const currentZoomRef = useRef(defaultZoom)
  const recenterAfterFullscreenToggleRef = useRef(false)
  const [isMapMaximized, setIsMapMaximized] = useState(false)
  const [mapMountKey, setMapMountKey] = useState(0)

  const isDriveModeEnabled =
    typeof driveModeEnabled === 'boolean' ? driveModeEnabled : Boolean(followCurrent || isFollowing)

  const latLngPoints = useMemo(() => normalizePoints(points), [points])
  const latLngOverlay = useMemo(() => normalizePoints(overlayPoints), [overlayPoints])
  const hasCurrentLocation =
    typeof currentLocation?.lat === 'number' && typeof currentLocation?.lon === 'number'

  useEffect(() => {
    driveModeRef.current = isDriveModeEnabled
  }, [isDriveModeEnabled])

  useEffect(() => {
    onZoomLevelChangeRef.current = onZoomLevelChange
  }, [onZoomLevelChange])

  useEffect(() => {
    routeFittedRef.current = false
  }, [fitRouteKey])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined
    }

    const container = containerRef.current
    if (container._leaflet_id) {
      delete container._leaflet_id
    }

    const map = L.map(container, {
      zoomControl: true,
    }).setView(DEFAULT_CENTER, currentZoomRef.current)

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map)

    mapRef.current = map

    if (recenterAfterFullscreenToggleRef.current && currentLocationRef.current) {
      map.setView(currentLocationRef.current, map.getZoom(), { animate: false })
      recenterAfterFullscreenToggleRef.current = false
    }

    map.on('zoomend', () => {
      currentZoomRef.current = map.getZoom()
      onZoomLevelChangeRef.current?.(Math.round(map.getZoom()))
    })

    const invalidate = () => map.invalidateSize({ pan: false })
    const raf = requestAnimationFrame(invalidate)
    const timeoutA = setTimeout(invalidate, 80)
    const timeoutB = setTimeout(invalidate, 250)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(invalidate)
        : null

    resizeObserver?.observe(container)
    window.addEventListener('resize', invalidate)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timeoutA)
      clearTimeout(timeoutB)
      window.removeEventListener('resize', invalidate)
      resizeObserver?.disconnect()

      const mountedMap = mapRef.current
      mapRef.current = null

      if (mountedMap) {
        mountedMap.remove()
      }

      pathRef.current = null
      overlayPathRef.current = null
      currentMarkerRef.current = null
      startMarkerRef.current = null
      endMarkerRef.current = null
      renderedCountRef.current = 0
      prevPathColorRef.current = null
      routeFittedRef.current = false
    }
  }, [mapMountKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return undefined
    }

    const invalidate = () => map.invalidateSize({ pan: false })
    requestAnimationFrame(invalidate)
    const timeout = setTimeout(invalidate, 60)

    return () => clearTimeout(timeout)
  }, [isMapMaximized])

  useEffect(() => {
    if (!isMapMaximized || typeof document === 'undefined') {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMapMaximized(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMapMaximized])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map._loaded) {
      return
    }

    if (latLngPoints.length > 0) {
      if (!pathRef.current) {
        pathRef.current = L.polyline(latLngPoints, {
          color: pathColor,
          weight: 5,
          opacity: 0.9,
        }).addTo(map)
        renderedCountRef.current = latLngPoints.length
        prevPathColorRef.current = pathColor
      } else {
        // During recording the path grows by appending one point per second.
        // Append just the new tail instead of rebuilding the whole polyline
        // (which is O(n) and grows with trip length). Fall back to a full
        // replace whenever the array isn't a strict extension of what's drawn
        // (new session, loaded route, cleared path).
        const rendered = renderedCountRef.current
        const drawn = pathRef.current.getLatLngs()
        const isAppend =
          rendered > 0 &&
          latLngPoints.length > rendered &&
          drawn.length === rendered &&
          drawn[rendered - 1].lat === latLngPoints[rendered - 1][0] &&
          drawn[rendered - 1].lng === latLngPoints[rendered - 1][1]

        if (isAppend) {
          for (let i = rendered; i < latLngPoints.length; i += 1) {
            pathRef.current.addLatLng(latLngPoints[i])
          }
        } else {
          pathRef.current.setLatLngs(latLngPoints)
        }
        renderedCountRef.current = latLngPoints.length

        if (prevPathColorRef.current !== pathColor) {
          pathRef.current.setStyle({ color: pathColor })
          prevPathColorRef.current = pathColor
        }
      }

      if (showStartEndMarkers) {
        const start = latLngPoints[0]
        const end = latLngPoints[latLngPoints.length - 1]

        if (!startMarkerRef.current) {
          startMarkerRef.current = L.circleMarker(start, {
            radius: 6,
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.9,
          }).addTo(map)
        } else {
          startMarkerRef.current.setLatLng(start)
        }

        if (!endMarkerRef.current) {
          endMarkerRef.current = L.circleMarker(end, {
            radius: 6,
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: 0.9,
          }).addTo(map)
        } else {
          endMarkerRef.current.setLatLng(end)
        }
      }

      if (fitRoute && !isDriveModeEnabled && !routeFittedRef.current) {
        const bounds = pathRef.current.getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [24, 24] })
          routeFittedRef.current = true
        }
      }
    } else {
      if (pathRef.current) {
        map.removeLayer(pathRef.current)
        pathRef.current = null
      }
      if (startMarkerRef.current) {
        map.removeLayer(startMarkerRef.current)
        startMarkerRef.current = null
      }
      if (endMarkerRef.current) {
        map.removeLayer(endMarkerRef.current)
        endMarkerRef.current = null
      }
      renderedCountRef.current = 0
      prevPathColorRef.current = null
      routeFittedRef.current = false
    }
  }, [fitRoute, isDriveModeEnabled, latLngPoints, pathColor, showStartEndMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map._loaded) {
      return
    }

    if (latLngOverlay.length > 0) {
      if (!overlayPathRef.current) {
        overlayPathRef.current = L.polyline(latLngOverlay, {
          color: overlayPathColor,
          weight: 4,
          opacity: 0.85,
          dashArray: '8 5',
        }).addTo(map)
      } else {
        overlayPathRef.current.setLatLngs(latLngOverlay)
        overlayPathRef.current.setStyle({ color: overlayPathColor })
      }
    } else {
      if (overlayPathRef.current) {
        map.removeLayer(overlayPathRef.current)
        overlayPathRef.current = null
      }
    }
  }, [latLngOverlay, overlayPathColor, mapMountKey])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map._loaded) {
      return
    }

    if (
      !currentLocation ||
      typeof currentLocation.lat !== 'number' ||
      typeof currentLocation.lon !== 'number'
    ) {
      currentLocationRef.current = null
      if (currentMarkerRef.current) {
        map.removeLayer(currentMarkerRef.current)
        currentMarkerRef.current = null
      }
      return
    }

    const latLng = [currentLocation.lat, currentLocation.lon]
    currentLocationRef.current = latLng

    if (recenterAfterFullscreenToggleRef.current) {
      map.setView(latLng, map.getZoom(), { animate: false })
      recenterAfterFullscreenToggleRef.current = false
    }

    if (showCurrentMarker) {
      if (!currentMarkerRef.current) {
        currentMarkerRef.current = L.circleMarker(latLng, {
          radius: 6,
          color: '#0ea5e9',
          fillColor: '#0ea5e9',
          fillOpacity: 0.95,
        }).addTo(map)
      } else {
        currentMarkerRef.current.setLatLng(latLng)
      }
    }

    if (isDriveModeEnabled) {
      // Recenter without animation on every GPS fix. Animated pans run an
      // easing loop on the compositor for each fix, keeping the GPU busy
      // continuously while driving — a major battery cost.
      map.setView(latLng, map.getZoom(), { animate: false })
    }
  }, [currentLocation, isDriveModeEnabled, showCurrentMarker])

  useEffect(() => {
    if (!isDriveModeEnabled) {
      return
    }

    const map = mapRef.current
    const latLng = currentLocationRef.current
    if (!map || !latLng) {
      return
    }

    map.setView(latLng, map.getZoom(), { animate: false })
  }, [isDriveModeEnabled])

  const notifyDriveModeChange = useCallback(
    (enabled) => {
      if (onDriveModeChange) {
        onDriveModeChange(enabled)
        return
      }

      if (enabled) {
        onRequestFollow?.()
        return
      }

      onFollowLost?.()
    },
    [onDriveModeChange, onFollowLost, onRequestFollow],
  )

  function handleResetToCurrentLocation() {
    const map = mapRef.current
    const latLng = currentLocationRef.current

    if (!map || !latLng) {
      return
    }

    map.setView(latLng, resetZoomLevel, {
      animate: true,
    })
  }

  function handleToggleDriveMode() {
    const next = !isDriveModeEnabled
    notifyDriveModeChange(next)

    if (!next) {
      return
    }

    const map = mapRef.current
    const latLng = currentLocationRef.current
    if (!map || !latLng) {
      return
    }

    map.setView(latLng, map.getZoom(), { animate: true })
  }

  async function handleToggleFullscreen() {
    recenterAfterFullscreenToggleRef.current = true

    if (mapRef.current) {
      currentZoomRef.current = mapRef.current.getZoom()
    }

    if (onRefreshCurrentLocation) {
      await onRefreshCurrentLocation()
    }

    setIsMapMaximized((prev) => !prev)
    setMapMountKey((prev) => prev + 1)
  }

  const wrapperClassName = isMapMaximized
    ? 'fixed inset-0 z-[1400] h-dvh w-screen isolate bg-slate-950'
    : 'relative h-full w-full isolate bg-slate-950'

  const mapClassName = isMapMaximized
    ? 'relative z-0 h-full w-full'
    : `relative z-0 ${className || 'h-full w-full rounded-md'}`

  const hasSelectedRoute = Boolean(selectedRouteName)

  return (
    <div className={wrapperClassName}>
      <div key={mapMountKey} ref={containerRef} className={mapClassName} />

      {showMapControls ? (
        <div className="absolute right-3 top-3 z-[1000] flex flex-row gap-2">
          {showFullscreenControl ? (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
                isMapMaximized
                  ? 'border-cyan-300 bg-slate-950/95 text-cyan-200 hover:border-cyan-200 hover:bg-slate-900/95 hover:text-cyan-100'
                  : 'border-slate-600 bg-slate-950/85 text-slate-300 hover:border-cyan-400 hover:text-cyan-300'
              }`}
              title={isMapMaximized ? 'Restore map size' : 'Expand map'}
              aria-label={isMapMaximized ? 'Restore map size' : 'Expand map'}
            >
              {isMapMaximized ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="9 3 9 9 3 9" />
                  <polyline points="15 3 15 9 21 9" />
                  <polyline points="9 21 9 15 3 15" />
                  <polyline points="15 21 15 15 21 15" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <polyline points="21 15 21 21 15 21" />
                  <polyline points="3 9 3 3 9 3" />
                </svg>
              )}
            </button>
          ) : null}

          {showRouteControl ? (
            <button
              type="button"
              onClick={onOpenRoutePicker}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 shadow-lg backdrop-blur transition ${
                hasSelectedRoute
                  ? 'border-orange-300 bg-slate-950/95 text-orange-200 hover:border-orange-200 hover:bg-slate-900/95 hover:text-orange-100'
                  : 'border-slate-600 bg-slate-950/85 text-slate-300 hover:border-cyan-400 hover:text-cyan-300'
              }`}
              title={hasSelectedRoute ? 'Replace loaded route' : 'Load route'}
              aria-label={hasSelectedRoute ? 'Replace loaded route' : 'Load route'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M3 7h5l2 2h11" />
                <path d="M3 17h5l2-2h11" />
                <path d="M16 5l2 2-2 2" />
                <path d="M16 13l2 2-2 2" />
              </svg>
              {hasSelectedRoute ? (
                <span className="max-w-[170px] truncate text-xs font-semibold">{selectedRouteName}</span>
              ) : null}
            </button>
          ) : null}

          {showRouteControl && hasSelectedRoute ? (
            <button
              type="button"
              onClick={onClearSelectedRoute}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-950/85 text-slate-400 shadow-lg backdrop-blur transition hover:border-red-400 hover:text-red-300"
              title="Reset selected route"
              aria-label="Reset selected route"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          ) : null}

          {showResetControl ? (
            <button
              type="button"
              onClick={handleResetToCurrentLocation}
              disabled={!hasCurrentLocation}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-950/85 text-slate-300 shadow-lg backdrop-blur transition hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              title="Reset map to current location"
              aria-label="Reset map to current location"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </button>
          ) : null}

          {showDriveModeControl ? (
            <button
              type="button"
              onClick={handleToggleDriveMode}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
                isDriveModeEnabled
                  ? 'border-cyan-300 bg-slate-950/95 text-cyan-200 hover:border-cyan-200 hover:bg-slate-900/95 hover:text-cyan-100'
                  : 'border-slate-600 bg-slate-950/85 text-slate-400 hover:border-slate-400 hover:text-slate-200'
              }`}
              title={isDriveModeEnabled ? 'Auto-follow on – tap to disable' : 'Auto-follow off – tap to enable'}
              aria-label="Toggle drive mode"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default memo(RouteMap)
