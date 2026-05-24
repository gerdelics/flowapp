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
  currentLocation,
  followCurrent = false,
  showCurrentMarker = true,
  showStartEndMarkers = false,
  fitRoute = true,
  fitRouteKey,
  defaultZoom = 14,
  followZoom = 16,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const pathRef = useRef(null)
  const currentMarkerRef = useRef(null)
  const startMarkerRef = useRef(null)
  const endMarkerRef = useRef(null)
  const routeFittedRef = useRef(false)

  const latLngPoints = useMemo(() => normalizePoints(points), [points])

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
      preferCanvas: true,
    }).setView(DEFAULT_CENTER, defaultZoom)

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map)

    mapRef.current = map

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

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      pathRef.current = null
      currentMarkerRef.current = null
      startMarkerRef.current = null
      endMarkerRef.current = null
      routeFittedRef.current = false
    }
  }, [defaultZoom])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    if (latLngPoints.length > 0) {
      if (!pathRef.current) {
        pathRef.current = L.polyline(latLngPoints, {
          color: '#22d3ee',
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
    if (!map) {
      return
    }

    if (
      !currentLocation ||
      typeof currentLocation.lat !== 'number' ||
      typeof currentLocation.lon !== 'number'
    ) {
      if (currentMarkerRef.current) {
        map.removeLayer(currentMarkerRef.current)
        currentMarkerRef.current = null
      }
      return
    }

    const latLng = [currentLocation.lat, currentLocation.lon]

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

  return <div ref={containerRef} className={className || 'h-full w-full rounded-md'} />
}
