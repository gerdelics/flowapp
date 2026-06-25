import { useCallback, useState } from 'react'

// Map zoom is a per-device preference, not shared app state, so it lives in
// localStorage rather than the Firebase-synced settings.
const STORAGE_KEY = 'flowapp_map_zoom'
const DEFAULT_ZOOM = 14
const MIN_ZOOM = 1
const MAX_ZOOM = 19

function readZoom() {
  const raw = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(raw) && raw >= MIN_ZOOM && raw <= MAX_ZOOM ? Math.round(raw) : DEFAULT_ZOOM
}

export function useMapZoom() {
  const [zoom, setZoomState] = useState(readZoom)

  const setZoom = useCallback((next) => {
    if (!Number.isFinite(next)) {
      return
    }
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next)))
    setZoomState((prev) => {
      if (prev === clamped) {
        return prev
      }
      try {
        localStorage.setItem(STORAGE_KEY, String(clamped))
      } catch {
        // Storage unavailable — keep the in-memory value.
      }
      return clamped
    })
  }, [])

  return { zoom, setZoom }
}
