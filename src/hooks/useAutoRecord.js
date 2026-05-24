import { useEffect, useRef, useState } from 'react'

export function useAutoRecord({ enabled, intervalSec, onTick }) {
  const normalizedIntervalSec =
    Number.isFinite(intervalSec) && intervalSec > 0 ? Math.floor(intervalSec) : 0

  const [secondsLeft, setSecondsLeft] = useState(normalizedIntervalSec)
  const onTickRef = useRef(onTick)

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  useEffect(() => {
    if (!normalizedIntervalSec) {
      const resetTimer = setTimeout(() => {
        setSecondsLeft(0)
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    if (enabled) {
      const resetTimer = setTimeout(() => {
        setSecondsLeft(normalizedIntervalSec)
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    return undefined
  }, [enabled, normalizedIntervalSec])

  useEffect(() => {
    if (!enabled || !normalizedIntervalSec) {
      return undefined
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTickRef.current?.()
          return normalizedIntervalSec
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [enabled, normalizedIntervalSec])

  return {
    secondsLeft,
  }
}
