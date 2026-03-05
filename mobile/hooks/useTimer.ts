import { useEffect, useRef, useState } from 'react'

export function useTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function start() {
    startRef.current = Date.now()
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startRef.current!)
    }, 100)
  }

  function stop(): number {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    return elapsed
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return { elapsed, running, start, stop }
}
