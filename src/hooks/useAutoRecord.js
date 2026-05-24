import { useEffect, useRef, useState } from 'react'

export function useAutoRecord({ enabled, intervalSec, onTick }) {
  const [secondsLeft, setSecondsLeft] = useState(intervalSec)
  const onTickRef = useRef(onTick)

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  useEffect(() => {
    if (!enabled || !intervalSec) {
      return undefined
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onTickRef.current?.()
          return intervalSec
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [enabled, intervalSec])

  return {
    secondsLeft,
  }
}
