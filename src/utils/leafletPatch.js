import L from 'leaflet'

let patched = false

export function applyLeafletSafetyPatch() {
  if (patched) {
    return
  }

  const tileLayerProto = L?.TileLayer?.prototype
  if (!tileLayerProto || typeof tileLayerProto._getSubdomain !== 'function') {
    return
  }

  const originalGetSubdomain = tileLayerProto._getSubdomain

  tileLayerProto._getSubdomain = function patchedGetSubdomain(tilePoint) {
    const subdomains = this?.options?.subdomains

    if (!subdomains) {
      return ''
    }

    if (typeof subdomains === 'string') {
      if (subdomains.length === 0) {
        return ''
      }
      return originalGetSubdomain.call(this, tilePoint)
    }

    if (Array.isArray(subdomains)) {
      if (subdomains.length === 0) {
        return ''
      }
      return originalGetSubdomain.call(this, tilePoint)
    }

    return ''
  }

  patched = true
}
