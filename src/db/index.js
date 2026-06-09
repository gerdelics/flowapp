import Dexie from 'dexie'
import { v4 as uuidv4 } from 'uuid'
import { getDefaultProviderIconUrl } from '../utils/providerIconDefaults'

export const MAX_SYNC_ATTEMPTS = 5

const DEFAULT_PROVIDERS = [
  {
    id: uuidv4(),
    name: 'Google Maps',
    csvName: 'Google',
    active: true,
    iconUrl: getDefaultProviderIconUrl('Google Maps'),
  },
  {
    id: uuidv4(),
    name: 'TomTom Drive',
    csvName: 'TomTom',
    active: true,
    iconUrl: getDefaultProviderIconUrl('TomTom Drive'),
  },
  {
    id: uuidv4(),
    name: 'HERE We Go',
    csvName: 'HERE_WeGo',
    active: true,
    iconUrl: getDefaultProviderIconUrl('HERE We Go'),
  },
  {
    id: uuidv4(),
    name: 'Waze',
    csvName: 'Waze',
    active: true,
    iconUrl: getDefaultProviderIconUrl('Waze'),
  },
  {
    id: uuidv4(),
    name: 'Apple Maps',
    csvName: 'Apple',
    active: false,
    iconUrl: getDefaultProviderIconUrl('Apple Maps'),
  },
]

const DEFAULT_SETTINGS = {
  id: 'singleton',
  observerName: 'Observer',
  sampleIntervalSec: 30,
  mapZoomLevel: 14,
  providers: DEFAULT_PROVIDERS,
  azureEndpointUrl: '',
  azureApiKey: '',
  manualBeepEnabled: true,
  recordingWarningLeadSec: 5,
  warningVibrationEnabled: true,
  warningSoundEnabled: false,
  recordedPathColor: '#e002c3',
  plannedRoutePathColor: '#ebfc01',
}

function normalizeHexColor(color, fallback) {
  if (typeof color !== 'string') {
    return fallback
  }

  const value = color.trim()
  const shortHex = /^#([0-9a-fA-F]{3})$/
  const fullHex = /^#([0-9a-fA-F]{6})$/

  if (fullHex.test(value) || shortHex.test(value)) {
    return value
  }

  return fallback
}

function withSettingsDefaults(settings) {
  const base = settings || {}

  const providers = (base.providers || []).map((provider) => {
    const fallback = DEFAULT_PROVIDERS.find((item) => item.name === provider.name)
    const isLegacyLocalIcon = typeof provider.iconUrl === 'string' && provider.iconUrl.startsWith('/icons/')
    return {
      ...provider,
      iconUrl: !provider.iconUrl || isLegacyLocalIcon ? fallback?.iconUrl || '' : provider.iconUrl,
    }
  })

  return {
    ...DEFAULT_SETTINGS,
    ...base,
    providers,
    recordedPathColor: normalizeHexColor(
      base.recordedPathColor,
      DEFAULT_SETTINGS.recordedPathColor,
    ),
    plannedRoutePathColor: normalizeHexColor(
      base.plannedRoutePathColor,
      DEFAULT_SETTINGS.plannedRoutePathColor,
    ),
    manualBeepEnabled:
      typeof base.manualBeepEnabled === 'boolean'
        ? base.manualBeepEnabled
        : DEFAULT_SETTINGS.manualBeepEnabled,
    recordingWarningLeadSec:
      Number.isFinite(base.recordingWarningLeadSec) && base.recordingWarningLeadSec >= 1
        ? Math.round(base.recordingWarningLeadSec)
        : DEFAULT_SETTINGS.recordingWarningLeadSec,
    warningVibrationEnabled:
      typeof base.warningVibrationEnabled === 'boolean'
        ? base.warningVibrationEnabled
        : DEFAULT_SETTINGS.warningVibrationEnabled,
    warningSoundEnabled:
      typeof base.warningSoundEnabled === 'boolean'
        ? base.warningSoundEnabled
        : DEFAULT_SETTINGS.warningSoundEnabled,
    mapZoomLevel:
      Number.isFinite(base.mapZoomLevel) && base.mapZoomLevel >= 1 && base.mapZoomLevel <= 19
        ? Math.round(base.mapZoomLevel)
        : DEFAULT_SETTINGS.mapZoomLevel,
  }
}

class TrafficMonitorDb extends Dexie {
  constructor() {
    super('trafficMonitorDb')
    this.version(1).stores({
      sessions: 'id, startTime, endTime',
      entries: 'id, sessionId, timestamp, synced',
      settings: 'id',
    })

    this.version(2)
      .stores({
        sessions: 'id, startTime, endTime',
        entries:
          'id, sessionId, timestamp, synced, syncStatus, syncAttempts, lastSyncAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('entries')
          .toCollection()
          .modify((entry) => {
            const synced = Boolean(entry.synced)
            entry.syncStatus = entry.syncStatus || (synced ? 'synced' : 'pending')
            entry.syncAttempts = entry.syncAttempts || 0
            entry.lastSyncError = entry.lastSyncError || null
            entry.lastSyncAt = entry.lastSyncAt || null
            entry.lastSyncAttemptAt = entry.lastSyncAttemptAt || null
          })
      })

    this.version(3).stores({
      sessions: 'id, startTime, endTime',
      entries: 'id, sessionId, timestamp, synced, syncStatus, syncAttempts, lastSyncAt',
      settings: 'id',
      routes: 'id, city, name, createdAt',
    })
  }
}

export const db = new TrafficMonitorDb()

export async function ensureSettings() {
  const existing = await db.settings.get('singleton')
  if (existing) {
    const normalized = withSettingsDefaults(existing)
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      await db.settings.put(normalized)
    }
    return normalized
  }

  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function getSettings() {
  return ensureSettings()
}

function normalizeImportedId(preferredId, usedIds) {
  if (preferredId && !usedIds.has(preferredId)) {
    usedIds.add(preferredId)
    return preferredId
  }

  const generatedId = uuidv4()
  usedIds.add(generatedId)
  return generatedId
}

function normalizeImportedEntry(entry, sessionId, usedIds) {
  const nextId = normalizeImportedId(entry?.id, usedIds)

  return {
    ...entry,
    id: nextId,
    sessionId,
    location: entry?.location || null,
    providers: Array.isArray(entry?.providers) ? entry.providers : [],
    observerAssessment: entry?.observerAssessment || 'medium',
    synced: Boolean(entry?.synced),
    syncStatus: entry?.syncStatus || (entry?.synced ? 'synced' : 'pending'),
    syncAttempts: Number.isFinite(entry?.syncAttempts) ? entry.syncAttempts : 0,
    lastSyncError: entry?.lastSyncError ?? null,
    lastSyncAt: entry?.lastSyncAt ?? null,
    lastSyncAttemptAt: entry?.lastSyncAttemptAt ?? null,
  }
}

export async function importSessionArchive(archive) {
  const sourceSession = archive?.session
  const sourceEntries = Array.isArray(archive?.entries) ? archive.entries : []

  if (!sourceSession || typeof sourceSession !== 'object') {
    throw new Error('Invalid session archive: missing session data.')
  }

  const sessionId = sourceSession.id && !(await db.sessions.get(sourceSession.id))
    ? sourceSession.id
    : uuidv4()

  const entryIds = sourceEntries
    .map((entry) => entry?.id)
    .filter((id) => typeof id === 'string' && id.length > 0)

  const existingEntries = entryIds.length ? await db.entries.where('id').anyOf(entryIds).toArray() : []
  const usedIds = new Set([
    sessionId,
    ...existingEntries.map((entry) => entry.id),
  ])

  const importedSession = {
    ...sourceSession,
    id: sessionId,
    path: Array.isArray(sourceSession.path) ? sourceSession.path : [],
  }

  let importedEntryCount = 0

  await db.transaction('rw', db.sessions, db.entries, async () => {
    await db.sessions.put(importedSession)

    for (const entry of sourceEntries) {
      if (!entry || typeof entry !== 'object') {
        continue
      }

      const normalizedEntry = normalizeImportedEntry(entry, sessionId, usedIds)
      await db.entries.put(normalizedEntry)
      importedEntryCount += 1
    }
  })

  return {
    session: importedSession,
    importedEntryCount,
  }
}

export async function updateSettings(patch) {
  const current = await ensureSettings()
  const next = withSettingsDefaults({ ...current, ...patch, id: 'singleton' })
  await db.settings.put(next)
  return next
}

export async function startSession(name) {
  const now = new Date().toISOString()
  const session = {
    id: uuidv4(),
    name: name?.trim() || new Date().toLocaleString(),
    startTime: now,
    endTime: null,
    pausedAt: null,
    notes: '',
    path: [],
  }
  await db.sessions.put(session)
  return session
}

export async function setSessionPath(sessionId, path) {
  const session = await db.sessions.get(sessionId)
  if (!session) {
    return null
  }

  const updated = {
    ...session,
    path: Array.isArray(path) ? path : [],
  }
  await db.sessions.put(updated)
  return updated
}

export async function stopSession(sessionId) {
  const session = await db.sessions.get(sessionId)
  if (!session) {
    return null
  }

  const updated = {
    ...session,
    endTime: new Date().toISOString(),
    pausedAt: null,
  }
  await db.sessions.put(updated)
  return updated
}

export async function pauseSession(sessionId) {
  const session = await db.sessions.get(sessionId)
  if (!session || session.endTime) {
    return null
  }

  if (session.pausedAt) {
    return session
  }

  const updated = {
    ...session,
    pausedAt: new Date().toISOString(),
  }
  await db.sessions.put(updated)
  return updated
}

export async function resumeSession(sessionId) {
  const session = await db.sessions.get(sessionId)
  if (!session || session.endTime) {
    return null
  }

  if (!session.pausedAt) {
    return session
  }

  const updated = {
    ...session,
    pausedAt: null,
  }
  await db.sessions.put(updated)
  return updated
}

export async function renameSession(sessionId, name) {
  const session = await db.sessions.get(sessionId)
  if (!session) {
    return null
  }

  const trimmed = name?.trim()
  if (!trimmed) {
    return session
  }

  const updated = { ...session, name: trimmed }
  await db.sessions.put(updated)
  return updated
}

function normalizePlannedRoutePoints(points) {
  if (!Array.isArray(points)) {
    return []
  }

  return points.filter(
    (point) => typeof point?.lat === 'number' && typeof point?.lon === 'number',
  )
}

export async function setSessionPlannedRoute(sessionId, routeId) {
  const session = await db.sessions.get(sessionId)
  if (!session) {
    return null
  }

  if (!routeId) {
    const cleared = {
      ...session,
      plannedRouteId: null,
      plannedRouteName: null,
      plannedRouteCity: null,
      plannedRoutePoints: [],
    }
    await db.sessions.put(cleared)
    return cleared
  }

  const route = await db.routes.get(routeId)
  if (!route) {
    return session
  }

  const updated = {
    ...session,
    plannedRouteId: route.id,
    plannedRouteName: route.name || null,
    plannedRouteCity: route.city || null,
    plannedRoutePoints: normalizePlannedRoutePoints(route.points),
  }

  await db.sessions.put(updated)
  return updated
}

export async function getActiveSession() {
  const sessions = await db.sessions.toArray()
  return sessions.find((session) => session.endTime === null) || null
}

export async function addEntry({
  sessionId,
  timestamp,
  location,
  providers,
  observerAssessment,
}) {
  const entry = {
    id: uuidv4(),
    sessionId,
    timestamp: timestamp || new Date().toISOString(),
    location: location || null,
    providers,
    observerAssessment,
    synced: false,
    syncStatus: 'pending',
    syncAttempts: 0,
    lastSyncError: null,
    lastSyncAt: null,
    lastSyncAttemptAt: null,
  }
  await db.entries.put(entry)
  return entry
}

export async function listSessionsWithCounts() {
  const sessions = await db.sessions.orderBy('startTime').reverse().toArray()
  const entries = await db.entries.toArray()
  const counts = entries.reduce((acc, entry) => {
    const attempts = entry.syncAttempts || 0
    const computedStatus = entry.syncStatus || (entry.synced ? 'synced' : 'pending')
    const isDeadLetter = computedStatus === 'dead-letter' || attempts >= MAX_SYNC_ATTEMPTS

    acc[entry.sessionId] = (acc[entry.sessionId] || 0) + 1
    if (!entry.synced) {
      acc[`${entry.sessionId}:unsynced`] =
        (acc[`${entry.sessionId}:unsynced`] || 0) + 1
    }
    if (computedStatus === 'failed') {
      acc[`${entry.sessionId}:failed`] = (acc[`${entry.sessionId}:failed`] || 0) + 1
    }
    if (isDeadLetter) {
      acc[`${entry.sessionId}:dead`] = (acc[`${entry.sessionId}:dead`] || 0) + 1
    }
    return acc
  }, {})

  return sessions.map((session) => ({
    ...session,
    entryCount: counts[session.id] || 0,
    unsyncedCount: counts[`${session.id}:unsynced`] || 0,
    failedCount: counts[`${session.id}:failed`] || 0,
    deadLetterCount: counts[`${session.id}:dead`] || 0,
  }))
}

export async function getSessionById(sessionId) {
  return db.sessions.get(sessionId)
}

export async function getEntriesBySessionId(sessionId) {
  return db.entries.where('sessionId').equals(sessionId).sortBy('timestamp')
}

export async function getAllEntries() {
  return db.entries.orderBy('timestamp').toArray()
}

async function getUnsyncedEntries() {
  return db.entries.where('synced').equals(false).toArray()
}

export async function getRetryableUnsyncedEntries() {
  const entries = await getUnsyncedEntries()
  return entries.filter((entry) => (entry.syncAttempts || 0) < MAX_SYNC_ATTEMPTS)
}

export async function getRetryableUnsyncedEntriesBySessionId(sessionId) {
  const entries = await db.entries.where('sessionId').equals(sessionId).toArray()
  return entries.filter(
    (entry) => !entry.synced && (entry.syncAttempts || 0) < MAX_SYNC_ATTEMPTS,
  )
}

export async function getDeadLetterEntries() {
  const entries = await getUnsyncedEntries()
  return entries.filter((entry) => (entry.syncAttempts || 0) >= MAX_SYNC_ATTEMPTS)
}

export async function getDeadLetterEntriesBySessionId(sessionId) {
  const entries = await db.entries.where('sessionId').equals(sessionId).toArray()
  return entries.filter((entry) => (entry.syncAttempts || 0) >= MAX_SYNC_ATTEMPTS)
}

export async function resetEntriesForRetry(entryIds) {
  if (!entryIds?.length) {
    return 0
  }

  let updated = 0
  await db.transaction('rw', db.entries, async () => {
    for (const id of entryIds) {
      const entry = await db.entries.get(id)
      if (!entry) {
        continue
      }

      await db.entries.put({
        ...entry,
        synced: false,
        syncStatus: 'pending',
        syncAttempts: 0,
        lastSyncError: null,
      })
      updated += 1
    }
  })

  return updated
}

export async function markEntriesSynced(entryIds) {
  if (!entryIds?.length) {
    return
  }

  await db.transaction('rw', db.entries, async () => {
    for (const id of entryIds) {
      const entry = await db.entries.get(id)
      if (entry) {
        await db.entries.put({
          ...entry,
          synced: true,
          syncStatus: 'synced',
          lastSyncError: null,
          lastSyncAt: new Date().toISOString(),
          lastSyncAttemptAt: new Date().toISOString(),
        })
      }
    }
  })
}

export async function markEntriesSyncFailed(entryIds, errorMessage) {
  if (!entryIds?.length) {
    return
  }

  await db.transaction('rw', db.entries, async () => {
    for (const id of entryIds) {
      const entry = await db.entries.get(id)
      if (!entry) {
        continue
      }

      const nextAttempts = (entry.syncAttempts || 0) + 1
      const deadLetter = nextAttempts >= MAX_SYNC_ATTEMPTS

      await db.entries.put({
        ...entry,
        synced: false,
        syncAttempts: nextAttempts,
        syncStatus: deadLetter ? 'dead-letter' : 'failed',
        lastSyncError: errorMessage || 'Unknown sync error',
        lastSyncAttemptAt: new Date().toISOString(),
      })
    }
  })
}

export async function deleteSession(sessionId) {
  await db.transaction('rw', db.sessions, db.entries, async () => {
    await db.sessions.delete(sessionId)
    const entries = await db.entries.where('sessionId').equals(sessionId).toArray()
    await Promise.all(entries.map((entry) => db.entries.delete(entry.id)))
  })
}

export async function clearAllData() {
  await db.transaction('rw', db.sessions, db.entries, db.settings, async () => {
    await db.sessions.clear()
    await db.entries.clear()
    await db.settings.clear()
  })
  await ensureSettings()
}
