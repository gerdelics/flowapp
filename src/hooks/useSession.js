import { useCallback, useEffect, useState } from 'react'
import {
  addEntry,
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

      const updated = await setSessionPath(session.id, path)
      if (updated) {
        setSession(updated)
        await refreshSessions()
      }
      return updated
    },
    [refreshSessions, session],
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
  }
}
