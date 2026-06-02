import { useEffect, useState } from 'react'
import { ensureSettings, updateSettings } from '../db'
import { getDefaultProviderIconUrl } from '../utils/providerIconDefaults'

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

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      const data = await ensureSettings()
      if (mounted) {
        setSettings(data)
        setLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  async function patchSettings(patch) {
    const next = await updateSettings(patch)
    setSettings(next)
    return next
  }

  async function setObserverName(observerName) {
    return patchSettings({ observerName })
  }

  async function setSampleIntervalSec(sampleIntervalSec) {
    return patchSettings({ sampleIntervalSec })
  }

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

  async function setAzureConfig(azureEndpointUrl, azureApiKey) {
    return patchSettings({ azureEndpointUrl, azureApiKey })
  }

  async function setManualBeepEnabled(manualBeepEnabled) {
    return patchSettings({ manualBeepEnabled })
  }

  async function setRecordingWarningLeadSec(recordingWarningLeadSec) {
    return patchSettings({ recordingWarningLeadSec })
  }

  async function setWarningVibrationEnabled(warningVibrationEnabled) {
    return patchSettings({ warningVibrationEnabled })
  }

  async function setWarningSoundEnabled(warningSoundEnabled) {
    return patchSettings({ warningSoundEnabled })
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
    toggleProvider,
    addProvider,
    deleteProvider,
    setAzureConfig,
    setManualBeepEnabled,
    setRecordingWarningLeadSec,
    setWarningVibrationEnabled,
    setWarningSoundEnabled,
    updateProviderIcon,
    updateProvider,
    reorderProviders,
    reload: async () => setSettings(await ensureSettings()),
  }
}
