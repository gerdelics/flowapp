import {
  ref as dbRef,
  get,
  onValue,
  query,
  orderByChild,
  equalTo,
} from 'firebase/database'
import { v4 as uuidv4 } from 'uuid'
import { db, auth } from '../firebase'
import { writeThrough } from './offlineQueue'
import { getDefaultProviderIconUrl } from '../utils/providerIconDefaults'

// ---------------------------------------------------------------------------
// Firebase Realtime Database data layer.
//
// Data tree (shared team pool; every record is owned by its creator):
//   /sessions/{id}, /entries/{id}, /routes/{id}   — visible to all authed users
//   /users/{uid}/settings                          — per-user
//
// All mutating writes go through `writeThrough` (durable offline outbox). Hot
// paths (heartbeat, path autosave, addEntry) are read-free so recording stays
// instant offline. RTDB drops null/empty values, so reads are normalized.
// ---------------------------------------------------------------------------

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
  observerName: 'Observer',
  sampleIntervalSec: 30,
  providers: DEFAULT_PROVIDERS,
  manualBeepEnabled: true,
  recordingWarningLeadSec: 5,
  warningVibrationEnabled: true,
  warningSoundEnabled: false,
  recordedPathColor: '#e002c3',
  plannedRoutePathColor: '#ebfc01',
}

function currentUid() {
  return auth.currentUser?.uid || null
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

  const providers = (base.providers || DEFAULT_SETTINGS.providers).map((provider) => {
    const fallback = DEFAULT_PROVIDERS.find((item) => item.name === provider.name)
    const isLegacyLocalIcon =
      typeof provider.iconUrl === 'string' && provider.iconUrl.startsWith('/icons/')
    return {
      ...provider,
      iconUrl: !provider.iconUrl || isLegacyLocalIcon ? fallback?.iconUrl || '' : provider.iconUrl,
    }
  })

  // mapZoomLevel is a per-device preference (localStorage); drop any legacy
  // value that may still be stored in synced settings.
  const baseWithoutZoom = { ...base }
  delete baseWithoutZoom.mapZoomLevel

  return {
    ...DEFAULT_SETTINGS,
    ...baseWithoutZoom,
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
  }
}

// --- Read normalizers (RTDB omits null/empty values) -----------------------

function normalizeSession(id, raw) {
  if (!raw) {
    return null
  }
  return {
    id,
    owner: raw.owner ?? null,
    name: raw.name || '',
    city: raw.city || '',
    startTime: raw.startTime || null,
    endTime: raw.endTime ?? null,
    pausedAt: raw.pausedAt ?? null,
    lastHeartbeatAt: raw.lastHeartbeatAt ?? null,
    notes: raw.notes || '',
    path: Array.isArray(raw.path) ? raw.path : [],
    plannedRouteId: raw.plannedRouteId ?? null,
    plannedRouteName: raw.plannedRouteName ?? null,
    plannedRouteCity: raw.plannedRouteCity ?? null,
    plannedRoutePoints: Array.isArray(raw.plannedRoutePoints) ? raw.plannedRoutePoints : [],
  }
}

function normalizeEntry(id, raw) {
  if (!raw) {
    return null
  }
  return {
    id,
    owner: raw.owner ?? null,
    sessionId: raw.sessionId,
    timestamp: raw.timestamp,
    location: raw.location ?? null,
    providers: Array.isArray(raw.providers) ? raw.providers : [],
    observerAssessment: raw.observerAssessment || 'medium',
  }
}

function normalizeRoute(id, raw) {
  if (!raw) {
    return null
  }
  return {
    id,
    owner: raw.owner ?? null,
    city: raw.city || '',
    name: raw.name || '',
    link: raw.link || '',
    points: Array.isArray(raw.points) ? raw.points : [],
    createdAt: raw.createdAt || null,
  }
}

function normalizeCity(id, raw) {
  if (!raw) {
    return null
  }
  return {
    id,
    owner: raw.owner ?? null,
    name: raw.name || '',
    createdAt: raw.createdAt || null,
  }
}

function normalizePlannedRoutePoints(points) {
  if (!Array.isArray(points)) {
    return []
  }
  return points.filter(
    (point) => typeof point?.lat === 'number' && typeof point?.lon === 'number',
  )
}

// --- Settings (per-user) ---------------------------------------------------

export async function ensureSettings() {
  const uid = currentUid()
  if (!uid) {
    return withSettingsDefaults(null)
  }

  const snap = await get(dbRef(db, `users/${uid}/settings`))
  const existing = snap.val()

  if (existing) {
    const normalized = withSettingsDefaults(existing)
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      writeThrough('set', `users/${uid}/settings`, normalized)
    }
    return normalized
  }

  const defaults = withSettingsDefaults(null)
  writeThrough('set', `users/${uid}/settings`, defaults)
  return defaults
}

export async function getSettings() {
  return ensureSettings()
}

export async function updateSettings(patch) {
  const uid = currentUid()
  const current = await ensureSettings()
  const next = withSettingsDefaults({ ...current, ...patch })
  if (uid) {
    writeThrough('set', `users/${uid}/settings`, next)
  }
  return next
}

export function subscribeSettings(callback) {
  const uid = currentUid()
  if (!uid) {
    callback(withSettingsDefaults(null))
    return () => {}
  }
  return onValue(dbRef(db, `users/${uid}/settings`), (snap) => {
    callback(withSettingsDefaults(snap.val()))
  })
}

// --- Sessions --------------------------------------------------------------

export async function startSession(name, city) {
  const now = new Date().toISOString()
  const id = uuidv4()
  const session = {
    id,
    owner: currentUid(),
    name: name?.trim() || new Date().toLocaleString(),
    city: city?.trim() || '',
    startTime: now,
    endTime: null,
    pausedAt: null,
    lastHeartbeatAt: now,
    notes: '',
    path: [],
  }
  writeThrough('set', `sessions/${id}`, session)
  return session
}

// Liveness ping on a short interval while recording. Read-free partial update.
export function touchSessionHeartbeat(sessionId) {
  if (!sessionId) {
    return null
  }
  writeThrough('update', `sessions/${sessionId}`, { lastHeartbeatAt: new Date().toISOString() })
  return sessionId
}

// Path autosave (10s loop). Read-free so it never blocks offline.
export function setSessionPath(sessionId, path) {
  if (!sessionId) {
    return null
  }
  const safePath = Array.isArray(path) ? path : []
  writeThrough('update', `sessions/${sessionId}`, { path: safePath })
  return { id: sessionId, path: safePath }
}

export function stopSession(sessionId, current = null) {
  if (!sessionId) {
    return null
  }
  const patch = { endTime: new Date().toISOString(), pausedAt: null }
  writeThrough('update', `sessions/${sessionId}`, patch)
  return current ? { ...current, ...patch } : { id: sessionId, ...patch }
}

export function pauseSession(sessionId, current = null) {
  if (!sessionId || current?.endTime) {
    return current
  }
  if (current?.pausedAt) {
    return current
  }
  const patch = { pausedAt: new Date().toISOString() }
  writeThrough('update', `sessions/${sessionId}`, patch)
  return current ? { ...current, ...patch } : { id: sessionId, ...patch }
}

export function resumeSession(sessionId, current = null) {
  if (!sessionId || current?.endTime) {
    return current
  }
  if (current && !current.pausedAt) {
    return current
  }
  const patch = { pausedAt: null }
  writeThrough('update', `sessions/${sessionId}`, patch)
  return current ? { ...current, ...patch } : { id: sessionId, ...patch }
}

export function renameSession(sessionId, name, current = null) {
  if (!sessionId) {
    return null
  }
  const trimmed = name?.trim()
  if (!trimmed) {
    return current
  }
  const patch = { name: trimmed }
  writeThrough('update', `sessions/${sessionId}`, patch)
  return current ? { ...current, ...patch } : { id: sessionId, ...patch }
}

export async function setSessionPlannedRoute(sessionId, routeId, current = null) {
  if (!sessionId) {
    return null
  }

  const base = current || (await getSessionById(sessionId))
  if (!base) {
    return null
  }

  if (!routeId) {
    const patch = {
      plannedRouteId: null,
      plannedRouteName: null,
      plannedRouteCity: null,
      plannedRoutePoints: [],
    }
    writeThrough('update', `sessions/${sessionId}`, patch)
    return { ...base, ...patch }
  }

  const route = await getRouteById(routeId)
  if (!route) {
    return base
  }

  const patch = {
    plannedRouteId: route.id,
    plannedRouteName: route.name || null,
    plannedRouteCity: route.city || null,
    plannedRoutePoints: normalizePlannedRoutePoints(route.points),
  }
  writeThrough('update', `sessions/${sessionId}`, patch)
  return { ...base, ...patch }
}

export async function getActiveSession() {
  const uid = currentUid()
  const snap = await get(dbRef(db, 'sessions'))
  const data = snap.val() || {}
  const list = Object.entries(data).map(([id, raw]) => normalizeSession(id, raw))
  return list.find((session) => session.owner === uid && !session.endTime) || null
}

export async function getSessionById(sessionId) {
  const snap = await get(dbRef(db, `sessions/${sessionId}`))
  return normalizeSession(sessionId, snap.val())
}

// Live, sorted sessions list with per-session entry counts (shared team pool).
export function subscribeSessionsWithCounts(callback) {
  let sessions = []
  let counts = {}

  const recompute = () => {
    callback(sessions.map((session) => ({ ...session, entryCount: counts[session.id] || 0 })))
  }

  const unsubSessions = onValue(dbRef(db, 'sessions'), (snap) => {
    const data = snap.val() || {}
    sessions = Object.entries(data)
      .map(([id, raw]) => normalizeSession(id, raw))
      .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''))
    recompute()
  })

  const unsubEntries = onValue(dbRef(db, 'entries'), (snap) => {
    const data = snap.val() || {}
    const next = {}
    Object.values(data).forEach((entry) => {
      if (entry?.sessionId) {
        next[entry.sessionId] = (next[entry.sessionId] || 0) + 1
      }
    })
    counts = next
    recompute()
  })

  return () => {
    unsubSessions()
    unsubEntries()
  }
}

export async function deleteSession(sessionId) {
  const entries = await getEntriesBySessionId(sessionId)
  writeThrough('remove', `sessions/${sessionId}`)
  entries.forEach((entry) => writeThrough('remove', `entries/${entry.id}`))
}

// --- Entries ---------------------------------------------------------------

export function addEntry({ sessionId, timestamp, location, providers, observerAssessment }) {
  const id = uuidv4()
  const entry = {
    id,
    owner: currentUid(),
    sessionId,
    timestamp: timestamp || new Date().toISOString(),
    location: location || null,
    providers: Array.isArray(providers) ? providers : [],
    observerAssessment: observerAssessment || 'medium',
  }
  writeThrough('set', `entries/${id}`, entry)
  return entry
}

export async function getEntriesBySessionId(sessionId) {
  const entriesQuery = query(dbRef(db, 'entries'), orderByChild('sessionId'), equalTo(sessionId))
  const snap = await get(entriesQuery)
  const data = snap.val() || {}
  return Object.entries(data)
    .map(([id, raw]) => normalizeEntry(id, raw))
    .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
}

export async function getAllEntries() {
  const snap = await get(dbRef(db, 'entries'))
  const data = snap.val() || {}
  return Object.entries(data)
    .map(([id, raw]) => normalizeEntry(id, raw))
    .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
}

// --- Routes (shared) -------------------------------------------------------

export async function saveRoute(route) {
  const id = route.id || uuidv4()
  const stored = {
    id,
    owner: route.owner ?? currentUid(),
    city: route.city?.trim() || '',
    name: route.name?.trim() || '',
    link: route.link?.trim() || '',
    points: Array.isArray(route.points) ? route.points : [],
    createdAt: route.createdAt || new Date().toISOString(),
  }
  writeThrough('set', `routes/${id}`, stored)
  return normalizeRoute(id, stored)
}

export async function getRouteById(routeId) {
  const snap = await get(dbRef(db, `routes/${routeId}`))
  return normalizeRoute(routeId, snap.val())
}

export async function deleteRoute(routeId) {
  writeThrough('remove', `routes/${routeId}`)
}

export function subscribeRoutes(callback) {
  return onValue(dbRef(db, 'routes'), (snap) => {
    const data = snap.val() || {}
    callback(Object.entries(data).map(([id, raw]) => normalizeRoute(id, raw)))
  })
}

// --- Cities (shared, explicitly managed) -----------------------------------

export async function addCity(name) {
  const trimmed = name?.trim()
  if (!trimmed) {
    return null
  }
  const id = uuidv4()
  const city = {
    id,
    owner: currentUid(),
    name: trimmed,
    createdAt: new Date().toISOString(),
  }
  writeThrough('set', `cities/${id}`, city)
  return normalizeCity(id, city)
}

export async function deleteCity(cityId) {
  writeThrough('remove', `cities/${cityId}`)
}

// Renames a city and cascades the new name to every route and session that
// referenced the old name, so labels stay consistent across the app.
export async function renameCity(cityId, nextName, prevName) {
  const trimmed = nextName?.trim()
  if (!cityId || !trimmed) {
    return null
  }

  writeThrough('update', `cities/${cityId}`, { name: trimmed })

  if (prevName && prevName !== trimmed) {
    const [routesSnap, sessionsSnap] = await Promise.all([
      get(dbRef(db, 'routes')),
      get(dbRef(db, 'sessions')),
    ])

    const routes = routesSnap.val() || {}
    Object.entries(routes).forEach(([id, raw]) => {
      if (raw?.city === prevName) {
        writeThrough('update', `routes/${id}`, { city: trimmed })
      }
    })

    const sessions = sessionsSnap.val() || {}
    Object.entries(sessions).forEach(([id, raw]) => {
      if (raw?.city === prevName) {
        writeThrough('update', `sessions/${id}`, { city: trimmed })
      }
    })
  }

  return { id: cityId, name: trimmed }
}

export function subscribeCities(callback) {
  return onValue(dbRef(db, 'cities'), (snap) => {
    const data = snap.val() || {}
    callback(Object.entries(data).map(([id, raw]) => normalizeCity(id, raw)))
  })
}

// --- Import / wipe ---------------------------------------------------------

export async function importSessionArchive(archive) {
  const sourceSession = archive?.session
  const sourceEntries = Array.isArray(archive?.entries) ? archive.entries : []

  if (!sourceSession || typeof sourceSession !== 'object') {
    throw new Error('Invalid session archive: missing session data.')
  }

  const uid = currentUid()
  const existing = sourceSession.id ? await getSessionById(sourceSession.id) : null
  const sessionId = sourceSession.id && !existing ? sourceSession.id : uuidv4()
  // If we had to regenerate the session id, regenerate entry ids too so a
  // re-import never moves the original session's entries.
  const regenerateEntryIds = sessionId !== sourceSession.id

  const importedSession = {
    id: sessionId,
    owner: uid,
    name: sourceSession.name || new Date().toLocaleString(),
    city: sourceSession.city || '',
    startTime: sourceSession.startTime || new Date().toISOString(),
    endTime: sourceSession.endTime ?? new Date().toISOString(),
    pausedAt: null,
    lastHeartbeatAt: sourceSession.lastHeartbeatAt ?? null,
    notes: sourceSession.notes || '',
    path: Array.isArray(sourceSession.path) ? sourceSession.path : [],
    plannedRouteId: sourceSession.plannedRouteId ?? null,
    plannedRouteName: sourceSession.plannedRouteName ?? null,
    plannedRouteCity: sourceSession.plannedRouteCity ?? null,
    plannedRoutePoints: Array.isArray(sourceSession.plannedRoutePoints)
      ? sourceSession.plannedRoutePoints
      : [],
  }
  writeThrough('set', `sessions/${sessionId}`, importedSession)

  let importedEntryCount = 0
  for (const entry of sourceEntries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const entryId = regenerateEntryIds ? uuidv4() : entry.id || uuidv4()
    const normalized = {
      id: entryId,
      owner: uid,
      sessionId,
      timestamp: entry.timestamp || new Date().toISOString(),
      location: entry.location || null,
      providers: Array.isArray(entry.providers) ? entry.providers : [],
      observerAssessment: entry.observerAssessment || 'medium',
    }
    writeThrough('set', `entries/${entryId}`, normalized)
    importedEntryCount += 1
  }

  return { session: importedSession, importedEntryCount }
}

// Removes the current user's own sessions, entries, and settings.
export async function clearAllData() {
  const uid = currentUid()

  const [sessionsSnap, entriesSnap] = await Promise.all([
    get(dbRef(db, 'sessions')),
    get(dbRef(db, 'entries')),
  ])

  const sessions = sessionsSnap.val() || {}
  Object.entries(sessions).forEach(([id, raw]) => {
    if (raw?.owner === uid) {
      writeThrough('remove', `sessions/${id}`)
    }
  })

  const entries = entriesSnap.val() || {}
  Object.entries(entries).forEach(([id, raw]) => {
    if (raw?.owner === uid) {
      writeThrough('remove', `entries/${id}`)
    }
  })

  if (uid) {
    writeThrough('remove', `users/${uid}/settings`)
  }

  await ensureSettings()
}
