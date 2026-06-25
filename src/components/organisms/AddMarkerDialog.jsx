import { useState } from 'react'
import OverlayModal from './OverlayModal'
import { DEFAULT_POI_TYPE, POI_TYPES } from '../../utils/poiTypes'
import { parseCoordinates } from '../../utils/coordinates'

// Manual marker entry. The parent remounts this with a fresh `key` on each open
// so the fields (optionally prefilled from the current GPS fix) reset cleanly.
export default function AddMarkerDialog({
  open,
  defaultCoords = '',
  onAdd,
  onClose,
}) {
  const [coords, setCoords] = useState(defaultCoords)
  const [description, setDescription] = useState('')
  const [type, setType] = useState(DEFAULT_POI_TYPE)

  const parsed = parseCoordinates(coords)
  const valid = parsed !== null

  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none'
  const labelClass = 'text-xs uppercase tracking-wide text-slate-500'

  function handleAdd() {
    if (!parsed) {
      return
    }
    onAdd(parsed.lat, parsed.lon, { description, type })
    onClose()
  }

  return (
    <OverlayModal open={open} onClose={onClose} title="Add new marker" showHeaderClose={false}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Coordinates (lat, lon)</span>
          <input
            type="text"
            value={coords}
            onChange={(event) => setCoords(event.target.value)}
            className={inputClass}
            placeholder="47.49790, 19.04020"
          />
          {coords.trim() && !valid ? (
            <span className="text-xs text-red-400">Enter coordinates as “lat, lon”.</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Description</span>
          <input
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
            placeholder="e.g. Lane closed near the bridge"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={inputClass}
          >
            {POI_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2 border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!valid}
            className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </OverlayModal>
  )
}
