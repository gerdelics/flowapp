// Parse a "lat, lon" string (the format Google Maps and friends copy) into a
// coordinate pair. Accepts comma and/or whitespace as the separator.
export function parseCoordinates(value) {
  if (typeof value !== 'string') {
    return null
  }
  const parts = value.trim().split(/[\s,]+/).filter(Boolean)
  if (parts.length < 2) {
    return null
  }
  const lat = Number.parseFloat(parts[0])
  const lon = Number.parseFloat(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }
  return { lat, lon }
}
