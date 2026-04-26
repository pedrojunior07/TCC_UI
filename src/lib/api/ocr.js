// Cliente para o serviço Python de OCR.

const DEFAULT_CERT_SERVICE_URL = 'http://102.211.186.44:5002'

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

export function getCertServiceUrl() {
  return trimSlash(import.meta.env.VITE_CERT_SERVICE_URL || DEFAULT_CERT_SERVICE_URL)
}

function authHeaders(accessToken) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

async function readError(response) {
  try {
    const data = await response.json()
    if (data?.error) return String(data.error)
    if (data?.message) return String(data.message)
  } catch {
    // ignore
  }
  return `HTTP ${response.status}`
}

export async function extractBi({ front, back, accessToken, useAi = true, crop = true }) {
  if (!front) throw new Error('Imagem da frente é obrigatória.')
  const form = new FormData()
  form.append('image_front', front)
  if (back) form.append('image_back', back)
  form.append('lang', 'por')
  if (!useAi) form.append('ai', '0')
  if (!crop) form.append('crop', '0')
  const res = await fetch(`${getCertServiceUrl()}/api/ocr/bi`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: form,
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function extractAssento(imageFile, accessToken, { useAi = true, crop = true } = {}) {
  const form = new FormData()
  form.append('image', imageFile)
  form.append('lang', 'por')
  if (!useAi) form.append('ai', '0')
  if (!crop) form.append('crop', '0')
  const res = await fetch(`${getCertServiceUrl()}/api/ocr/assento`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: form,
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function confirmBi(data, accessToken) {
  const res = await fetch(`${getCertServiceUrl()}/api/ocr/bi/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
    body: JSON.stringify({ data }),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...body }
}
