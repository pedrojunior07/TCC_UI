import { Spinner } from './Spinner.jsx'

export function Button({ variant = 'default', className = '', loading = false, disabled, children, ...props }) {
  const styles =
    variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600 active:bg-indigo-800'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 active:bg-red-800'
        : variant === 'ghost'
          ? 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-indigo-600'
          : variant === 'success'
            ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-600 active:bg-green-800'
            : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:ring-indigo-600'

  const isDisabled = disabled || loading

  const spinnerTone = variant === 'primary' || variant === 'danger' || variant === 'success' ? 'white' : 'indigo'

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        styles,
        className,
      ].join(' ')}
    >
      {loading ? <Spinner size="sm" tone={spinnerTone} /> : null}
      {children}
    </button>
  )
}
