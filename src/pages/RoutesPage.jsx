import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db'
import { parseGpx } from '../utils/gpxParser'
import RouteMap from '../components/RouteMap'

function RouteCard({ route, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition ${
        isSelected
          ? 'border-orange-500 bg-slate-800 ring-2 ring-orange-500/50'
          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{route.city}</p>
      <p className="mt-1 text-base font-bold text-slate-100">{route.name}</p>
      <p className="mt-1 text-xs text-slate-500">
        {route.points?.length ?? 0} pont &bull;{' '}
        {new Date(route.createdAt).toLocaleDateString()}
      </p>
    </button>
  )
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)

  const [city, setCity] = useState('')
  const [name, setName] = useState('')
  const [gpxFile, setGpxFile] = useState(null)
  const [gpxError, setGpxError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

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
        setGpxError('A GPX fájlban nem találhatók útvonalpontok.')
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
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await loadRoutes()
    } catch (err) {
      setGpxError(err.message || 'Hiba a GPX fájl feldolgozásakor.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await db.routes.delete(id)
    if (selectedRoute?.id === id) {
      setSelectedRoute(null)
    }
    setDeleteConfirm(null)
    await loadRoutes()
  }

  function handleCardClick(route) {
    setSelectedRoute((prev) => (prev?.id === route.id ? null : route))
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
      {/* Left column: form + route list */}
      <div className="flex flex-col gap-6">
        {/* Create form */}
        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-4 text-base font-bold text-slate-100">Új útvonal hozzáadása</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Város
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="pl. Budapest"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Útvonal neve
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Belváros körút"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                GPX fájl
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,application/gpx+xml,application/xml,text/xml"
                onChange={handleFileChange}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-200"
                required
              />
              {gpxError ? (
                <p className="mt-1 text-xs text-red-400">{gpxError}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={saving || !city.trim() || !name.trim() || !gpxFile}
              className="min-h-10 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {saving ? 'Mentés…' : 'Útvonal mentése'}
            </button>
          </form>
        </section>

        {/* Route list */}
        <section>
          <h2 className="mb-3 text-base font-bold text-slate-100">
            Mentett útvonalak{routes.length > 0 ? ` (${routes.length})` : ''}
          </h2>

          {routes.length === 0 ? (
            <p className="text-sm text-slate-500">Még nincs mentett útvonal.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {routes.map((route) => (
                <li key={route.id} className="relative">
                  <RouteCard
                    route={route}
                    isSelected={selectedRoute?.id === route.id}
                    onClick={() => handleCardClick(route)}
                  />

                  {/* Delete button */}
                  {deleteConfirm === route.id ? (
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(route.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white hover:bg-red-500"
                      >
                        Törlés megerősítése
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                      >
                        Mégse
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(route.id)
                      }}
                      className="absolute right-2 top-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right column: map preview */}
      <div className="sticky top-6 h-[420px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 md:h-[calc(100dvh-12rem)]">
        {selectedRoute ? (
          <RouteMap
            className="h-full w-full"
            points={selectedRoute.points}
            fitRoute
            fitRouteKey={selectedRoute.id}
            showStartEndMarkers
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Válassz egy útvonalat a megjelenítéshez
          </div>
        )}
      </div>
    </div>
  )
}
