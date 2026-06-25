import { useState } from 'react'
import OverlayModal from './OverlayModal'
import { POI_TYPES } from '../../utils/poiTypes'

// Fully draft-controlled marker editor. All values live in the parent's `draft`
// and are only persisted when the parent handles `onSave`; `onCancel` discards
// them (and drops the marker entirely if it was just placed).
export default function PoiActionsDialog({
  open,
  draft,
  number,
  isMobile = false,
  onChange,
  onNavigate,
  onPlaceApproach,
  onSave,
  onCancel,
  onDelete,
}) {
  const [copyState, setCopyState] = useState(null)

  if (!draft) {
    return null
  }

  const navigateLabel = isMobile ? 'Open in Google Maps' : 'Copy Google Maps link'
  const title = number === '-' ? 'Marker (done)' : `Marker #${number}`
  const inputClass =
    'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none'
  const labelClass = 'text-xs uppercase tracking-wide text-slate-500'

  async function handleNavigate() {
    const result = await onNavigate(draft)
    if (result === 'opened') {
      return
    }
    setCopyState(result === true ? 'copied' : 'error')
  }

  return (
    <OverlayModal
      open={open}
      onClose={onCancel}
      title={title}
      showHeaderClose={false}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-400">
          {draft.lat.toFixed(5)}, {draft.lon.toFixed(5)}
        </p>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Type</span>
          <select
            value={draft.type}
            onChange={(event) => onChange({ type: event.target.value })}
            className={inputClass}
          >
            {POI_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Description</span>
          <input
            type="text"
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            className={inputClass}
            placeholder="Add a description"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Ráfordító</span>
            {draft.approach ? (
              <button
                type="button"
                onClick={() => onChange({ approach: null })}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            ) : null}
          </div>

          {draft.approach ? (
            <span className="text-sm text-slate-200">
              {draft.approach.lat.toFixed(5)}, {draft.approach.lon.toFixed(5)}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onPlaceApproach}
            className="self-start rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-bold text-slate-100 hover:border-cyan-500 hover:text-cyan-300"
          >
            {draft.approach ? 'Replace ráfordító' : 'Add ráfordító'}
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={handleNavigate}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"
          >
            {navigateLabel}
          </button>
          {copyState === 'copied' ? (
            <p className="mt-1 text-center text-xs text-emerald-400">Copied!</p>
          ) : null}
          {copyState === 'error' ? (
            <p className="mt-1 text-center text-xs text-red-400">Copy failed</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onChange({ done: !draft.done })}
          className={`w-full rounded-lg px-4 py-2 text-sm font-bold text-white ${
            draft.done
              ? 'bg-slate-700 hover:bg-slate-600'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {draft.done ? 'Mark as not done' : 'Mark as done'}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
        >
          Delete marker
        </button>

        <div className="flex gap-2 border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"
          >
            Save
          </button>
        </div>
      </div>
    </OverlayModal>
  )
}
