import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureSettings, subscribeSettings, updateSettings } from '../db'
import { getDefaultProviderIconUrl } from '../utils/providerIconDefaults'

const DEBOUNCE_MS = 400

function moveItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function useSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const pendingWritesRef = useRef(new Map())

  useEffect(() => {
    let unsubscribe = () => {}

    // Persist defaults on first run, then keep settings live across devices.
    ensureSettings().finally(() => {
      unsubscribe = subscribeSettings((data) => {
        setSettings(data)
        setLoading(false)
      })
    })

    return () => unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    const data = await ensureSettings()
    setSettings(data)
    return data
  }, [])

  const patchSettings = useCallback(async (patch) => {
    const next = await updateSettings(patch)
    setSettings(next)
    return next
  }, [])

  // Debounced writer for rapidly-changing inputs (text fields, color pickers,
  // range sliders). Local settings state updates immediately for a responsive
  // UI; the IndexedDB write is coalesced so we don't persist on every keystroke
  // or slider step.
  const patchSettingsDebounced = useCallback((key, patch) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))

    const pending = pendingWritesRef.current
    const existing = pending.get(key)
    if (existing) {
      clearTimeout(existing.timer)
    }

    const timer = setTimeout(async () => {
      pending.delete(key)
      const next = await updateSettings(patch)
      setSettings(next)
    }, DEBOUNCE_MS)

    pending.set(key, { timer, patch })
  }, [])

  // Flush any pending debounced writes when the hook unmounts so edits aren't
  // lost if the user navigates away mid-debounce.
  useEffect(() => {
    const pending = pendingWritesRef.current
    return () => {
      pending.forEach((entry) => {
        clearTimeout(entry.timer)
        void updateSettings(entry.patch)
      })
      pending.clear()
    }
  }, [])

  const setObserverName = useCallback(
    (observerName) => patchSettingsDebounced('observerName', { observerName }),
    [patchSettingsDebounced],
  )

  const setSampleIntervalSec = useCallback(
    (sampleIntervalSec) => patchSettingsDebounced('sampleIntervalSec', { sampleIntervalSec }),
    [patchSettingsDebounced],
  )

  const setRecordingWarningLeadSec = useCallback(
    (recordingWarningLeadSec) =>
      patchSettingsDebounced('recordingWarningLeadSec', { recordingWarningLeadSec }),
    [patchSettingsDebounced],
  )

  const setRecordedPathColor = useCallback(
    (recordedPathColor) => patchSettingsDebounced('recordedPathColor', { recordedPathColor }),
    [patchSettingsDebounced],
  )

  const setPlannedRoutePathColor = useCallback(
    (plannedRoutePathColor) =>
      patchSettingsDebounced('plannedRoutePathColor', { plannedRoutePathColor }),
    [patchSettingsDebounced],
  )

  // Toggles and the map zoom write immediately (single, deliberate actions).
  const setMapZoomLevel = useCallback(
    (mapZoomLevel) => patchSettings({ mapZoomLevel }),
    [patchSettings],
  )

  const setManualBeepEnabled = useCallback(
    (manualBeepEnabled) => patchSettings({ manualBeepEnabled }),
    [patchSettings],
  )

  const setWarningVibrationEnabled = useCallback(
    (warningVibrationEnabled) => patchSettings({ warningVibrationEnabled }),
    [patchSettings],
  )

  const setWarningSoundEnabled = useCallback(
    (warningSoundEnabled) => patchSettings({ warningSoundEnabled }),
    [patchSettings],
  )

  async function toggleProvider(providerId) {
    const nextProviders = settings.providers.map((provider) =>
      provider.id === providerId
        ? { ...provider, active: !provider.active }
        : provider,
    )
    return patchSettings({ providers: nextProviders })
  }

  async function addProvider(name, csvName, options = {}) {
    if (!name.trim() || !csvName.trim()) {
      return settings
    }

    const trimmedName = name.trim()
    const trimmedIconUrl = typeof options?.iconUrl === 'string' ? options.iconUrl.trim() : ''
    const nextActive = typeof options?.active === 'boolean' ? options.active : true

    const provider = {
      id: crypto.randomUUID(),
      name: trimmedName,
      csvName: csvName.trim(),
      active: nextActive,
      iconUrl: trimmedIconUrl || getDefaultProviderIconUrl(trimmedName),
    }

    return patchSettings({ providers: [...settings.providers, provider] })
  }

  async function deleteProvider(providerId) {
    return patchSettings({
      providers: settings.providers.filter((provider) => provider.id !== providerId),
    })
  }

  async function updateProviderIcon(providerId, iconUrl) {
    const nextProviders = settings.providers.map((provider) =>
      provider.id === providerId
        ? { ...provider, iconUrl: iconUrl || '' }
        : provider,
    )
    return patchSettings({ providers: nextProviders })
  }

  async function updateProvider(providerId, patch) {
    const nextProviders = settings.providers.map((provider) => {
      if (provider.id !== providerId) {
        return provider
      }

      const nextName = typeof patch?.name === 'string' ? patch.name.trim() : provider.name
      const nextCsvName = typeof patch?.csvName === 'string' ? patch.csvName.trim() : provider.csvName

      return {
        ...provider,
        ...patch,
        name: nextName || provider.name,
        csvName: nextCsvName || provider.csvName,
      }
    })

    return patchSettings({ providers: nextProviders })
  }

  async function reorderProviders(fromIndex, toIndex) {
    if (!settings?.providers?.length) {
      return settings
    }

    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= settings.providers.length ||
      toIndex >= settings.providers.length ||
      fromIndex === toIndex
    ) {
      return settings
    }

    return patchSettings({ providers: moveItem(settings.providers, fromIndex, toIndex) })
  }

  return {
    settings,
    loading,
    setObserverName,
    setSampleIntervalSec,
    setMapZoomLevel,
    toggleProvider,
    addProvider,
    deleteProvider,
    setManualBeepEnabled,
    setRecordingWarningLeadSec,
    setWarningVibrationEnabled,
    setWarningSoundEnabled,
    setRecordedPathColor,
    setPlannedRoutePathColor,
    updateProviderIcon,
    updateProvider,
    reorderProviders,
    reload,
  }
}
