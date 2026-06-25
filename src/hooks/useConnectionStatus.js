import { useEffect, useState } from 'react'
import { ref as dbRef, onValue } from 'firebase/database'
import { db } from '../firebase'
import { subscribePending } from '../db/offlineQueue'

// Browser + Firebase connectivity, plus the count of writes still queued in the
// durable offline outbox. Drives the header sync indicator.
export function useConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [firebaseConnected, setFirebaseConnected] = useState(true)
  const [rawPending, setRawPending] = useState(0)
  const [pendingWrites, setPendingWrites] = useState(0)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    let wasConnected = false
    let timer = null
    const unsubscribe = onValue(dbRef(db, '.info/connected'), (snap) => {
      if (snap.val() === true) {
        clearTimeout(timer)
        wasConnected = true
        setFirebaseConnected(true)
      } else if (wasConnected) {
        // Debounce to avoid a false "offline" flash while reconnecting.
        timer = setTimeout(() => setFirebaseConnected(false), 2000)
      }
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => subscribePending(setRawPending), [])

  // Online, writes clear within milliseconds, so the raw count flickers 0↔1.
  // Only surface a non-zero count once it has persisted briefly; drop to 0
  // immediately so "Synced" appears the moment everything is flushed.
  useEffect(() => {
    // Rising edge waits 1.5s so brief online blips never show; a drop to 0
    // clears on the next tick so "Synced" appears as soon as it's flushed.
    const delay = rawPending === 0 ? 0 : 1500
    const timer = setTimeout(() => setPendingWrites(rawPending), delay)
    return () => clearTimeout(timer)
  }, [rawPending])

  return { online, firebaseConnected, pendingWrites }
}
