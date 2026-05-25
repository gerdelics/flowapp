import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db'
import { parseGpx } from '../utils/gpxParser'
import RouteMap from '../components/RouteMap'

function haversineDistanceMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return 2 * R * Math.asin(Math.sqrt(h))
}

function getRouteLengthKm(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0
  }

  let totalMeters = 0
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    if (
      typeof prev?.lat === 'number' &&
      typeof prev?.lon === 'number' &&
      typeof curr?.lat === 'number' &&
      typeof curr?.lon === 'number'
    ) {
      totalMeters += haversineDistanceMeters(prev, curr)
    }
  }

  return totalMeters / 1000
}

function RouteCard({ route, isSelected, onClick, onEdit, onDelete, lengthKm }) {
  return (
    <div
      className={`w-full rounded-xl border p-3 text-left transition ${
        isSelected
          ? 'border-orange-500 bg-slate-800 ring-2 ring-orange-500/50'
          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {route.city}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-100 sm:text-base">{route.name}</p>
          <p className="mt-1 text-xs text-slate-500">{lengthKm.toFixed(2)} km</p>
        </button>

        <div className="flex shrink-0 items-start gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(route)
            }}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-slate-600"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(route.id)
            }}
            className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
            aria-label="Delete route"
            title="Delete route"
          >
            🗑️
          </button>
        </div>
      </div>

      {isSelected ? (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">Preview</p>
            <p className="text-xs text-slate-500">{route.points?.length ?? 0} points</p>
          </div>
          <RouteMap
            className="h-56 w-full rounded-lg sm:h-64"
            points={route.points}
            fitRoute
            fitRouteKey={route.id}
            showStartEndMarkers
          />
        </div>
      ) : null}
    </div>
  )
}

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
    setCityComboboxOpen(false)
  }, [routes.length])

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
      map.set(route.id, getRouteLengthKm(route.points))
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
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCityComboboxOpen((prev) => !prev)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-500"
                aria-expanded={cityComboboxOpen}
                aria-haspopup="listbox"
              >
                <span className="truncate">{cityFilter || 'All cities'}</span>
                <span
                  className={`text-slate-400 transition ${cityComboboxOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {cityComboboxOpen ? (
                <div
                  className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[40] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleCityFilterPick('')}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
                      !cityFilter ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
                    }`}
                  >
                    <span>All cities</span>
                  </button>
                  <div className="max-h-56 overflow-y-auto border-t border-slate-800">
                    {routeCities.map((cityName) => (
                      <button
                        key={cityName}
                        type="button"
                        onClick={() => handleCityFilterPick(cityName)}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-800 ${
                          cityFilter === cityName ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-200'
                        }`}
                      >
                        <span className="truncate">{cityName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {editingRouteId ? (
          <section className="rounded-xl border border-orange-500/50 bg-slate-900 p-4">
            <h3 className="mb-3 text-sm font-bold text-orange-300">Edit route</h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Route name"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
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
                  <RouteCard
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

      {addModalOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/70 p-3 sm:p-6"
          onClick={closeAddModal}
        >
          <div className="flex min-h-full items-end justify-center sm:items-center">
            <section
              className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100">Add new route</h3>
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="text-sm text-slate-400 hover:text-slate-100"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Budapest"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Route name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Downtown loop"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                    required
                  />
                </div>

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
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}
