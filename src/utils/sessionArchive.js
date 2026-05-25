const SESSION_ARCHIVE_SCHEMA_VERSION = 1

function sanitizeFilenamePart(value) {
  return Array.from(String(value || 'session').trim())
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code < 32 || '<>:"/\\|?*'.includes(char)) {
        return '_'
      }
      return char
    })
    .join('')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'session'
}

function buildSessionArchive(session, entries) {
  return {
    schemaVersion: SESSION_ARCHIVE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    session: session ? { ...session } : null,
    entries: Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [],
  }
}

export function downloadSessionArchive(session, entries, filename) {
  const archive = buildSessionArchive(session, entries)
  const json = JSON.stringify(archive, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function readSessionArchiveFile(file) {
  if (!file) {
    throw new Error('Please choose a session archive file.')
  }

  const text = await file.text()
  const parsed = JSON.parse(text)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid session archive.')
  }

  if (parsed.schemaVersion !== SESSION_ARCHIVE_SCHEMA_VERSION) {
    throw new Error(`Unsupported session archive version: ${parsed.schemaVersion ?? 'unknown'}.`)
  }

  if (!parsed.session || typeof parsed.session !== 'object') {
    throw new Error('Invalid session archive: session data is missing.')
  }

  if (!Array.isArray(parsed.entries)) {
    throw new Error('Invalid session archive: entries list is missing.')
  }

  return parsed
}

export function buildSessionArchiveFilename(session) {
  const namePart = sanitizeFilenamePart(session?.name)
  const idPart = sanitizeFilenamePart(session?.id)
  return `${namePart}-${idPart}.json`
}
