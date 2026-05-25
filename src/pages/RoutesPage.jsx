import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { OverlayModal, RouteCityFilterCombobox, RouteIdentityFields, RouteListCard } from '../components'
import { db } from '../db'
import { parseGpx } from '../utils/gpxParser'
import { getSessionPathDistanceKm } from '../utils/sessionMetrics'

export default function RoutesPage() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [cityFilter, setCityFilter] = useState('')
  const [cityComboboxOpen, setCityComboboxOpen] = useState(false)

  const [city, setCity] = useState('')
  const [name, setName] = useState('')
  const [gpxFile, setGpxFile] = useState(null)
  const [gpxError, setGpxError] = useState('')
  const [saving, setSaving] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const [editingRouteId, setEditingRouteId] = useState(null)
  const [editCity, setEditCity] = useState('')
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const fileInputRef = useRef(null)

  function loadRoutes() {
    db.routes
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .then(setRoutes)
  }

  useEffect(() => {
    loadRoutes()
  }, [])

  const routeCities = useMemo(() => {
    const unique = Array.from(new Set(routes.map((route) => route.city).filter(Boolean)))
    return unique.sort((a, b) => a.localeCompare(b, 'en'))
  }, [routes])

  const filteredRoutes = useMemo(() => {
    if (!cityFilter) {
      return routes
    }
    return routes.filter((route) => route.city === cityFilter)
  }, [routes, cityFilter])

  useEffect(() => {
    if (!cityComboboxOpen) {
      return undefined
    }

    const onDocumentClick = () => setCityComboboxOpen(false)
    document.addEventListener('click', onDocumentClick)

    return () => {
      document.removeEventListener('click', onDocumentClick)
    }
  }, [cityComboboxOpen])

  const routeLengths = useMemo(() => {
    const map = new Map()
    routes.forEach((route) => {
      map.set(route.id, getSessionPathDistanceKm(route.points))
    })
    return map
  }, [routes])

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null
    setGpxFile(file)
    setGpxError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!city.trim() || !name.trim() || !gpxFile) {
      return
    }

    setSaving(true)
    setGpxError('')
    try {
      const text = await gpxFile.text()
      const points = parseGpx(text)
      if (points.length === 0) {
        setGpxError('No route points were found in the GPX file.')
        return
      }

      const route = {
        id: uuidv4(),
        city: city.trim(),
        name: name.trim(),
        points,
        createdAt: new Date().toISOString(),
      }

      await db.routes.put(route)
      setCity('')
      setName('')
      setGpxFile(null)
      setGpxError('')
      setAddModalOpen(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await loadRoutes()
    } catch (err) {
      setGpxError(err.message || 'Error while processing the GPX file.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await db.routes.delete(id)
    if (selectedRoute?.id === id) {
      setSelectedRoute(null)
    }
    await loadRoutes()
  }

  function closeAddModal() {
    setAddModalOpen(false)
    setGpxError('')
  }

  function openEdit(route) {
    setEditingRouteId(route.id)
    setEditCity(route.city || '')
    setEditName(route.name || '')
    setEditError('')
  }

  function cancelEdit() {
    setEditingRouteId(null)
    setEditCity('')
    setEditName('')
    setEditError('')
  }

  async function handleSaveEdit() {
    if (!editingRouteId || !editCity.trim() || !editName.trim()) {
      return
    }

    setEditSaving(true)
    setEditError('')
    try {
      const existing = await db.routes.get(editingRouteId)
      if (!existing) {
        setEditError('Route not found.')
        return
      }

      const updated = {
        ...existing,
        city: editCity.trim(),
        name: editName.trim(),
      }

      await db.routes.put(updated)

      if (selectedRoute?.id === editingRouteId) {
        setSelectedRoute(updated)
      }

      if (cityFilter && cityFilter !== updated.city) {
        setCityFilter('')
      }

      await loadRoutes()
      cancelEdit()
    } catch (error) {
      setEditError(error?.message || 'Failed to save.')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteEditingRoute() {
    if (!editingRouteId) {
      return
    }

    const confirmed = window.confirm('Are you sure you want to delete this route?')
    if (!confirmed) {
      return
    }

    await handleDelete(editingRouteId)
    cancelEdit()
  }

  function handleCardClick(route) {
    setSelectedRoute((prev) => (prev?.id === route.id ? null : route))
  }

  function handleCityFilterPick(cityName) {
    setCityFilter(cityName)
    setCityComboboxOpen(false)
  }

  return (
    <>
      <div className="grid gap-6">
      {/* Left column: form + route list */}
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-100">Routes</h2>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-cyan-500"
            >
              + New route
            </button>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Filter by city
            </label>
            <div
              className="relative"
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <RouteCityFilterCombobox
                isOpen={cityComboboxOpen}
                selectedCity={cityFilter}
                cities={routeCities}
                onToggle={() => setCityComboboxOpen((prev) => !prev)}
                onSelect={handleCityFilterPick}
              />
            </div>
          </div>
        </section>

        {editingRouteId ? (
          <section className="rounded-xl border border-orange-500/50 bg-slate-900 p-4">
            <h3 className="mb-3 text-sm font-bold text-orange-300">Edit route</h3>
            <div className="flex flex-col gap-3">
              <RouteIdentityFields
                city={editCity}
                onCityChange={setEditCity}
                cityPlaceholder="City"
                name={editName}
                onNameChange={setEditName}
                namePlaceholder="Route name"
              />
              {editError ? <p className="text-xs text-red-400">{editError}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={editSaving || !editCity.trim() || !editName.trim()}
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-orange-400 disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={cancelEdit}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={handleDeleteEditingRoute}
                  className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 hover:border-red-400 hover:text-red-200"
                >
                  Delete route
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Route list */}
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-100">
            Saved routes{filteredRoutes.length > 0 ? ` (${filteredRoutes.length})` : ''}
          </h2>

          {filteredRoutes.length === 0 ? (
            <p className="text-sm text-slate-500">No saved routes yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredRoutes.map((route) => (
                <li key={route.id} className="relative">
                  <RouteListCard
                    route={route}
                    isSelected={selectedRoute?.id === route.id}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    lengthKm={routeLengths.get(route.id) || 0}
                    onClick={() => handleCardClick(route)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      </div>

      <OverlayModal
        open={addModalOpen}
        onClose={closeAddModal}
        title="Add new route"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <RouteIdentityFields
            city={city}
            onCityChange={setCity}
            name={name}
            onNameChange={setName}
            required
          />

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              GPX file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml,application/xml,text/xml"
              onChange={handleFileChange}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-200"
              required
            />
            {gpxError ? <p className="mt-1 text-xs text-red-400">{gpxError}</p> : null}
          </div>

          <button
            type="submit"
            disabled={saving || !city.trim() || !name.trim() || !gpxFile}
            className="min-h-10 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save route'}
          </button>
        </form>
      </OverlayModal>
    </>
  )
}
