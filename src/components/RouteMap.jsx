import { useEffect, useMemo, useRef } from 'react'
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

export default function RouteMap({
  className,
  points,
  overlayPoints,
  currentLocation,
  followCurrent = false,
  onFollowLost,
  onRequestFollow,
  isFollowing = false,
  showCurrentMarker = true,
  showStartEndMarkers = false,
  fitRoute = true,
  fitRouteKey,
  defaultZoom = 14,
  followZoom = 16,
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
  const followCurrentRef = useRef(followCurrent)
  const onFollowLostRef = useRef(onFollowLost)

  const latLngPoints = useMemo(() => normalizePoints(points), [points])
  const latLngOverlay = useMemo(() => normalizePoints(overlayPoints), [overlayPoints])
  const hasCurrentLocation =
    typeof currentLocation?.lat === 'number' && typeof currentLocation?.lon === 'number'

  useEffect(() => {
    followCurrentRef.current = followCurrent
    onFollowLostRef.current = onFollowLost
  }, [followCurrent, onFollowLost])

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
    }).setView(DEFAULT_CENTER, defaultZoom)

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map)

    mapRef.current = map

    map.on('movestart', (event) => {
      if (event.originalEvent && followCurrentRef.current) {
        onFollowLostRef.current?.()
      }
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
      routeFittedRef.current = false
    }
  }, [defaultZoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map._loaded) {
      return
    }

    if (latLngPoints.length > 0) {
      if (!pathRef.current) {
        pathRef.current = L.polyline(latLngPoints, {
          color: '#e002c3',
          weight: 5,
          opacity: 0.9,
        }).addTo(map)
      } else {
        pathRef.current.setLatLngs(latLngPoints)
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

      if (fitRoute && !followCurrent && !routeFittedRef.current) {
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
      routeFittedRef.current = false
    }
  }, [fitRoute, followCurrent, latLngPoints, showStartEndMarkers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map._loaded) {
      return
    }

    if (latLngOverlay.length > 0) {
      if (!overlayPathRef.current) {
        overlayPathRef.current = L.polyline(latLngOverlay, {
          color: '#ebfc01',
          weight: 4,
          opacity: 0.85,
          dashArray: '8 5',
        }).addTo(map)
      } else {
        overlayPathRef.current.setLatLngs(latLngOverlay)
      }
    } else {
      if (overlayPathRef.current) {
        map.removeLayer(overlayPathRef.current)
        overlayPathRef.current = null
      }
    }
  }, [latLngOverlay])

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

    if (followCurrent) {
      map.setView(latLng, Math.max(map.getZoom(), followZoom))
    }
  }, [currentLocation, followCurrent, followZoom, showCurrentMarker])

  function handleGoToCurrentLocation() {
    const map = mapRef.current
    const latLng = currentLocationRef.current

    if (!map || !latLng) {
      return
    }

    map.setView(latLng, Math.max(map.getZoom(), followZoom), {
      animate: true,
    })
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className={className || 'h-full w-full rounded-md'} />

      <button
        type="button"
        onClick={() => {
          if (isFollowing) {
            onFollowLost?.()
            return
          }

          onRequestFollow?.()
          handleGoToCurrentLocation()
        }}
        disabled={!hasCurrentLocation}
        className={`absolute right-3 top-3 z-[1000] rounded-md border px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isFollowing
            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
            : 'border-slate-700 bg-slate-950/90 text-slate-100 hover:border-cyan-500 hover:text-cyan-300'
        }`}
        title={isFollowing ? 'Following GPS – tap to stop following' : 'Go to current location'}
        aria-label={isFollowing ? 'Stop following current location' : 'Go to current location'}
      >
        {isFollowing ? '⊙ Following GPS' : 'Current location'}
      </button>
    </div>
  )
}
