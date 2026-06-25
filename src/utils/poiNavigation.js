// Google Maps directions helpers for POI navigation. The Maps "dir" URL
// supports a waypoint, so we can route current location -> ráfordító -> marker.
// Omitting `origin` makes Google Maps use the device's current location.

function hasCoords(point) {
  return Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lon)
}

// Build a Google Maps directions link to `destination`, optionally routing
// through `waypoint` (the ráfordító / approach point) first. The start point is
// left unset so Google Maps always uses the device's current position; the
// waypoint is the second stop and the destination is the final target.
export function buildGoogleMapsNavLink(destination, waypoint) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lon}`,
    travelmode: 'driving',
  })
  if (hasCoords(waypoint)) {
    params.set('waypoints', `${waypoint.lat},${waypoint.lon}`)
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

// On mobile we hand the link to the OS so Google Maps opens and starts
// navigating. On desktop we copy the link to the clipboard instead. Returns
// 'opened' on mobile, true/false for the clipboard result on desktop.
//
// The marker is the destination; if the POI has a ráfordító it becomes a
// waypoint, so the route is current location -> ráfordító -> marker.
export async function navigateToPoi(poi) {
  const link = buildGoogleMapsNavLink(poi, poi?.approach)

  if (isMobileDevice()) {
    window.location.href = link
    return 'opened'
  }

  try {
    await navigator.clipboard.writeText(link)
    return true
  } catch {
    return false
  }
}
