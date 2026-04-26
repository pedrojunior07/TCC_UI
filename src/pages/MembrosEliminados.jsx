import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { readApiError } from '../lib/api/http.js'

function fmtDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('pt-PT')
  } catch {
    return String(value)
  }
}

export function MembrosEliminados() {
  const { authFetch, users } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [query, setQuery] = useState('')

  const userById = useMemo(() => {
    const map = new Map()
    for (const u of users || []) map.set(String(u.userId || ''), u)
    return map
  }, [users])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await authFetch('/api/members/deleted')
      if (!res.ok) throw new Error(await readApiError(res))
      setItems(await res.json())
    } catch (err) {
      setError(err?.message || 'Falha ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((m) =>
      [m.nomeCompleto, m.comunidade, m.deletedBy].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)),
    )
  }, [items, query])

  const restore = async (member) => {
    setBusyKey(member.memberKey)
    setError('')
    try {
      const res = await authFetch(`/api/members/${encodeURIComponent(member.memberKey)}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error(await readApiError(res))
      setItems((prev) => prev.filter((m) => m.memberKey !== member.memberKey))
    } catch (err) {
      setError(err?.message || 'Falha ao restaurar.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="space-y-4 page-fade">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm slide-up">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Membros eliminados</div>
            <div className="mt-0.5 text-xs text-gray-500">
              Registos marcados como eliminados (soft-delete). Apenas super admin pode restaurar.
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar nome, comunidade ou autor…"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 sm:w-72"
            />
            <Button onClick={load}>Recarregar</Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 slide-up">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">A carregar…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Nenhum registo eliminado.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((m) => {
              const author = userById.get(String(m.deletedBy || '')) || null
              return (
                <li key={m.memberKey} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-gray-900">{m.nomeCompleto || '(sem nome)'}</div>
                      {m.comunidade ? <Badge tone="gray">{m.comunidade}</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Eliminado em <span className="text-gray-700">{fmtDate(m.deletedAt)}</span>
                      {' · '}
                      por <span className="text-gray-700">{author ? `${author.name || author.username} (${author.username})` : (m.deletedBy || 'desconhecido')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      loading={busyKey === m.memberKey}
                      onClick={() => restore(m)}
                    >
                      Restaurar
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
