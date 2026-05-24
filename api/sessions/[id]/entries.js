import {
  getCosmosResources,
  jsonResponse,
  queryByPartition,
} from '../../_lib/cosmos.js'

export async function onRequestGet({ params }) {
  const sessionId = params?.id
  const cosmos = await getCosmosResources()

  if (!cosmos.configured) {
    return jsonResponse({
      ok: true,
      persisted: false,
      sessionId,
      entries: [],
      message: 'Cosmos env vars are not configured. Returning empty entries list.',
    })
  }

  const querySpec = {
    query: 'SELECT * FROM c WHERE c.sessionId = @sessionId ORDER BY c.timestamp ASC',
    parameters: [{ name: '@sessionId', value: sessionId }],
  }

  const partitionField = cosmos.partitionFields.entries
  const partitionKey = partitionField === 'sessionId' ? sessionId : undefined
  const resources = await queryByPartition(
    cosmos.entries,
    querySpec,
    partitionKey,
    'query-session-entries',
  )

  return jsonResponse({
    ok: true,
    persisted: true,
    sessionId,
    entries: resources,
  })
}
