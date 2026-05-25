import Papa from 'papaparse'
import { getTrafficCsvColor } from './trafficLevels'

function formatDateTime(date, useUtc = false) {
  const d = new Date(date)
  const year = useUtc ? d.getUTCFullYear() : d.getFullYear()
  const month = String((useUtc ? d.getUTCMonth() : d.getMonth()) + 1).padStart(2, '0')
  const day = String(useUtc ? d.getUTCDate() : d.getDate()).padStart(2, '0')
  const hour = String(useUtc ? d.getUTCHours() : d.getHours()).padStart(2, '0')
  const minute = String(useUtc ? d.getUTCMinutes() : d.getMinutes()).padStart(2, '0')
  const second = String(useUtc ? d.getUTCSeconds() : d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function quote(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function buildBaseRow({ providerName, observerName, timestamp, timezone, color, location }) {
  const localTs = formatDateTime(timestamp, false)
  const utcTs = formatDateTime(timestamp, true)
  const gpsTsLocal = location?.timestamp ? formatDateTime(location.timestamp, false) : ''
  const gpsTsUtc = location?.timestamp ? formatDateTime(location.timestamp, true) : ''
  const lat = location?.lat ?? ''
  const lon = location?.lon ?? ''

  return [
    providerName,
    observerName,
    localTs,
    utcTs,
    timezone,
    color,
    '',
    '0',
    '0',
    '0',
    '0',
    gpsTsLocal,
    gpsTsUtc,
    lat,
    lon,
    lat,
    lon,
    '0',
    '0',
    '', // 20 (bare empty later)
    '',
    lat,
    lon,
    lat,
    lon,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '0',
    '1',
    '0',
    '0',
    '0',
  ]
}

function rowToLegacyCsvLine(row) {
  const before20 = row.slice(0, 19).map(quote).join(',')
  const col21 = quote(row[20] ?? '')
  const after21 = row.slice(21).map(quote).join(',')
  return `${before20},,${col21},${after21}`
}

export function buildLegacyCsvRows(entries, settings) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const rows = []

  for (const entry of entries) {
    for (const provider of entry.providers) {
      const providerConfig = settings.providers.find((p) => p.name === provider.name)
      if (!providerConfig?.active) {
        continue
      }

      rows.push(
        buildBaseRow({
          providerName: providerConfig.csvName,
          observerName: settings.observerName,
          timestamp: entry.timestamp,
          timezone,
          color: getTrafficCsvColor(provider.level),
          location: entry.location,
        }),
      )
    }

    rows.push(
      buildBaseRow({
        providerName: 'User_Perception',
        observerName: settings.observerName,
        timestamp: entry.timestamp,
        timezone,
        color: getTrafficCsvColor(entry.observerAssessment),
        location: entry.location,
      }),
    )
  }

  return rows
}

export function exportLegacyCsv(entries, settings, filename = 'traffic-export.csv') {
  const rows = buildLegacyCsvRows(entries, settings)

  const csvLines = rows.map(rowToLegacyCsvLine)
  const csv = csvLines.join('\n')

  // Keep PapaParse import in use for future schema/validation compatibility.
  Papa.unparse([['ok']])

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
