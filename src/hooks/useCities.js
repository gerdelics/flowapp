import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addCity as dbAddCity,
  deleteCity as dbDeleteCity,
  renameCity as dbRenameCity,
  subscribeCities,
} from '../db'

// Distinct, sorted union of one or more city-name lists.
export function mergeCities(...lists) {
  const set = new Set()
  lists.forEach((list) => {
    ;(list || []).forEach((name) => {
      if (name) {
        set.add(name)
      }
    })
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'en'))
}

// Live, explicitly-managed list of cities (shared team pool). Cities are added
// via an action (the Routes page button), independent of routes.
export function useCities() {
  const [records, setRecords] = useState([])

  useEffect(() => {
    const unsubscribe = subscribeCities(setRecords)
    return unsubscribe
  }, [])

  const cities = useMemo(() => {
    const names = records.map((record) => record.name).filter(Boolean)
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'en'))
  }, [records])

  const addCity = useCallback(
    async (name) => {
      const trimmed = name?.trim()
      if (!trimmed) {
        return null
      }
      // Avoid case-insensitive duplicates.
      if (cities.some((city) => city.toLowerCase() === trimmed.toLowerCase())) {
        return null
      }
      return dbAddCity(trimmed)
    },
    [cities],
  )

  const deleteCity = useCallback((cityId) => dbDeleteCity(cityId), [])

  const renameCity = useCallback(
    (cityId, nextName, prevName) => dbRenameCity(cityId, nextName, prevName),
    [],
  )

  return { cities, records, addCity, renameCity, deleteCity }
}
