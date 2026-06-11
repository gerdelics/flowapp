import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db'

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

// Shared loader for saved routes. Previously every page that needed routes
// duplicated this same load + city-derivation + city-filtering logic.
export function useSavedRoutes() {
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const list = await db.routes.orderBy('city').toArray()
    setRoutes(list)
    setLoading(false)
    return list
  }, [])

  useEffect(() => {
    let mounted = true

    db.routes
      .orderBy('city')
      .toArray()
      .then((list) => {
        if (mounted) {
          setRoutes(list)
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const cities = useMemo(() => getRouteCities(routes), [routes])

  const filterByCity = useCallback((city) => filterRoutesByCity(routes, city), [routes])

  return { routes, cities, loading, reload, filterByCity }
}
