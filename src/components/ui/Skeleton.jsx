export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return <div className={['animate-pulse bg-gray-200', rounded, className].join(' ')} />
}

export function SkeletonLine({ className = '', width = 'w-full' }) {
  return <Skeleton className={['h-4', width, className].join(' ')} rounded="rounded-md" />
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={['space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm', className].join(' ')}>
      <Skeleton className="h-5 w-1/3" rounded="rounded-md" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={['h-3', i % 2 === 0 ? 'w-4/5' : 'w-3/5'].join(' ')} rounded="rounded-md" />
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <Skeleton className="h-10 w-10" rounded="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" rounded="rounded-md" />
            <Skeleton className="h-3 w-2/3" rounded="rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}
