import { useContext } from 'react'
import { ToastContext } from './ToastContext.js'

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      notify: () => 0,
      dismiss: () => {},
      success: () => 0,
      error: () => 0,
      info: () => 0,
      warning: () => 0,
    }
  }
  return ctx
}
