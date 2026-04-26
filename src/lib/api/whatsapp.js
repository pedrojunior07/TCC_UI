import { readApiError } from './http.js'

async function parseJsonOrNull(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function requestJson(authFetch, path, options = {}) {
  const response = await authFetch(path, options)
  const data = await parseJsonOrNull(response)
  if (!response.ok) {
    const error = data?.message || data?.error || (await readApiError(response))
    throw new Error(String(error || `HTTP ${response.status}`))
  }
  return data
}

function makeQuery(params = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export function createWhatsappApi(authFetch) {
  return {
    health: () => requestJson(authFetch, '/api/whatsapp/health'),
    registerSession: (payload = {}) =>
      requestJson(authFetch, '/api/whatsapp/session/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ensureSession: (payload = {}) =>
      requestJson(authFetch, '/api/whatsapp/session/ensure', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getSessionSnapshot: () => requestJson(authFetch, '/api/whatsapp/session/snapshot'),
    getSessionStatus: () => requestJson(authFetch, '/api/whatsapp/session/status'),
    getSessionQr: () => requestJson(authFetch, '/api/whatsapp/session/qr'),
    logoutSession: () =>
      requestJson(authFetch, '/api/whatsapp/session/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    listGroups: () => requestJson(authFetch, '/api/whatsapp/groups'),
    getGroupMetadata: (groupJid) =>
      requestJson(authFetch, `/api/whatsapp/groups/metadata${makeQuery({ groupJid })}`),
    sendDirectMessage: (payload) =>
      requestJson(authFetch, '/api/whatsapp/messages/direct', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    sendGroupMessage: (payload) =>
      requestJson(authFetch, '/api/whatsapp/messages/group', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    sendGroupMemberMessage: (payload) =>
      requestJson(authFetch, '/api/whatsapp/messages/group-member', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    listRegistrations: () => requestJson(authFetch, '/api/whatsapp/registrations'),
    createRegistration: (payload) =>
      requestJson(authFetch, '/api/whatsapp/registrations', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deleteRegistration: (phoneNumber) =>
      requestJson(authFetch, `/api/whatsapp/registrations${makeQuery({ phoneNumber })}`, {
        method: 'DELETE',
      }),
    getTemplates: () => requestJson(authFetch, '/api/whatsapp/templates'),
    updateTemplates: (templates) =>
      requestJson(authFetch, '/api/whatsapp/templates', {
        method: 'PUT',
        body: JSON.stringify({ templates }),
      }),
    listEvents: (filters = {}) => requestJson(authFetch, `/api/whatsapp/events${makeQuery(filters)}`),
    updateEvent: (eventId, payload) =>
      requestJson(authFetch, `/api/whatsapp/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  }
}

export function pickArray(data, keys = []) {
  if (Array.isArray(data)) return data
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }
  for (const value of Object.values(data || {})) {
    if (Array.isArray(value)) return value
  }
  return []
}

export function pickObject(data, keys = []) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of keys) {
      const value = data[key]
      if (value && typeof value === 'object' && !Array.isArray(value)) return value
    }
    return data
  }
  return {}
}
