import { useCallback, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { haversineKm } from '../utils/sessionMetrics'
import { DEFAULT_POI_TYPE } from '../utils/poiTypes'

// In-memory POI store for the PoC POIs page. Markers live only in component
// state, so they reset on reload. The display number of each POI is its index
// in the array (creation order), which means deletions renumber automatically.
export function usePois() {
  const [pois, setPois] = useState([])

  const addPoi = useCallback((lat, lon, details = {}) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null
    }
    const poi = {
      id: uuidv4(),
      lat,
      lon,
      done: false,
      description: details.description?.trim() || '',
      type: details.type || DEFAULT_POI_TYPE,
    }
    setPois((prev) => [...prev, poi])
    return poi
  }, [])

  const editPoi = useCallback((id, patch) => {
    setPois((prev) =>
      prev.map((poi) => (poi.id === id ? { ...poi, ...patch } : poi)),
    )
  }, [])

  const toggleDone = useCallback((id) => {
    setPois((prev) =>
      prev.map((poi) => (poi.id === id ? { ...poi, done: !poi.done } : poi)),
    )
  }, [])

  const deletePoi = useCallback((id) => {
    setPois((prev) => prev.filter((poi) => poi.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setPois([])
  }, [])

  // Id of the not-done POI closest to the current GPS location. Done POIs are
  // excluded so they always stay green and never steal the "nearest" colour.
  const getNearestId = useCallback(
    (currentLocation) => {
      if (
        !currentLocation ||
        !Number.isFinite(currentLocation.lat) ||
        !Number.isFinite(currentLocation.lon)
      ) {
        return null
      }

      let nearestId = null
      let nearestKm = Infinity
      for (const poi of pois) {
        if (poi.done) {
          continue
        }
        const distanceKm = haversineKm(currentLocation, poi)
        if (distanceKm < nearestKm) {
          nearestKm = distanceKm
          nearestId = poi.id
        }
      }
      return nearestId
    },
    [pois],
  )

  return useMemo(
    () => ({ pois, addPoi, editPoi, toggleDone, deletePoi, clearAll, getNearestId }),
    [pois, addPoi, editPoi, toggleDone, deletePoi, clearAll, getNearestId],
  )
}
