import { useCallback, useEffect, useState } from 'react'
import {
  addEntry,
  deleteSession,
  getActiveSession,
  getEntriesBySessionId,
  listSessionsWithCounts,
  pauseSession,
  renameSession,
  resumeSession,
  setSessionPlannedRoute,
  setSessionPath,
  startSession,
  stopSession,
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

  const refreshSessions = useCallback(async () => {
    const list = await listSessionsWithCounts()
    setSessions(list)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadInitial() {
      const [active, sessionList] = await Promise.all([
        getActiveSession(),
        listSessionsWithCounts(),
      ])

      if (!mounted) {
        return
      }

      // An un-ended session present at mount survived a reload/crash (a normal
      // in-app session is created via beginSession, which never remounts this
      // hook). Pause it so the sampler records no bad points and prompt the user
      // to resume, finish, or discard.
      if (active) {
        const paused = (await pauseSession(active.id)) || active
        if (!mounted) {
          return
        }
        setSession(paused)
        setSessions(sessionList)
        setRecoveredMeta({
          name: active.name,
          lastHeartbeatAt: active.lastHeartbeatAt || null,
          pointCount: Array.isArray(active.path) ? active.path.length : 0,
        })
        setRecoveryPending(true)
        return
      }

      setSession(active)
      setSessions(sessionList)
    }

    loadInitial()

    return () => {
      mounted = false
    }
  }, [])

  const beginSession = useCallback(
    async (name) => {
      const created = await startSession(name)
      setSession(created)
      await refreshSessions()
      return created
    },
    [refreshSessions],
  )

  const endSession = useCallback(async () => {
    if (!session) {
      return null
    }
    const stopped = await stopSession(session.id)
    setSession(null)
    await refreshSessions()
    return stopped
  }, [refreshSessions, session])

  const saveActiveSessionPath = useCallback(
    async (path) => {
      if (!session) {
        return null
      }

      // Persist only. This runs on a 10s autosave loop while recording;
      // calling setSession (re-triggering downstream effects) and
      // refreshSessions (a full sessions+entries read) every 10s was a steady
      // battery drain. The sessions list is refreshed on session end and on
      // navigation instead, and the live map is driven by the in-memory path
      // buffer rather than session.path.
      return setSessionPath(session.id, path)
    },
    [session],
  )

  const renameActiveSession = useCallback(
    async (name) => {
      if (!session) {
        return null
      }

      const renamed = await renameSession(session.id, name)
      if (renamed) {
        setSession(renamed)
        await refreshSessions()
      }
      return renamed
    },
    [refreshSessions, session],
  )

  const assignRouteToActiveSession = useCallback(
    async (routeId, targetSessionId = null) => {
      const resolvedSessionId = targetSessionId || session?.id
      if (!resolvedSessionId) {
        return null
      }

      const updated = await setSessionPlannedRoute(resolvedSessionId, routeId)
      if (updated) {
        setSession((current) => {
          if (!current) {
            return updated
          }

          return current.id === updated.id ? updated : current
        })
        await refreshSessions()
      }
      return updated
    },
    [refreshSessions, session?.id],
  )

  const pauseActiveSession = useCallback(async () => {
    if (!session) {
      return null
    }

    const paused = await pauseSession(session.id)
    if (paused) {
      setSession(paused)
      await refreshSessions()
    }
    return paused
  }, [refreshSessions, session])

  const resumeActiveSession = useCallback(async () => {
    if (!session) {
      return null
    }

    const resumed = await resumeSession(session.id)
    if (resumed) {
      setSession(resumed)
      await refreshSessions()
    }
    return resumed
  }, [refreshSessions, session])

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

      const saved = await addEntry({
        sessionId: session.id,
        location: location || null,
        providers,
        observerAssessment,
      })

      setLastRecordedAt(saved.timestamp)
      await refreshSessions()
      return saved
    },
    [activeProviders, observerAssessment, providerLevels, refreshSessions, session],
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
      await refreshSessions()
    }
    setRecoveryPending(false)
    setRecoveredMeta(null)
  }, [refreshSessions, session])

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
