import { useState } from 'react'
import {
  clearAllData,
  db,
  getAllEntries,
  importSessionArchive,
  setSessionPlannedRoute,
} from '../db'
import { useGeolocation } from '../hooks/useGeolocation'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useSettings } from '../hooks/useSettings'
import { exportLegacyCsv } from '../utils/csvExport'
import { parseGpx } from '../utils/gpxParser'

export default function SettingsPage() {
  const {
    settings,
    loading,
    setObserverName,
    setSampleIntervalSec,
    setManualBeepEnabled,
    toggleProvider,
    addProvider,
    deleteProvider,
    updateProviderIcon,
    reorderProviders,
    setAzureConfig,
    reload,
  } = useSettings()
  const geolocation = useGeolocation()
  const { canInstall, isInstalled, triggerInstall, triggerInstallHelp, triggerUninstallHelp } = useInstallPrompt()

  const [nameInput, setNameInput] = useState('')
  const [csvNameInput, setCsvNameInput] = useState('')
  const [draggedProviderId, setDraggedProviderId] = useState(null)
  const [dropTargetProviderId, setDropTargetProviderId] = useState(null)
  const [dropTargetPosition, setDropTargetPosition] = useState('before')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoMessage, setDemoMessage] = useState('')

  if (loading || !settings) {
    return <p>Loading settings…</p>
  }

  async function handleAddProvider(event) {
    event.preventDefault()
    await addProvider(nameInput, csvNameInput)
    setNameInput('')
    setCsvNameInput('')
  }

  async function handleClear() {
    const ok = window.confirm('This will remove all sessions and entries. Continue?')
    if (!ok) {
      return
    }
    await clearAllData()
    await reload()
  }

  async function handleExportAll() {
    const entries = await getAllEntries()
    exportLegacyCsv(entries, settings, 'all-sessions-export.csv')
  }

  async function handleRequestGpsPermission() {
    await geolocation.refreshPermission()
    await geolocation.requestOnce()
  }

  async function handleProviderIconUpload(providerId, file) {
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      await updateProviderIcon(providerId, typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsDataURL(file)
  }

  async function handleLoadDemoData() {
    setDemoLoading(true)
    setDemoMessage('')

    try {
      const gpxUrl = encodeURI('/PENNY Tiszakécske to Gólya u. 1 Track.gpx')
      const archiveUrl = encodeURI('/Tiszakécske_kanyar_1-e8ea21f7-b931-4263-9240-6fa4f2e04b46.json')

      const [gpxResponse, archiveResponse] = await Promise.all([fetch(gpxUrl), fetch(archiveUrl)])

      if (!gpxResponse.ok) {
        throw new Error('A demo GPX fájl nem érhető el.')
      }

      if (!archiveResponse.ok) {
        throw new Error('A demo JSON fájl nem érhető el.')
      }

      const [gpxText, archive] = await Promise.all([gpxResponse.text(), archiveResponse.json()])
      const points = parseGpx(gpxText)

      if (!points.length) {
        throw new Error('A demo GPX nem tartalmaz használható pontokat.')
      }

      const routeId = archive?.session?.plannedRouteId || crypto.randomUUID()
      const route = {
        id: routeId,
        city: 'Tiszakécske',
        name: 'Arterial 1',
        points,
        createdAt: new Date().toISOString(),
      }

      await db.routes.put(route)

      const imported = await importSessionArchive(archive)
      await setSessionPlannedRoute(imported.session.id, route.id)

      setDemoMessage(
        `Demo import kész: útvonal (${route.name}) létrehozva, session importálva (${imported.importedEntryCount} bejegyzés).`,
      )
    } catch (error) {
      setDemoMessage(error?.message || 'A demo adatok betöltése sikertelen.')
    } finally {
      setDemoLoading(false)
    }
  }

  function updateDropPreview(providerId, position) {
    setDropTargetProviderId((currentProviderId) =>
      currentProviderId === providerId ? currentProviderId : providerId,
    )
    setDropTargetPosition((currentPosition) =>
      currentPosition === position ? currentPosition : position,
    )
  }

  async function handleDropProvider(targetProviderId, insertPosition = 'before') {
    if (!draggedProviderId || draggedProviderId === targetProviderId) {
      setDraggedProviderId(null)
      setDropTargetProviderId(null)
      setDropTargetPosition('before')
      return
    }

    const fromIndex = settings.providers.findIndex((provider) => provider.id === draggedProviderId)
    const toIndex = settings.providers.findIndex((provider) => provider.id === targetProviderId)

    if (fromIndex < 0 || toIndex < 0) {
      setDraggedProviderId(null)
      setDropTargetProviderId(null)
      setDropTargetPosition('before')
      return
    }

    let insertIndex = insertPosition === 'after' ? toIndex + 1 : toIndex
    if (fromIndex < insertIndex) {
      insertIndex -= 1
    }

    await reorderProviders(fromIndex, insertIndex)

    setDraggedProviderId(null)
    setDropTargetProviderId(null)
    setDropTargetPosition('before')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold">General</h2>
        <label className="mt-3 block text-sm text-slate-300">
          Observer name
          <input
            type="text"
            value={settings.observerName}
            onChange={(e) => setObserverName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          />
        </label>

        <label className="mt-3 block text-sm text-slate-300">
          Sample interval: {settings.sampleIntervalSec}s
          <input
            type="range"
            min={15}
            max={61}
            value={settings.sampleIntervalSec}
            onChange={(e) => setSampleIntervalSec(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>

        <label className="mt-4 flex items-center gap-3 rounded-md border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={settings.manualBeepEnabled}
            onChange={(e) => setManualBeepEnabled(e.target.checked)}
          />
          Manual recording beep enabled
        </label>

        <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-3">
          <p className="text-sm text-slate-300">
            GPS status: <span className="font-semibold text-slate-100">{geolocation.permissionState}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {geolocation.available
              ? 'Geolocation API available'
              : 'Geolocation API is not available in this browser'}
          </p>
          {geolocation.error ? (
            <p className="mt-1 text-xs text-red-300">{geolocation.error}</p>
          ) : null}
          <button
            type="button"
            onClick={handleRequestGpsPermission}
            className="mt-2 rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950"
          >
            Request GPS permission
          </button>
        </div>

        <div
          className={`mt-4 rounded-md border p-3 ${
            isInstalled
              ? 'border-emerald-600/40 bg-emerald-950/20'
              : 'border-slate-700 bg-slate-800'
          }`}
        >
          <p className="text-sm text-slate-200">
            App status on this device:{' '}
            <span className={`font-semibold ${isInstalled ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isInstalled ? 'Installed' : 'Not installed'}
            </span>
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={canInstall ? triggerInstall : triggerInstallHelp}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                canInstall
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Install app
            </button>

            <button
              type="button"
              onClick={triggerUninstallHelp}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                isInstalled
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Uninstall app
            </button>
          </div>

          {!canInstall && !isInstalled ? (
            <p className="mt-2 text-xs text-slate-400">
              A natív install prompt most nem érhető el, de a böngésző menüjéből telepíthető lehet.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold">Providers</h2>
        <p className="mt-2 text-sm text-slate-400">
          Drag and drop a provider to change its order.
        </p>
        <div className="mt-3 space-y-2">
          {settings.providers.map((provider) => (
            <div key={provider.id} className="space-y-2">
              {draggedProviderId &&
              dropTargetProviderId === provider.id &&
              dropTargetPosition === 'before' ? (
                <div
                  className="mx-1 h-3 rounded-lg border border-dashed border-cyan-400/70 bg-cyan-400/10 shadow-inner shadow-cyan-400/10 transition-all duration-100"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    updateDropPreview(provider.id, 'before')
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    void handleDropProvider(provider.id, 'before')
                  }}
                />
              ) : null}

              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', provider.id)
                  setDraggedProviderId(provider.id)
                }}
                onDragEnd={() => {
                  setDraggedProviderId(null)
                  setDropTargetProviderId(null)
                  setDropTargetPosition('before')
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'

                  const rect = e.currentTarget.getBoundingClientRect()
                  const shouldDropAfter = e.clientY > rect.top + rect.height / 2

                  updateDropPreview(provider.id, shouldDropAfter ? 'after' : 'before')
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  void handleDropProvider(provider.id, dropTargetPosition)
                }}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-800 p-2 transition duration-150 ease-out ${
                  draggedProviderId === provider.id
                    ? 'border-cyan-400/90 bg-slate-700/90 shadow-xl shadow-cyan-400/15 ring-2 ring-cyan-400/25 scale-[1.01]'
                    : dropTargetProviderId === provider.id
                      ? 'border-cyan-400 ring-2 ring-cyan-400/30'
                      : 'border-slate-700'
                } cursor-grab select-none active:cursor-grabbing touch-none`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="select-none text-slate-500" aria-hidden="true">
                      ⋮⋮
                    </span>
                    {provider.iconUrl ? (
                      <img
                        src={provider.iconUrl}
                        alt=""
                        className="h-8 w-8 rounded bg-white object-contain p-1"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-700" />
                    )}
                    <p className="font-medium">{provider.name}</p>
                  </div>
                  <p className="text-xs text-slate-400">CSV: {provider.csvName}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded bg-slate-700 px-2 py-1 text-xs">
                      Upload icon
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleProviderIconUpload(provider.id, e.target.files?.[0])}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => updateProviderIcon(provider.id, '')}
                      className="rounded bg-slate-700 px-2 py-1 text-xs"
                    >
                      Remove icon
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleProvider(provider.id)}
                    className="rounded-md bg-slate-700 px-3 py-1.5 text-sm"
                  >
                    {provider.active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProvider(provider.id)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {draggedProviderId &&
              dropTargetProviderId === provider.id &&
              dropTargetPosition === 'after' ? (
                <div
                  className="mx-1 h-3 rounded-lg border border-dashed border-cyan-400/70 bg-cyan-400/10 shadow-inner shadow-cyan-400/10 transition-all duration-100"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    updateDropPreview(provider.id, 'after')
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    void handleDropProvider(provider.id, 'after')
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddProvider} className="mt-4 grid gap-2 md:grid-cols-3">
          <input
            type="text"
            placeholder="Provider name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          />
          <input
            type="text"
            placeholder="CSV name"
            value={csvNameInput}
            onChange={(e) => setCsvNameInput(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-md bg-cyan-500 px-3 py-2 font-semibold text-slate-950"
          >
            Add provider
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold">Azure Sync Settings</h2>
        <label className="mt-3 block text-sm text-slate-300">
          Endpoint URL
          <input
            type="text"
            value={settings.azureEndpointUrl}
            onChange={(e) => setAzureConfig(e.target.value, settings.azureApiKey)}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          />
        </label>
        <label className="mt-3 block text-sm text-slate-300">
          API key
          <input
            type="text"
            value={settings.azureApiKey}
            onChange={(e) => setAzureConfig(settings.azureEndpointUrl, e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2"
          />
        </label>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h2 className="text-xl font-semibold">Demo Data</h2>
        <p className="mt-2 text-sm text-slate-400">
          Betölti a demo útvonalat (Tiszakécske / Arterial 1) GPX-ből és importálja a session JSON-t.
        </p>

        <button
          type="button"
          disabled={demoLoading}
          onClick={handleLoadDemoData}
          className="mt-3 rounded-md bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {demoLoading ? 'Demo betöltés…' : 'Load demo data'}
        </button>

        {demoMessage ? (
          <p className="mt-3 text-sm text-slate-200">{demoMessage}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-red-700 bg-red-950/40 p-4">
        <h2 className="text-xl font-semibold text-red-300">Danger Zone</h2>
        <button
          type="button"
          onClick={handleExportAll}
          className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold"
        >
          Export all data (CSV)
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 ml-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold"
        >
          Clear all data
        </button>
      </section>
    </div>
  )
}
