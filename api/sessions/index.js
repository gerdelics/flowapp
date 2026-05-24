import { getCosmosResources, jsonResponse, queryAll } from '../_lib/cosmos.js'

export async function onRequestGet() {
  const cosmos = await getCosmosResources()

  if (!cosmos.configured) {
    return jsonResponse({
      ok: true,
      persisted: false,
      sessions: [],
      message: 'Cosmos env vars are not configured. Returning empty sessions list.',
    })
  }

  const querySpec = {
    query: 'SELECT * FROM c ORDER BY c.startTime DESC',
  }

  const resources = await queryAll(cosmos.sessions, querySpec, 'query-sessions')

  return jsonResponse({
    ok: true,
    persisted: true,
    sessions: resources,
  })
}
