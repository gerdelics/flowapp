import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { subscribeRoutes } from '../db'

// Distinct, sorted list of city names from a set of routes.
export function getRouteCities(routes) {
  const set = new Set((routes || []).map((route) => route.city).filter(Boolean))
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'en'))
}

// Routes filtered to a single city (or all routes when no city is selected).
export function filterRoutesByCity(routes, city) {
  if (!city) {
    return routes
  }
  return (routes || []).filter((route) => route.city === city)
}

// Shared loader for saved routes. Backed by a live Firebase subscription so
// routes stay in sync across devices.
export function useSavedRoutes() {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const routesRef = useRef(routes)

  useEffect(() => {
    routesRef.current = routes
  }, [routes])

  useEffect(() => {
    const unsubscribe = subscribeRoutes((list) => {
      const sorted = [...list].sort((a, b) => (a.city || '').localeCompare(b.city || ''))
      setRoutes(sorted)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // The subscription keeps routes current; reload just returns the latest list.
  const reload = useCallback(async () => routesRef.current, [])

  const cities = useMemo(() => getRouteCities(routes), [routes])

  const filterByCity = useCallback((city) => filterRoutesByCity(routes, city), [routes])

  return { routes, cities, loading, reload, filterByCity }
}
