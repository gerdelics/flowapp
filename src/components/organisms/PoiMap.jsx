import { useEffect, useRef } from 'react'
import L from 'leaflet'

const DEFAULT_CENTER = [47.4979, 19.0402]
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors'

const COLOR_DONE = '#22c55e'
const COLOR_NEAREST = '#0ea5e9'
const COLOR_DEFAULT = '#ef4444'

const LONG_PRESS_MS = 500
const MOVE_CANCEL_PX = 10

function poiColor(poi, nearestId) {
  if (poi.done) {
    return COLOR_DONE
  }
  if (poi.id === nearestId) {
    return COLOR_NEAREST
  }
  return COLOR_DEFAULT
}

function buildMarkerIcon(label, color) {
  const html = `<div style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)">${label}</div>`
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
}

const APPROACH_COLOR = '#94a3b8'

function toRad(deg) {
  return (deg * Math.PI) / 180
}

// Initial bearing (degrees, 0 = north, clockwise) from `from` to `to`. Used to
// rotate the direction arrow so it points along the connector toward the marker.
function computeBearing(from, to) {
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const dLon = toRad(to.lon - from.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

function buildArrowIcon(bearing) {
  const html = `<div style="transform:rotate(${bearing}deg);color:${APPROACH_COLOR};font-size:18px;line-height:1;text-shadow:0 0 2px rgba(0,0,0,.6)">▲</div>`
  return L.divIcon({ html, className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
}

// Less prominent dot for the "ráfordító" (approach point).
function buildApproachIcon() {
  const html = `<div style="width:14px;height:14px;border-radius:9999px;background:#64748b;border:1px solid ${APPROACH_COLOR};opacity:.85"></div>`
  return L.divIcon({ html, className: '', iconSize: [14, 14], iconAnchor: [7, 7] })
}

// Long-press a marker (~0.5s) to lift it, then drag and release to reposition.
// A short tap is left untouched so the marker's click handler still fires.
// `onCommit(lat, lon)` runs on release; `clickGuard.dragged` is set so the
// trailing click can be ignored.
function attachLongPressDrag(map, marker, onCommit, clickGuard) {
  const el = marker.getElement()
  if (!el) {
    return
  }

  let timer = null
  let dragging = false
  let startX = 0
  let startY = 0

  const handleMove = (event) => {
    if (!dragging) {
      if (
        timer &&
        (Math.abs(event.clientX - startX) > MOVE_CANCEL_PX ||
          Math.abs(event.clientY - startY) > MOVE_CANCEL_PX)
      ) {
        clearTimeout(timer)
        timer = null
      }
      return
    }
    event.preventDefault()
    marker.setLatLng(map.mouseEventToLatLng(event))
  }

  const handleUp = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    document.removeEventListener('pointermove', handleMove)
    document.removeEventListener('pointerup', handleUp)
    document.removeEventListener('pointercancel', handleUp)
    if (dragging) {
      dragging = false
      map.dragging.enable()
      el.style.cursor = ''
      if (clickGuard) {
        clickGuard.dragged = true
      }
      const { lat, lng } = marker.getLatLng()
      onCommit(lat, lng)
    }
  }

  const handleDown = (event) => {
    startX = event.clientX
    startY = event.clientY
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
    timer = setTimeout(() => {
      timer = null
      dragging = true
      map.dragging.disable()
      el.style.cursor = 'grabbing'
    }, LONG_PRESS_MS)
  }

  el.addEventListener('pointerdown', handleDown)
}

// Draw the "ráfordító" (approach point) for a POI: a dim draggable marker, a
// dashed connector, and an arrow at the midpoint pointing toward the POI.
function addApproachLayers(layer, map, poi, onMoveApproach) {
  const approach = poi.approach
  if (
    !approach ||
    !Number.isFinite(approach.lat) ||
    !Number.isFinite(approach.lon)
  ) {
    return
  }

  L.polyline(
    [
      [approach.lat, approach.lon],
      [poi.lat, poi.lon],
    ],
    { color: APPROACH_COLOR, weight: 2, opacity: 0.7, dashArray: '4 5' },
  ).addTo(layer)

  const midLat = (approach.lat + poi.lat) / 2
  const midLon = (approach.lon + poi.lon) / 2
  L.marker([midLat, midLon], {
    icon: buildArrowIcon(computeBearing(approach, poi)),
    interactive: false,
    keyboard: false,
  }).addTo(layer)

  const approachMarker = L.marker([approach.lat, approach.lon], {
    icon: buildApproachIcon(),
  }).addTo(layer)
  attachLongPressDrag(map, approachMarker, (lat, lon) => onMoveApproach(poi.id, lat, lon))
}

export default function PoiMap({
  className,
  pois = [],
  nearestId = null,
  currentLocation,
  defaultZoom = 14,
  onLongPress,
  onMarkerClick,
  onMovePoi,
  onMoveApproach,
  onClearAll,
  onAddNewMarker,
  placingApproach = false,
  onCancelPlacement,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersLayerRef = useRef(null)
  const currentMarkerRef = useRef(null)
  const centeredRef = useRef(false)

  // Keep latest callbacks/data reachable from the long-press handlers without
  // re-binding native listeners on every render.
  const onLongPressRef = useRef(onLongPress)
  const onMarkerClickRef = useRef(onMarkerClick)
  const onMovePoiRef = useRef(onMovePoi)
  const onMoveApproachRef = useRef(onMoveApproach)
  useEffect(() => {
    onLongPressRef.current = onLongPress
    onMarkerClickRef.current = onMarkerClick
    onMovePoiRef.current = onMovePoi
    onMoveApproachRef.current = onMoveApproach
  })

  // Map initialization (mirrors RouteMap's setup).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined
    }

    const container = containerRef.current
    if (container._leaflet_id) {
      delete container._leaflet_id
    }

    const map = L.map(container, { zoomControl: true }).setView(DEFAULT_CENTER, defaultZoom)
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map)
    markersLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const invalidate = () => map.invalidateSize({ pan: false })
    const raf = requestAnimationFrame(invalidate)
    const timeoutA = setTimeout(invalidate, 80)
    const timeoutB = setTimeout(invalidate, 250)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(invalidate) : null
    resizeObserver?.observe(container)
    window.addEventListener('resize', invalidate)

    // Long-press to drop a marker: works for a held left-press on desktop and a
    // long-tap on touch. A move beyond the threshold (i.e. a map drag) or an
    // early release cancels it.
    let pressTimer = null
    let startX = 0
    let startY = 0
    let pressCoords = null

    const clearPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer)
        pressTimer = null
      }
      pressCoords = null
    }

    const onPointerDown = (event) => {
      // Ignore presses that begin on an existing marker.
      if (event.target?.closest?.('.leaflet-marker-icon')) {
        return
      }
      startX = event.clientX
      startY = event.clientY
      pressCoords = { clientX: event.clientX, clientY: event.clientY }
      clearTimeout(pressTimer)
      pressTimer = setTimeout(() => {
        pressTimer = null
        if (!pressCoords) {
          return
        }
        const latlng = map.mouseEventToLatLng(pressCoords)
        onLongPressRef.current?.(latlng.lat, latlng.lng)
      }, LONG_PRESS_MS)
    }

    const onPointerMove = (event) => {
      if (!pressTimer) {
        return
      }
      if (
        Math.abs(event.clientX - startX) > MOVE_CANCEL_PX ||
        Math.abs(event.clientY - startY) > MOVE_CANCEL_PX
      ) {
        clearPress()
      }
    }

    const suppressContextMenu = (event) => event.preventDefault()

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', clearPress)
    container.addEventListener('pointercancel', clearPress)
    container.addEventListener('pointerleave', clearPress)
    container.addEventListener('contextmenu', suppressContextMenu)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timeoutA)
      clearTimeout(timeoutB)
      clearPress()
      window.removeEventListener('resize', invalidate)
      resizeObserver?.disconnect()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', clearPress)
      container.removeEventListener('pointercancel', clearPress)
      container.removeEventListener('pointerleave', clearPress)
      container.removeEventListener('contextmenu', suppressContextMenu)

      const mountedMap = mapRef.current
      mapRef.current = null
      markersLayerRef.current = null
      currentMarkerRef.current = null
      centeredRef.current = false
      if (mountedMap) {
        mountedMap.remove()
      }
    }
  }, [defaultZoom])

  // Render POI markers whenever the list or nearest target changes.
  useEffect(() => {
    const layer = markersLayerRef.current
    if (!layer) {
      return
    }

    const map = mapRef.current
    layer.clearLayers()
    // Only not-done markers are numbered (1, 2, 3…); done markers show "-" and
    // are skipped, so the sequence closes up when one is marked done.
    let sequence = 0
    pois.forEach((poi) => {
      // Approach layers first so the numbered marker sits on top of them.
      addApproachLayers(layer, map, poi, (id, lat, lon) =>
        onMoveApproachRef.current?.(id, lat, lon),
      )

      let label = '-'
      if (!poi.done) {
        sequence += 1
        label = String(sequence)
      }

      const marker = L.marker([poi.lat, poi.lon], {
        icon: buildMarkerIcon(label, poiColor(poi, nearestId)),
      }).addTo(layer)

      const clickGuard = { dragged: false }
      marker.on('click', () => {
        if (clickGuard.dragged) {
          clickGuard.dragged = false
          return
        }
        onMarkerClickRef.current?.(poi.id)
      })
      attachLongPressDrag(
        map,
        marker,
        (lat, lon) => onMovePoiRef.current?.(poi.id, lat, lon),
        clickGuard,
      )
    })
  }, [pois, nearestId])

  // Current GPS position marker, plus a one-time recenter on first fix.
  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const hasFix =
      typeof currentLocation?.lat === 'number' && typeof currentLocation?.lon === 'number'

    if (!hasFix) {
      if (currentMarkerRef.current) {
        map.removeLayer(currentMarkerRef.current)
        currentMarkerRef.current = null
      }
      return
    }

    const latLng = [currentLocation.lat, currentLocation.lon]
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

    if (!centeredRef.current) {
      map.setView(latLng, map.getZoom(), { animate: false })
      centeredRef.current = true
    }
  }, [currentLocation])

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={containerRef} className="h-full w-full" />

      {placingApproach ? null : (
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
          {pois.length > 0 ? (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm font-bold text-slate-100 shadow hover:border-red-500 hover:text-red-300"
            >
              Clear all
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddNewMarker}
            className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm font-bold text-slate-100 shadow hover:border-cyan-500 hover:text-cyan-300"
          >
            Add new marker
          </button>
        </div>
      )}

      {placingApproach ? (
        <div className="absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full bg-cyan-600/90 px-4 py-1.5 text-xs font-bold text-white shadow">
          <span>Long-press the map to place the ráfordító</span>
          <button
            type="button"
            onClick={onCancelPlacement}
            className="rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
          Long-press the map to drop a marker · long-press a marker to move it
        </div>
      )}
    </div>
  )
}
