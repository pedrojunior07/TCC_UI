import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from './ToastContext.js'

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const notify = useCallback((toast) => {
    const id = ++idCounter
    const next = {
      id,
      tone: toast.tone || 'info',
      title: toast.title || '',
      message: toast.message || '',
      duration: toast.duration ?? 4200,
    }
    setToasts((prev) => [...prev, next])
    if (next.duration > 0) {
      const timer = setTimeout(() => dismiss(id), next.duration)
      timers.current.set(id, timer)
    }
    return id
  }, [dismiss])

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer)
    timers.current.clear()
  }, [])

  const api = useMemo(() => ({
    notify,
    dismiss,
    success: (message, title = 'Sucesso') => notify({ tone: 'success', title, message }),
    error: (message, title = 'Erro') => notify({ tone: 'error', title, message, duration: 6000 }),
    info: (message, title = '') => notify({ tone: 'info', title, message }),
    warning: (message, title = 'Atenção') => notify({ tone: 'warning', title, message }),
  }), [notify, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  const tones = {
    success: 'border-green-200 bg-green-50 text-green-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }
  const icons = {
    success: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
      </svg>
    ),
    info: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2.2">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l10 18H2L12 3z" />
        <path strokeLinecap="round" d="M12 10v4m0 3h.01" />
      </svg>
    ),
  }
  return (
    <div
      className={[
        'pointer-events-auto w-full max-w-sm animate-[toastIn_0.25s_ease-out] rounded-2xl border shadow-lg',
        tones[toast.tone] || tones.info,
      ].join(' ')}
      role="status"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">{icons[toast.tone] || icons.info}</div>
        <div className="min-w-0 flex-1">
          {toast.title ? <div className="text-sm font-semibold">{toast.title}</div> : null}
          {toast.message ? <div className="mt-0.5 text-sm opacity-90">{toast.message}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-lg p-1 text-gray-500 transition hover:bg-black/5"
          aria-label="Fechar notificação"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
