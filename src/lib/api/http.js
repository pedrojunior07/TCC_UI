const DEFAULT_API_BASE_URL = 'http://102.211.186.44:8080'

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  return trimSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
}

export function buildApiUrl(path) {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
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
