import { useState } from 'react'
import { IconAvatar, PanelSection, ProviderForm } from '../components'
import { OverlayModal } from '../components'
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
import { getDefaultProviderIconUrl } from '../utils/providerIconDefaults'

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
    updateProvider,
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
  const [isAddProviderModalOpen, setIsAddProviderModalOpen] = useState(false)
  const [isEditProviderModalOpen, setIsEditProviderModalOpen] = useState(false)
  const [editingProviderId, setEditingProviderId] = useState(null)
  const [editNameInput, setEditNameInput] = useState('')
  const [editCsvNameInput, setEditCsvNameInput] = useState('')
  const [editIconUrlInput, setEditIconUrlInput] = useState('')
  const [editActiveInput, setEditActiveInput] = useState(true)

  if (loading || !settings) {
    return <p>Loading settings…</p>
  }

  async function handleAddProvider(event) {
    event.preventDefault()
    if (!nameInput.trim() || !csvNameInput.trim()) {
      return
    }

    await addProvider(nameInput, csvNameInput)
    setNameInput('')
    setCsvNameInput('')
    setIsAddProviderModalOpen(false)
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

  function openAddProviderModal() {
    setNameInput('')
    setCsvNameInput('')
    setIsAddProviderModalOpen(true)
  }

  function openEditProviderModal(provider) {
    setEditingProviderId(provider.id)
    setEditNameInput(provider.name || '')
    setEditCsvNameInput(provider.csvName || '')
    setEditIconUrlInput(provider.iconUrl || '')
    setEditActiveInput(Boolean(provider.active))
    setIsEditProviderModalOpen(true)
  }

  function closeEditProviderModal() {
    setIsEditProviderModalOpen(false)
    setEditingProviderId(null)
    setEditNameInput('')
    setEditCsvNameInput('')
    setEditIconUrlInput('')
    setEditActiveInput(true)
  }

  async function handleSaveProviderEdits(event) {
    event.preventDefault()

    if (!editingProviderId || !editNameInput.trim() || !editCsvNameInput.trim()) {
      return
    }

    await updateProvider(editingProviderId, {
      name: editNameInput,
      csvName: editCsvNameInput,
      iconUrl: editIconUrlInput.trim(),
      active: editActiveInput,
    })

    closeEditProviderModal()
  }

  async function handleLoadDemoData() {
    setDemoLoading(true)
    setDemoMessage('')

    try {
      const baseUrl = import.meta.env.BASE_URL || '/'
      const base = new URL(baseUrl, window.location.origin)

      const gpxUrl = new URL('PENNY Tiszakécske to Gólya u. 1 Track.gpx', base).toString()
      const archiveUrl = new URL(
        'Tiszakécske_kanyar_1-e8ea21f7-b931-4263-9240-6fa4f2e04b46.json',
        base,
      ).toString()

      const [gpxResponse, archiveResponse] = await Promise.all([fetch(gpxUrl), fetch(archiveUrl)])

      if (!gpxResponse.ok) {
        throw new Error('Demo GPX file is not available.')
      }

      if (!archiveResponse.ok) {
        throw new Error('Demo JSON file is not available.')
      }

      const [gpxText, archive] = await Promise.all([gpxResponse.text(), archiveResponse.json()])
      const points = parseGpx(gpxText)

      if (!points.length) {
        throw new Error('Demo GPX does not contain usable points.')
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
        `Demo import complete: route (${route.name}) created, session imported (${imported.importedEntryCount} entries).`,
      )
    } catch (error) {
      setDemoMessage(error?.message || 'Failed to load demo data.')
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
      <OverlayModal
        open={isAddProviderModalOpen}
        onClose={() => setIsAddProviderModalOpen(false)}
        title="Add new provider"
      >
        <ProviderForm
          onSubmit={handleAddProvider}
          submitLabel="Save provider"
          name={nameInput}
          onNameChange={setNameInput}
          csvName={csvNameInput}
          onCsvNameChange={setCsvNameInput}
        />
      </OverlayModal>

      <OverlayModal
        open={isEditProviderModalOpen}
        onClose={closeEditProviderModal}
        title="Edit provider"
      >
        <ProviderForm
          onSubmit={handleSaveProviderEdits}
          submitLabel="Save changes"
          name={editNameInput}
          onNameChange={setEditNameInput}
          csvName={editCsvNameInput}
          onCsvNameChange={setEditCsvNameInput}
          iconUrl={editIconUrlInput}
          onIconUrlChange={setEditIconUrlInput}
          onDefaultIcon={() => setEditIconUrlInput(getDefaultProviderIconUrl(editNameInput))}
          onRemoveIcon={() => setEditIconUrlInput('')}
          active={editActiveInput}
          onActiveChange={setEditActiveInput}
          showAdvancedFields
        />
      </OverlayModal>

      <PanelSection title="General">
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
              Native install prompt is currently unavailable, but you may be able to install from the browser menu.
            </p>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection title="Providers">
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
                    <IconAvatar src={provider.iconUrl} sizeClassName="h-8 w-8" />
                    <p className="font-medium">
                      {provider.name}{' '}
                      <span className="text-xs text-slate-400">({provider.csvName})</span>
                    </p>
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
                    onClick={() => openEditProviderModal(provider)}
                    className="rounded-md bg-slate-700 px-3 py-1.5 text-sm"
                  >
                    Edit
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

        <button
          type="button"
          onClick={openAddProviderModal}
          className="mt-4 px-0 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          + Add new provider
        </button>
      </PanelSection>

      <PanelSection title="Azure Sync Settings">
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
      </PanelSection>

      <PanelSection title="Demo Data">
        <p className="mt-2 text-sm text-slate-400">
          Loads the demo route (Tiszakécske / Arterial 1) from GPX and imports the session JSON.
        </p>

        <button
          type="button"
          disabled={demoLoading}
          onClick={handleLoadDemoData}
          className="mt-3 rounded-md bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {demoLoading ? 'Loading demo…' : 'Load demo data'}
        </button>

        {demoMessage ? (
          <p className="mt-3 text-sm text-slate-200">{demoMessage}</p>
        ) : null}
      </PanelSection>

      <PanelSection
        title="Danger Zone"
        className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950/40"
        titleClassName="text-xl font-semibold text-red-700 dark:text-red-300"
      >
        <button
          type="button"
          onClick={handleExportAll}
          className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Export all data (CSV)
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="mt-3 ml-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Clear all data
        </button>
      </PanelSection>
    </div>
  )
}
