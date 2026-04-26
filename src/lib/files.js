export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler ficheiro.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

export function bytesFromDataUrl(dataUrl) {
  const s = String(dataUrl ?? '')
  const comma = s.indexOf(',')
  if (comma < 0) return 0
  const base64 = s.slice(comma + 1)
  try {
    const bin = atob(base64)
    return bin.length
  } catch {
    return 0
  }
}

