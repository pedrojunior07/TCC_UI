const DEFAULT_API_BASE_URL = ''

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function isInsecureAbsoluteUrl(value) {
  return /^http:\/\//i.test(String(value || '').trim())
}

function isHttpsPage() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:'
}

export function getApiBaseUrl() {
  const configured = trimSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
  // Avoid mixed-content requests when the UI is served over HTTPS.
  if (isHttpsPage() && isInsecureAbsoluteUrl(configured)) return ''
  return configured
}

export function buildApiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${normalizedPath}` : normalizedPath
}

export async function readApiError(response) {
  try {
    const data = await response.json()
    if (data?.message) return String(data.message)
    if (data?.error) return String(data.error)
  } catch {
    // ignore
  }
  return `HTTP ${response.status}`
}
