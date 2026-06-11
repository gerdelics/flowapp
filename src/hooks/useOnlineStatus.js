import { useEffect, useState } from 'react'

function readOnline() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true
  }
  return navigator.onLine
}

/**
 * Tracks browser connectivity via navigator.onLine and the window
 * online/offline events. Recording never depends on the network (all writes go
 * to IndexedDB), so this is purely informational for the status banner.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(readOnline)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
