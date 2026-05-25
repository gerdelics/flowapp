const PROVIDER_ICON_DEFAULTS = {
  'google maps': 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/googlemaps.svg',
  google: 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/googlemaps.svg',
  tomtom: 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/tomtom.svg',
  'tomtom drive': 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/tomtom.svg',
  here: 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/here.svg',
  'here we go': 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/here.svg',
  waze: 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/waze.svg',
  apple: 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/apple.svg',
  'apple maps': 'https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/apple.svg',
}

function normalizeProviderName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
}

export function getDefaultProviderIconUrl(providerName) {
  const normalizedName = normalizeProviderName(providerName)
  return PROVIDER_ICON_DEFAULTS[normalizedName] || ''
}
