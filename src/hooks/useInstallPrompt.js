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
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleInstalledStateChange)
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleInstalledStateChange)
    }
    handleInstalledStateChange()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalledStateChange)
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleInstalledStateChange)
      } else if (typeof media.removeListener === 'function') {
        media.removeListener(handleInstalledStateChange)
      }
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
      'Removing the web app is done through your device system settings.\n\n' +
      'Android: long-press the app icon → App info → Uninstall.\n' +
      'Windows: Start menu → right-click the app → Uninstall.\n' +
      'iOS: long-press the icon → Remove App.'

    window.alert(message)
    return true
  }

  function triggerInstallHelp() {
    const message =
      'The install prompt is currently unavailable.\n\n' +
      'Possible reasons:\n' +
      '- The browser has not issued the install prompt yet\n' +
      '- The app is not running in an HTTPS/domain environment\n' +
      '- The platform does not support the beforeinstallprompt event\n\n' +
      'Try installing from the browser menu: Install app / Add to home screen.'

    window.alert(message)
    return true
  }

  return {
    canInstall: Boolean(deferredPrompt) && !isInstalled,
    isInstalled,
    triggerInstall,
    triggerInstallHelp,
    triggerUninstallHelp,
  }
}
