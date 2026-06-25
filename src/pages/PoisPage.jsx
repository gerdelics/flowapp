import { useEffect, useMemo, useState } from 'react'
import { useGeolocation } from '../hooks/useGeolocation'
import { usePois } from '../hooks/usePois'
import { useSettings } from '../hooks/useSettings'
import { AddMarkerDialog, PoiActionsDialog, PoiMap } from '../components'
import { isMobileDevice, navigateToPoi } from '../utils/poiNavigation'

function draftFromPoi(poi, isNew) {
  return {
    id: poi.id,
    isNew,
    lat: poi.lat,
    lon: poi.lon,
    type: poi.type,
    description: poi.description,
    approach: poi.approach ?? null,
    done: poi.done,
  }
}

export default function PoisPage() {
  const { settings } = useSettings()
  const { location, startWatching, stopWatching } = useGeolocation()
  const { pois, addPoi, editPoi, deletePoi, clearAll, getNearestId } = usePois()

  // The marker being edited lives entirely in this draft until Save. A freshly
  // dropped marker is added to the store so it shows on the map, but it is
  // removed again on Cancel/outside-click, so nothing is kept unless saved.
  const [editing, setEditing] = useState(null)
  const [placingApproach, setPlacingApproach] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  // Watch GPS while the page is open so the nearest-marker colour stays live.
  useEffect(() => {
    startWatching()
    return () => stopWatching()
  }, [startWatching, stopWatching])

  const mapZoomLevel = settings?.mapZoomLevel ?? 14
  const isMobile = useMemo(() => isMobileDevice(), [])

  const nearestId = useMemo(() => getNearestId(location), [getNearestId, location])

  // Label shown for the marker being edited, following the same rule as the map
  // (done markers show "-"; not-done ones are numbered in order). The draft's
  // done state is used for the edited marker so the label updates immediately.
  const editingLabel = useMemo(() => {
    if (!editing) {
      return ''
    }
    let sequence = 0
    for (const poi of pois) {
      const isDone = poi.id === editing.id ? editing.done : poi.done
      if (!isDone) {
        sequence += 1
      }
      if (poi.id === editing.id) {
        return isDone ? '-' : String(sequence)
      }
    }
    return ''
  }, [pois, editing])

  // A map long-press either places the ráfordító for the marker being edited, or
  // (the default) drops a new marker and opens its draft dialog.
  function handleLongPress(lat, lon) {
    if (placingApproach && editing) {
      setEditing((prev) => ({ ...prev, approach: { lat, lon } }))
      setPlacingApproach(false)
      return
    }
    const poi = addPoi(lat, lon)
    if (poi) {
      setEditing(draftFromPoi(poi, true))
    }
  }

  function handleMarkerClick(id) {
    const poi = pois.find((item) => item.id === id)
    if (poi) {
      setEditing(draftFromPoi(poi, false))
    }
  }

  function handleDraftChange(patch) {
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  function handleSave() {
    if (!editing) {
      return
    }
    editPoi(editing.id, {
      type: editing.type,
      description: editing.description,
      approach: editing.approach,
      done: editing.done,
    })
    setEditing(null)
    setPlacingApproach(false)
  }

  // Cancel (or outside-click) discards the edits. A just-placed marker that was
  // never saved is removed entirely.
  function handleCancel() {
    if (editing?.isNew) {
      deletePoi(editing.id)
    }
    setEditing(null)
    setPlacingApproach(false)
  }

  function handleDelete() {
    if (editing) {
      deletePoi(editing.id)
    }
    setEditing(null)
    setPlacingApproach(false)
  }

  return (
    <div style={{ height: 'calc(100dvh - 7rem)' }}>
      <PoiMap
        className="h-full w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
        pois={pois}
        nearestId={nearestId}
        currentLocation={location}
        defaultZoom={mapZoomLevel}
        onLongPress={handleLongPress}
        onMarkerClick={handleMarkerClick}
        onMovePoi={(id, lat, lon) => editPoi(id, { lat, lon })}
        onMoveApproach={(id, lat, lon) => editPoi(id, { approach: { lat, lon } })}
        onClearAll={clearAll}
        onAddNewMarker={() => setAddOpen(true)}
        placingApproach={placingApproach}
        onCancelPlacement={() => setPlacingApproach(false)}
      />

      <AddMarkerDialog
        key={addOpen ? 'add-open' : 'add-closed'}
        open={addOpen}
        defaultCoords={location ? `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}` : ''}
        onAdd={addPoi}
        onClose={() => setAddOpen(false)}
      />

      <PoiActionsDialog
        key={editing?.id ?? 'none'}
        open={Boolean(editing) && !placingApproach}
        draft={editing}
        number={editingLabel}
        isMobile={isMobile}
        onChange={handleDraftChange}
        onNavigate={navigateToPoi}
        onPlaceApproach={() => setPlacingApproach(true)}
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />
    </div>
  )
}
