import { useEffect, useRef, useState } from 'react'

export function useAutoRecord({ enabled, intervalSec, onTick }) {
  const normalizedIntervalSec =
    Number.isFinite(intervalSec) && intervalSec > 0 ? Math.floor(intervalSec) : 0

  const [secondsLeft, setSecondsLeft] = useState(normalizedIntervalSec)
  const secondsLeftRef = useRef(normalizedIntervalSec)
  const onTickRef = useRef(onTick)

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  useEffect(() => {
    if (!normalizedIntervalSec) {
      const resetTimer = setTimeout(() => {
        secondsLeftRef.current = 0
        setSecondsLeft(0)
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    if (enabled) {
      const resetTimer = setTimeout(() => {
        secondsLeftRef.current = normalizedIntervalSec
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
      if (secondsLeftRef.current <= 1) {
        secondsLeftRef.current = normalizedIntervalSec
        setSecondsLeft(normalizedIntervalSec)
        onTickRef.current?.()
      } else {
        secondsLeftRef.current -= 1
        setSecondsLeft(secondsLeftRef.current)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [enabled, normalizedIntervalSec])

  return {
    secondsLeft,
  }
}
