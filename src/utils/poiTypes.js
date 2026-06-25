// POI categories selectable when creating a marker. Kept in one place so the
// add dialog, the marker dialog, and the store stay in sync.
export const POI_TYPES = [
  { value: 'roadworks', label: 'Roadworks' },
  { value: 'closure', label: 'Closure' },
  { value: 'road-alert', label: 'Road alert' },
]

export const DEFAULT_POI_TYPE = POI_TYPES[0].value

export function getPoiTypeLabel(value) {
  return POI_TYPES.find((type) => type.value === value)?.label || value || 'Unknown'
}
