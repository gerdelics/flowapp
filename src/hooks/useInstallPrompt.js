import { useEffect, useState } from 'react'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  function detectInstalledState() {
    if (typeof window === 'undefined') {
      return false
    }

    const standaloneDisplayMode = window.matchMedia('(display-mode: standalone)').matches
    const iosStandalone = Boolean(window.navigator?.standalone)
    return standaloneDisplayMode || iosStandalone
  }

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    function handleInstalledStateChange() {
      const installed = detectInstalledState()
      setIsInstalled(installed)
      if (installed) {
        setDeferredPrompt(null)
      }
    }

    const media = window.matchMedia('(display-mode: standalone)')

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalledStateChange)
    media.addEventListener('change', handleInstalledStateChange)
    handleInstalledStateChange()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalledStateChange)
      media.removeEventListener('change', handleInstalledStateChange)
    }
  }, [])

  async function triggerInstall() {
    if (!deferredPrompt) {
      return false
    }

    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setIsInstalled(detectInstalledState())
    return true
  }

  function triggerUninstallHelp() {
    const message =
      'A webalkalmazás eltávolítása a készülék rendszerében történik.\n\n' +
      'Android: hosszan nyomd az app ikonját → App info → Uninstall.\n' +
      'Windows: Start menü → jobb klikk az appon → Uninstall.\n' +
      'iOS: hosszan nyomd az ikont → Remove App.'

    window.alert(message)
    return true
  }

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    triggerInstall,
    triggerUninstallHelp,
  }
}
