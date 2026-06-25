import { useState } from 'react'
import OverlayModal from './OverlayModal'

// Manage the shared city list: add, rename, delete. Cities are the canonical
// pick-list used by routes and sessions.
export default function CitiesManagerModal({ open, onClose, cities = [], onAdd, onRename, onDelete }) {
  const [newCity, setNewCity] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [busy, setBusy] = useState(false)

  const exists = (name, exceptId = null) =>
    cities.some(
      (city) => city.id !== exceptId && city.name.toLowerCase() === name.trim().toLowerCase(),
    )

  const sorted = [...cities].sort((a, b) => a.name.localeCompare(b.name, 'en'))

  async function handleAdd(event) {
    event.preventDefault()
    const trimmed = newCity.trim()
    if (!trimmed) {
      return
    }
    if (exists(trimmed)) {
      setError('That city already exists.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdd(trimmed)
      setNewCity('')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(city) {
    setEditingId(city.id)
    setEditingName(city.name)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName('')
  }

  async function handleSaveEdit(city) {
    const trimmed = editingName.trim()
    if (!trimmed || trimmed === city.name) {
      cancelEdit()
      return
    }
    if (exists(trimmed, city.id)) {
      setError('That city already exists.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onRename(city.id, trimmed, city.name)
      cancelEdit()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(city) {
    const confirmed = window.confirm(
      `Delete city "${city.name}"? It will no longer be selectable. Existing routes and sessions keep their current label.`,
    )
    if (!confirmed) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await onDelete(city.id, city.name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OverlayModal open={open} onClose={onClose} title="Manage cities">
      <div className="flex flex-col gap-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newCity}
            onChange={(e) => {
              setNewCity(e.target.value)
              setError('')
            }}
            placeholder="New city name"
            className="min-h-10 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !newCity.trim()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">No cities yet. Add one above.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800 rounded-lg border border-slate-700">
            {sorted.map((city) => (
              <li key={city.id} className="flex items-center gap-2 px-3 py-2">
                {editingId === city.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value)
                        setError('')
                      }}
                      className="min-h-9 flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(city)}
                      disabled={busy || !editingName.trim()}
                      className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm text-slate-100">{city.name}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(city)}
                      className="rounded-md bg-slate-700 px-3 py-1.5 text-sm font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(city)}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </OverlayModal>
  )
}
