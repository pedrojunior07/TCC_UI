/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export function RouteProgress() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return undefined
    }
    setVisible(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), 420)
    return () => clearTimeout(timer.current)
  }, [location.key, navigationType])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-0.5 overflow-hidden bg-indigo-100">
      <div className="nav-progress h-full w-1/3 bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
    </div>
  )
}
