import { useEffect, useState } from 'react'
import { ref as dbRef, onValue } from 'firebase/database'
import { db } from '../firebase'
import { subscribePending } from '../db/offlineQueue'

// Browser + Firebase connectivity, plus the count of writes still queued in the
// durable offline outbox. Drives the header sync indicator.
export function useConnectionStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [firebaseConnected, setFirebaseConnected] = useState(true)
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

  useEffect(() => subscribePending(setPendingWrites), [])

  return { online, firebaseConnected, pendingWrites }
}
