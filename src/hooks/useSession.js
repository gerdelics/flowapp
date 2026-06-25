import { useCallback, useEffect, useState } from 'react'
import {
  addEntry,
  deleteSession,
  getActiveSession,
  getEntriesBySessionId,
  pauseSession,
  renameSession,
  resumeSession,
  setSessionPlannedRoute,
  setSessionPath,
  startSession,
  stopSession,
  subscribeSessionsWithCounts,
} from '../db'

const EMPTY_LEVEL = 'medium'

export function useSession(activeProviders) {
  const [session, setSession] = useState(null)
  const [providerLevels, setProviderLevels] = useState({})
  const [observerAssessment, setObserverAssessment] = useState('medium')
  const [lastRecordedAt, setLastRecordedAt] = useState(null)
  const [sessions, setSessions] = useState([])
  const [recoveryPending, setRecoveryPending] = useState(false)
  const [recoveredMeta, setRecoveredMeta] = useState(null)

  const refreshActiveSession = useCallback(async () => {
    const active = await getActiveSession()
    setSession(active)
  }, [])

  // The sessions list is a live Firebase subscription (shared team pool), so it
  // updates across devices without manual refreshes.
  useEffect(() => {
    const unsubscribe = subscribeSessionsWithCounts(setSessions)
    return unsubscribe
  }, [])

  // refreshSessions is retained for API compatibility; the subscription above
  // keeps the list current, so this is a no-op.
  const refreshSessions = useCallback(async () => {}, [])

  useEffect(() => {
    let mounted = true

    async function loadInitial() {
      const active = await getActiveSession()

      if (!mounted) {
        return
      }

      // An un-ended session present at mount survived a reload/crash (a normal
      // in-app session is created via beginSession, which never remounts this
      // hook). Pause it so the sampler records no bad points and prompt the user
      // to resume, finish, or discard.
      if (active) {
        const paused = pauseSession(active.id, active) || active
        if (!mounted) {
          return
        }
        setSession(paused)
        setRecoveredMeta({
          name: active.name,
          lastHeartbeatAt: active.lastHeartbeatAt || null,
          pointCount: Array.isArray(active.path) ? active.path.length : 0,
        })
        setRecoveryPending(true)
        return
      }

      setSession(active)
    }

    loadInitial()

    return () => {
      mounted = false
    }
  }, [])

  const beginSession = useCallback(async (name) => {
    const created = await startSession(name)
    setSession(created)
    return created
  }, [])

  const endSession = useCallback(async () => {
    if (!session) {
      return null
    }
    const stopped = stopSession(session.id, session)
    setSession(null)
    return stopped
  }, [session])

  const saveActiveSessionPath = useCallback(
    async (path) => {
      if (!session) {
        return null
      }

      // Persist only. This runs on a 10s autosave loop while recording; the live
      // map is driven by the in-memory path buffer rather than session.path.
      return setSessionPath(session.id, path)
    },
    [session],
  )

  const renameActiveSession = useCallback(
    async (name) => {
      if (!session) {
        return null
      }

      const renamed = renameSession(session.id, name, session)
      if (renamed) {
        setSession(renamed)
      }
      return renamed
    },
    [session],
  )

  const assignRouteToActiveSession = useCallback(
    async (routeId, targetSessionId = null) => {
      const resolvedSessionId = targetSessionId || session?.id
      if (!resolvedSessionId) {
        return null
      }

      const current = resolvedSessionId === session?.id ? session : null
      const updated = await setSessionPlannedRoute(resolvedSessionId, routeId, current)
      if (updated) {
        setSession((existing) => {
          if (!existing) {
            return existing
          }
          return existing.id === updated.id ? updated : existing
        })
      }
      return updated
    },
    [session],
  )

  const pauseActiveSession = useCallback(async () => {
    if (!session) {
      return null
    }

    const paused = pauseSession(session.id, session)
    if (paused) {
      setSession(paused)
    }
    return paused
  }, [session])

  const resumeActiveSession = useCallback(async () => {
    if (!session) {
      return null
    }

    const resumed = resumeSession(session.id, session)
    if (resumed) {
      setSession(resumed)
    }
    return resumed
  }, [session])

  const updateProviderLevel = useCallback((providerName, level) => {
    setProviderLevels((prev) => ({ ...prev, [providerName]: level }))
  }, [])

  const recordNow = useCallback(
    async (location) => {
      if (!session) {
        return null
      }

      const providers = activeProviders.map((provider) => ({
        name: provider.name,
        level: providerLevels[provider.name] || EMPTY_LEVEL,
      }))

      const saved = addEntry({
        sessionId: session.id,
        location: location || null,
        providers,
        observerAssessment,
      })

      setLastRecordedAt(saved.timestamp)
      return saved
    },
    [activeProviders, observerAssessment, providerLevels, session],
  )

  const getCurrentSessionEntries = useCallback(async () => {
    if (!session) {
      return []
    }
    return getEntriesBySessionId(session.id)
  }, [session])

  const confirmRecoveryResume = useCallback(async () => {
    await resumeActiveSession()
    setRecoveryPending(false)
    setRecoveredMeta(null)
  }, [resumeActiveSession])

  const confirmRecoveryFinalize = useCallback(async () => {
    await endSession()
    setRecoveryPending(false)
    setRecoveredMeta(null)
  }, [endSession])

  const confirmRecoveryDiscard = useCallback(async () => {
    if (session) {
      await deleteSession(session.id)
      setSession(null)
    }
    setRecoveryPending(false)
    setRecoveredMeta(null)
  }, [session])

  return {
    session,
    sessions,
    providerLevels,
    observerAssessment,
    lastRecordedAt,
    setObserverAssessment,
    beginSession,
    endSession,
    pauseActiveSession,
    resumeActiveSession,
    renameActiveSession,
    assignRouteToActiveSession,
    saveActiveSessionPath,
    updateProviderLevel,
    recordNow,
    getCurrentSessionEntries,
    refreshSessions,
    refreshActiveSession,
    recoveryPending,
    recoveredMeta,
    confirmRecoveryResume,
    confirmRecoveryFinalize,
    confirmRecoveryDiscard,
  }
}
