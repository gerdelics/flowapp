/**
 * Parses a GPX file (XML string) and returns an array of { lat, lon } points.
 * Supports track points (<trkpt>) and waypoints (<wpt>).
 */
export function parseGpx(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Invalid GPX file')
  }

  const points = []

  // Track points have priority
  const trkpts = doc.querySelectorAll('trkpt')
  if (trkpts.length > 0) {
    trkpts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat'))
      const lon = parseFloat(pt.getAttribute('lon'))
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push({ lat, lon })
      }
    })
    return points
  }

  // Fallback: route points
  const rtepts = doc.querySelectorAll('rtept')
  if (rtepts.length > 0) {
    rtepts.forEach((pt) => {
      const lat = parseFloat(pt.getAttribute('lat'))
      const lon = parseFloat(pt.getAttribute('lon'))
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push({ lat, lon })
      }
    })
    return points
  }

  // Fallback: waypoints
  const wpts = doc.querySelectorAll('wpt')
  wpts.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat'))
    const lon = parseFloat(pt.getAttribute('lon'))
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon })
    }
  })

  return points
}
