export function Spinner({ size = 'md', className = '', tone = 'indigo' }) {
  const sizes = {
    xs: 'h-3 w-3 border-2',
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-8 w-8 border-[3px]',
    xl: 'h-12 w-12 border-4',
  }
  const tones = {
    indigo: 'border-indigo-200 border-t-indigo-600',
    white: 'border-white/30 border-t-white',
    gray: 'border-gray-200 border-t-gray-600',
    green: 'border-green-200 border-t-green-600',
  }
  return (
    <span
      className={[
        'inline-block animate-spin rounded-full',
        sizes[size] || sizes.md,
        tones[tone] || tones.indigo,
        className,
      ].join(' ')}
      role="status"
      aria-label="A carregar"
    />
  )
}

export function InlineSpinner({ label = 'A carregar…', className = '' }) {
  return (
    <span className={['inline-flex items-center gap-2 text-sm text-gray-600', className].join(' ')}>
      <Spinner size="sm" />
      {label}
    </span>
  )
}

export function FullSpinner({ label = 'A carregar…' }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-sm text-gray-600">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  )
}
