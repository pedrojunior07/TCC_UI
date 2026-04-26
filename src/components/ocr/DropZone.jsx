import { useRef, useState } from 'react'

export function DropZone({ label, hint, file, onFile, accent = 'indigo' }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const accentMap = {
    indigo: { ring: 'ring-indigo-500/40', border: 'border-indigo-400', bg: 'bg-indigo-50/60' },
    emerald: { ring: 'ring-emerald-500/40', border: 'border-emerald-400', bg: 'bg-emerald-50/60' },
  }
  const a = accentMap[accent] ?? accentMap.indigo

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer?.files?.[0]
    if (f && f.type.startsWith('image/')) onFile?.(f)
  }

  const previewUrl = file ? URL.createObjectURL(file) : null

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={[
        'group relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-white p-4 text-center transition-all duration-200',
        drag ? `${a.border} ${a.bg} ring-4 ${a.ring} scale-[1.01]` : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile?.(e.target.files?.[0] ?? null)}
      />
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={label}
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
          onLoad={() => URL.revokeObjectURL(previewUrl)}
        />
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l-5-5-5 5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
            </svg>
          </div>
          <div className="text-sm font-semibold text-gray-900">{label}</div>
          {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
        </>
      )}
      {file ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onFile?.(null) }}
            className="shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/40 hover:bg-white/15"
          >
            Remover
          </button>
        </div>
      ) : null}
    </div>
  )
}
