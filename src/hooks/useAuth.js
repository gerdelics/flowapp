import { useCallback, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

// Firebase Authentication (email/password). Firebase persists the session
// itself, so there is no localStorage bookkeeping here.
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      return null
    } catch (error) {
      return error?.message || 'Login failed.'
    }
  }, [])

  const logout = useCallback(() => signOut(auth), [])

  return { user, loading, login, logout }
}
