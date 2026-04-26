export function Badge({ tone = 'gray', className = '', children, ...props }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
    green: 'bg-green-100 text-green-700 ring-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
    red: 'bg-red-100 text-red-700 ring-red-200',
    blue: 'bg-blue-100 text-blue-700 ring-blue-200',
    purple: 'bg-purple-100 text-purple-700 ring-purple-200',
  }

  return (
    <span
      {...props}
      className={[
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset',
        tones[tone] ?? tones.gray,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
