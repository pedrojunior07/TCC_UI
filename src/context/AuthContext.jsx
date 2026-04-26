import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '../lib/storage/keys.js'
import { useLocalStorageState } from '../lib/storage/useLocalStorageState.js'
import { buildApiUrl, readApiError } from '../lib/api/http.js'

function normalizeUsername(username) {
  return String(username ?? '').trim().toLowerCase()
}

function roleLabel(role) {
  if (role === 'super_admin') return 'Super admin'
  if (role === 'secretario') return 'Secretario'
  if (role === 'chefe_nucleo') return 'Gestor do nucleo'
  return String(role ?? '')
}

const AuthContext = createContext(null)

const EMPTY_SESSION = { userId: '', accessToken: '', refreshToken: '', user: null }
const BOOTSTRAP_ATTEMPT_KEY = 'tcc.auth.bootstrap.attempted.v1'
let bootstrapAttemptedInMemory = false
let usersListForbiddenInMemory = false

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/^role_/, '')
    .replace(/[\s-]+/g, '_')
}

async function parseJsonOrNull(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useLocalStorageState(STORAGE_KEYS.session, EMPTY_SESSION)
  const [users, setUsers] = useState([])

  const clearSession = useCallback(() => {
    setSession(EMPTY_SESSION)
    setUsers([])
  }, [setSession])

  const authFetch = useCallback(
    async (path, options = {}, retried = false) => {
      const token = session?.accessToken
      const headers = { ...(options.headers || {}) }
      if (token) headers.Authorization = `Bearer ${token}`
      if (options.body != null && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

      const response = await fetch(buildApiUrl(path), { ...options, headers })
      const shouldTryRefresh = response.status === 401 || response.status === 403
      if (!shouldTryRefresh || retried || !session?.refreshToken) return response

      const refreshRes = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      })

      if (!refreshRes.ok) {
        clearSession()
        return response
      }

      const refreshData = await parseJsonOrNull(refreshRes)
      const nextAccessToken = String(refreshData?.accessToken || '')
      if (!nextAccessToken) {
        clearSession()
        return response
      }

      setSession((prev) => ({ ...prev, accessToken: nextAccessToken }))
      return authFetch(path, options, true)
    },
    [clearSession, session?.accessToken, session?.refreshToken, setSession],
  )

  const currentUser = useMemo(() => {
    const fromSession = session?.user && session.user.active !== false ? session.user : null
    if (fromSession) return fromSession
    const id = session?.userId
    if (!id) return null
    return users.find((u) => u.userId === id && u.active !== false) ?? null
  }, [session?.user, session?.userId, users])

  const fetchUsers = useCallback(async () => {
    const role = normalizeRole(currentUser?.role)
    if (!session?.accessToken || role !== 'super_admin' || usersListForbiddenInMemory) {
      setUsers([])
      return
    }

    let page = 0
    const size = 200
    const merged = []

    while (true) {
      const res = await authFetch(`/api/users?page=${page}&size=${size}&sortBy=createdAt&sortDir=DESC`)
      if (!res.ok) {
        // Evita repetir chamadas sem permissao (403) em ciclos de re-render no dev.
        if (res.status === 403) {
          usersListForbiddenInMemory = true
          setUsers([])
          return
        }
        break
      }
      const data = await parseJsonOrNull(res)
      const content = Array.isArray(data?.content) ? data.content : []
      merged.push(...content)
      if (data?.last === true || content.length === 0) break
      page += 1
    }

    setUsers(merged)
  }, [authFetch, currentUser?.role, session?.accessToken])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const bootstrap = useCallback(async () => {
    if (bootstrapAttemptedInMemory) return null
    if (typeof window !== 'undefined' && window.localStorage.getItem(BOOTSTRAP_ATTEMPT_KEY) === '1') {
      bootstrapAttemptedInMemory = true
      return null
    }

    try {
      bootstrapAttemptedInMemory = true
      const response = await fetch(buildApiUrl('/api/auth/bootstrap'), { method: 'POST' })
      if (response.ok || response.status === 400 || response.status === 409) {
        window.localStorage.setItem(BOOTSTRAP_ATTEMPT_KEY, '1')
      }
      if (!response.ok) return null
      return { username: 'admin', password: 'admin123' }
    } catch {
      bootstrapAttemptedInMemory = false
      return null
    }
  }, [])

  const login = useCallback(
    async ({ username, password }) => {
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) return { ok: false, error: await readApiError(response) }

      const data = await parseJsonOrNull(response)
      const user = data?.user
      if (!user?.userId || !data?.accessToken || !data?.refreshToken) {
        return { ok: false, error: 'Resposta de autenticacao invalida.' }
      }

      setSession({
        userId: String(user.userId),
        accessToken: String(data.accessToken),
        refreshToken: String(data.refreshToken),
        user: {
          userId: String(user.userId),
          username: String(user.username || normalizeUsername(username)),
          name: String(user.name || ''),
          role: String(user.role || ''),
          active: user.active !== false,
          mustChangePassword: user.mustChangePassword === true,
        },
      })
      return { ok: true }
    },
    [setSession],
  )

  const logout = useCallback(async () => {
    const refreshToken = session?.refreshToken
    if (refreshToken) {
      try {
        await authFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
      } catch {
        // ignore
      }
    }
    clearSession()
  }, [authFetch, clearSession, session?.refreshToken])

  const createUser = useCallback(
    async ({ username, name, role, password }) => {
      if (!currentUser || currentUser.role !== 'super_admin') return { ok: false, error: 'Acesso restrito a super admin.' }

      const response = await authFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ username, name, role, password }),
      })
      if (!response.ok) return { ok: false, error: await readApiError(response) }

      const user = await parseJsonOrNull(response)
      await fetchUsers()
      return { ok: true, user }
    },
    [authFetch, currentUser, fetchUsers],
  )

  const updateUser = useCallback(
    async ({ userId, patch }) => {
      if (!currentUser || currentUser.role !== 'super_admin') return { ok: false, error: 'Acesso restrito a super admin.' }

      const payload = {}
      if (patch?.name != null) payload.name = patch.name
      if (patch?.role != null) payload.role = patch.role
      if (patch?.active != null) payload.active = Boolean(patch.active)

      const response = await authFetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!response.ok) return { ok: false, error: await readApiError(response) }

      await fetchUsers()
      return { ok: true }
    },
    [authFetch, currentUser, fetchUsers],
  )

  const setUserActive = useCallback(
    async ({ userId, active }) => updateUser({ userId, patch: { active } }),
    [updateUser],
  )

  const resetUserPassword = useCallback(
    async ({ userId, newPassword }) => {
      if (!currentUser || currentUser.role !== 'super_admin') return { ok: false, error: 'Acesso restrito a super admin.' }

      const response = await authFetch(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      })
      if (!response.ok) return { ok: false, error: await readApiError(response) }
      return { ok: true }
    },
    [authFetch, currentUser],
  )

  const changeMyPassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      if (!currentUser) return { ok: false, error: 'Sem sessao.' }

      const response = await authFetch('/api/auth/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!response.ok) return { ok: false, error: await readApiError(response) }
      setSession((prev) => ({
        ...prev,
        user: prev?.user ? { ...prev.user, mustChangePassword: false } : prev?.user,
      }))
      return { ok: true }
    },
    [authFetch, currentUser, setSession],
  )

  const requestPasswordReset = useCallback(
    async ({ username }) => {
      const response = await fetch(buildApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) return { ok: false, error: await readApiError(response) }
      const data = await parseJsonOrNull(response)
      return {
        ok: true,
        message:
          String(data?.message || '') ||
          'Pedido registado. A secretaria ou o super admin fara a reposicao da senha temporaria.',
      }
    },
    [],
  )

  const value = useMemo(
    () => ({
      users,
      session,
      currentUser,
      roleLabel,
      bootstrap,
      login,
      logout,
      createUser,
      updateUser,
      setUserActive,
      resetUserPassword,
      changeMyPassword,
      requestPasswordReset,
      authFetch,
    }),
    [
      authFetch,
      bootstrap,
      changeMyPassword,
      createUser,
      currentUser,
      login,
      logout,
      requestPasswordReset,
      resetUserPassword,
      session,
      setUserActive,
      updateUser,
      users,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return ctx
}
