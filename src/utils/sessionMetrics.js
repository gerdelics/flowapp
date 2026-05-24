function toNumber(value) {
  return Number.isFinite(value) ? value : null
}

function toRad(value) {
  return (value * Math.PI) / 180
}

function haversineKm(pointA, pointB) {
  const lat1 = toNumber(pointA?.lat)
  const lon1 = toNumber(pointA?.lon)
  const lat2 = toNumber(pointB?.lat)
  const lon2 = toNumber(pointB?.lon)

  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return 0
  }

  const earthRadiusKm = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getSessionPathDistanceKm(path) {
  if (!Array.isArray(path) || path.length < 2) {
    return 0
  }

  let totalKm = 0
  for (let index = 1; index < path.length; index += 1) {
    totalKm += haversineKm(path[index - 1], path[index])
  }

  return totalKm
}

export function getSessionDurationMs(session) {
  if (!session?.startTime) {
    return 0
  }

  const start = new Date(session.startTime).getTime()
  if (!Number.isFinite(start)) {
    return 0
  }

  const end = session.endTime ? new Date(session.endTime).getTime() : Date.now()
  if (!Number.isFinite(end) || end < start) {
    return 0
  }

  return end - start
}

export function getSessionAverageSpeedKmh(session) {
  const distanceKm = getSessionPathDistanceKm(session?.path)
  const durationHours = getSessionDurationMs(session) / (1000 * 60 * 60)

  if (distanceKm <= 0 || durationHours <= 0) {
    return 0
  }

  return distanceKm / durationHours
}

export function formatDistanceKm(distanceKm) {
  return `${distanceKm.toFixed(2)} km`
}

export function formatAverageSpeedKmh(speedKmh) {
  return `${speedKmh.toFixed(1)} km/h`
}
