export function ProgressBar({ value = 0, max = 100, label = '', tone = 'indigo', indeterminate = false, className = '' }) {
  const percent = Math.max(0, Math.min(100, (Number(value) / Number(max || 1)) * 100))
  const tones = {
    indigo: 'bg-indigo-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-600',
  }
  const fill = tones[tone] || tones.indigo

  return (
    <div className={['w-full', className].join(' ')}>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
          <span>{label}</span>
          {!indeterminate ? <span className="font-medium text-gray-800">{Math.round(percent)}%</span> : null}
        </div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        {indeterminate ? (
          <div className={['h-full w-1/3 animate-[progressSlide_1.2s_ease-in-out_infinite] rounded-full', fill].join(' ')} />
        ) : (
          <div
            className={['h-full rounded-full transition-[width] duration-500 ease-out', fill].join(' ')}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  )
}

export function Stepper({ steps = [], current = 0, onStepClick = null }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const clickable = typeof onStepClick === 'function' && (done || active)
        return (
          <li key={`${step}:${index}`} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick(index) : undefined}
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition',
                done ? 'bg-green-600 text-white' : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-200 text-gray-500',
                clickable ? 'cursor-pointer hover:scale-105' : 'cursor-default',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
                </svg>
              ) : (
                index + 1
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className={[
                'truncate text-xs font-medium',
                active ? 'text-indigo-700' : done ? 'text-green-700' : 'text-gray-500',
              ].join(' ')}>{step}</div>
            </div>
            {index < steps.length - 1 ? (
              <div className={['h-0.5 flex-1 rounded-full', done ? 'bg-green-500' : 'bg-gray-200'].join(' ')} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
