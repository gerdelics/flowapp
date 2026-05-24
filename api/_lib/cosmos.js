import { CosmosClient } from '@azure/cosmos'

const env = globalThis.process?.env ?? {}

const COSMOS_ENDPOINT = env.COSMOS_ENDPOINT
const COSMOS_KEY = env.COSMOS_KEY
const COSMOS_DATABASE = env.COSMOS_DATABASE || 'traffic-monitor'
const COSMOS_SESSIONS_CONTAINER = env.COSMOS_SESSIONS_CONTAINER || 'sessions'
const COSMOS_ENTRIES_CONTAINER = env.COSMOS_ENTRIES_CONTAINER || 'entries'
const COSMOS_SESSIONS_PARTITION_KEY_FIELD =
  env.COSMOS_SESSIONS_PARTITION_KEY_FIELD || 'id'
const COSMOS_ENTRIES_PARTITION_KEY_FIELD =
  env.COSMOS_ENTRIES_PARTITION_KEY_FIELD || 'sessionId'

const COSMOS_RETRY_ATTEMPTS = Number(env.COSMOS_RETRY_ATTEMPTS || 4)
const COSMOS_RETRY_BASE_MS = Number(env.COSMOS_RETRY_BASE_MS || 200)
const COSMOS_RETRY_MAX_MS = Number(env.COSMOS_RETRY_MAX_MS || 3000)
const COSMOS_UPSERT_CONCURRENCY = Number(env.COSMOS_UPSERT_CONCURRENCY || 20)

let cached = null

function isConfigured() {
  return Boolean(COSMOS_ENDPOINT && COSMOS_KEY)
}

export async function getCosmosResources() {
  if (!isConfigured()) {
    return {
      configured: false,
      databaseName: COSMOS_DATABASE,
      sessionsContainerName: COSMOS_SESSIONS_CONTAINER,
      entriesContainerName: COSMOS_ENTRIES_CONTAINER,
      partitionFields: {
        sessions: COSMOS_SESSIONS_PARTITION_KEY_FIELD,
        entries: COSMOS_ENTRIES_PARTITION_KEY_FIELD,
      },
    }
  }

  if (cached) {
    return cached
  }

  const client = new CosmosClient({ endpoint: COSMOS_ENDPOINT, key: COSMOS_KEY })
  const database = client.database(COSMOS_DATABASE)
  const sessions = database.container(COSMOS_SESSIONS_CONTAINER)
  const entries = database.container(COSMOS_ENTRIES_CONTAINER)

  cached = {
    configured: true,
    client,
    database,
    sessions,
    entries,
    databaseName: COSMOS_DATABASE,
    sessionsContainerName: COSMOS_SESSIONS_CONTAINER,
    entriesContainerName: COSMOS_ENTRIES_CONTAINER,
    partitionFields: {
      sessions: COSMOS_SESSIONS_PARTITION_KEY_FIELD,
      entries: COSMOS_ENTRIES_PARTITION_KEY_FIELD,
    },
  }

  return cached
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function shouldRetry(error) {
  const statusCode = error?.code || error?.statusCode
  return statusCode === 429 || (typeof statusCode === 'number' && statusCode >= 500)
}

export async function withRetry(operation, operationName = 'cosmos-operation') {
  let attempt = 0
  let lastError = null

  while (attempt < COSMOS_RETRY_ATTEMPTS) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      attempt += 1

      if (attempt >= COSMOS_RETRY_ATTEMPTS || !shouldRetry(error)) {
        break
      }

      const retryAfterMs = Number(error?.headers?.['x-ms-retry-after-ms'] || 0)
      const expBackoff = Math.min(
        COSMOS_RETRY_MAX_MS,
        COSMOS_RETRY_BASE_MS * 2 ** (attempt - 1),
      )
      const jitterMs = Math.floor(Math.random() * 100)
      const delayMs = Math.max(retryAfterMs, expBackoff + jitterMs)
      await sleep(delayMs)
    }
  }

  throw new Error(
    `${operationName} failed after ${COSMOS_RETRY_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`,
  )
}

function assertPartitionValue(document, partitionField) {
  const partitionValue = document?.[partitionField]
  if (partitionValue === undefined || partitionValue === null || partitionValue === '') {
    throw new Error(
      `Missing partition key value for field '${partitionField}' on document id '${document?.id || 'unknown'}'`,
    )
  }
  return partitionValue
}

export async function upsertDocument(container, document, partitionField, operationName) {
  const partitionKey = assertPartitionValue(document, partitionField)
  return withRetry(
    () => container.items.upsert(document, { partitionKey }),
    operationName,
  )
}

export async function upsertMany(container, documents, partitionField, operationName) {
  const safeDocs = documents.filter(Boolean)
  if (safeDocs.length === 0) {
    return { total: 0 }
  }

  for (let i = 0; i < safeDocs.length; i += COSMOS_UPSERT_CONCURRENCY) {
    const chunk = safeDocs.slice(i, i + COSMOS_UPSERT_CONCURRENCY)
    await Promise.all(
      chunk.map((doc) =>
        upsertDocument(container, doc, partitionField, `${operationName}:${doc.id || 'unknown'}`),
      ),
    )
  }

  return { total: safeDocs.length }
}

export async function queryAll(container, querySpec, operationName) {
  const result = await withRetry(
    () => container.items.query(querySpec, { enableCrossPartitionQuery: true }).fetchAll(),
    operationName,
  )
  return result.resources || []
}

export async function queryByPartition(
  container,
  querySpec,
  partitionKey,
  operationName,
) {
  const result = await withRetry(
    () =>
      container.items
        .query(querySpec, {
          enableCrossPartitionQuery: partitionKey === undefined,
          ...(partitionKey !== undefined ? { partitionKey } : {}),
        })
        .fetchAll(),
    operationName,
  )
  return result.resources || []
}

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
