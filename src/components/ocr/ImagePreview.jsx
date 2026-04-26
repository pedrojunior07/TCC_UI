import { useEffect, useRef, useState } from 'react'

// Mostra a imagem (objectURL ou src directo) e desenha bounding boxes por cima
// dos campos detectados.
//
// Props:
//   src         — string (object URL/data URL) ou File/Blob
//   page        — { width, height, unit }  (do backend)
//   regions     — { 'Nome Completo': { polygon: [[x,y],...] }, ... }
//   highlight   — chave do campo actualmente focado (string)
//   onSelect    — (fieldKey) => void
//   scanning    — bool (mostra barra de scan animada)
export function ImagePreview({ src, page, regions = {}, highlight, onSelect, scanning = false }) {
  const [url, setUrl] = useState(typeof src === 'string' ? src : '')
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const imgRef = useRef(null)

  useEffect(() => {
    if (typeof src === 'string') {
      setUrl(src)
      return undefined
    }
    if (!src) {
      setUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(src)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [src])

  const onLoad = () => {
    const img = imgRef.current
    if (img) setNatural({ w: img.naturalWidth, h: img.naturalHeight })
  }

  // Se page.unit for "inch", o Azure devolve coords em polegadas; convertemos
  // multiplicando por 96 (CSS px por polegada). Para "pixel", usamos directo.
  const unit = page?.unit ?? 'pixel'
  const scale = unit === 'inch' ? 96 : 1
  const baseW = (page?.width ?? 0) * scale || natural.w || 1
  const baseH = (page?.height ?? 0) * scale || natural.h || 1

  if (!url) return null

  const isCropped = typeof src === 'string' && src.startsWith('data:')

  return (
    <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
      <img
        ref={imgRef}
        src={url}
        alt="OCR preview"
        onLoad={onLoad}
        className={`block max-h-[640px] w-auto max-w-full object-contain ${isCropped ? 'crop-pop' : ''}`}
      />
      {scanning ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-indigo-400/0 via-indigo-400/40 to-indigo-400/0 ocr-scan-bar" />
      ) : null}
      {baseW > 0 && baseH > 0 ? (
        <svg
          viewBox={`0 0 ${baseW} ${baseH}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {Object.entries(regions).map(([key, r]) => {
            const poly = r?.polygon
            if (!poly || poly.length < 3) return null
            const points = poly
              .map(([x, y]) => `${x * scale},${y * scale}`)
              .join(' ')
            const isHL = highlight === key
            return (
              <g key={key} className="pointer-events-auto" onClick={() => onSelect?.(key)}>
                <polygon
                  points={points}
                  fill={isHL ? 'rgba(99,102,241,0.25)' : 'rgba(34,197,94,0.12)'}
                  stroke={isHL ? '#4f46e5' : '#16a34a'}
                  strokeWidth={isHL ? 3 : 2}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            )
          })}
        </svg>
      ) : null}
    </div>
  )
}
