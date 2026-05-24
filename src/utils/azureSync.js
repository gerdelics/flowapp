export async function syncEntriesToAzure({
  entries,
  sessions = [],
  endpointUrl,
  apiKey,
}) {
  if (!endpointUrl) {
    throw new Error('Azure endpoint URL is missing')
  }

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: JSON.stringify({ entries, sessions }),
  })

  if (!response.ok) {
    throw new Error(`Azure sync failed: ${response.status}`)
  }

  return response.json().catch(() => ({}))
}
