import {
  getCosmosResources,
  jsonResponse,
  upsertMany,
} from '../_lib/cosmos.js'

function uniqueById(items) {
  const byId = new Map()
  for (const item of items) {
    if (!item?.id) {
      continue
    }
    byId.set(item.id, item)
  }
  return [...byId.values()]
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json()
    const entries = Array.isArray(body?.entries) ? body.entries : []
    const sessions = Array.isArray(body?.sessions) ? body.sessions : []

    const cosmos = await getCosmosResources()

    if (!cosmos.configured) {
      return jsonResponse({
        ok: true,
        persisted: false,
        mode: 'stub',
        receivedEntries: entries.length,
        receivedSessions: sessions.length,
        partitionFields: cosmos.partitionFields,
        message: 'Cosmos env vars are not configured. Data was validated but not persisted.',
      })
    }

    const preparedSessions = uniqueById(
      sessions.map((session) => ({
        ...session,
        type: 'session',
      })),
    )

    const preparedEntries = uniqueById(
      entries.map((entry) => ({
        ...entry,
        id: entry?.id || crypto.randomUUID(),
        type: 'entry',
      })),
    )

    const sessionResult = await upsertMany(
      cosmos.sessions,
      preparedSessions,
      cosmos.partitionFields.sessions,
      'upsert-session',
    )
    const entryResult = await upsertMany(
      cosmos.entries,
      preparedEntries,
      cosmos.partitionFields.entries,
      'upsert-entry',
    )

    return jsonResponse({
      ok: true,
      persisted: true,
      receivedEntries: entries.length,
      receivedSessions: sessions.length,
      persistedEntries: entryResult.total,
      persistedSessions: sessionResult.total,
      database: cosmos.databaseName,
      containers: {
        sessions: cosmos.sessionsContainerName,
        entries: cosmos.entriesContainerName,
      },
      partitionFields: cosmos.partitionFields,
    })
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error?.message || 'Invalid JSON payload or persistence error',
      },
      400,
    )
  }
}
