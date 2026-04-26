import { useEffect, useMemo, useState } from 'react'

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

export function useLocalStorageState(key, initialValue) {
  const initial = useMemo(() => {
    const existing = localStorage.getItem(key)
    if (existing == null) return initialValue
    return safeJsonParse(existing, initialValue)
  }, [key, initialValue])

  const [value, setValue] = useState(initial)

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

