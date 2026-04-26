import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { deriveSacraments } from '../lib/derive/deriveSacraments.js'
import { resolveMemberKey } from '../lib/memberKeys.js'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { MemberForm } from '../components/members/MemberForm.jsx'

function sacramentMatches(filter, derived) {
  if (filter === 'all') return true
  if (filter === 'none') return !derived.baptismo && !derived.crisma && !derived.casamento
  if (filter === 'baptismo') return derived.baptismo
  if (filter === 'crisma') return derived.crisma
  if (filter === 'casamento') return derived.casamento
  return true
}

export function MembersList() {
  const { members, nucleos, removeMemberByKey, updateMemberByKey } = useAppData()
  const { currentUser } = useAuth()
  const [query, setQuery] = useState('')
  const [community, setCommunity] = useState('all')
  const [sacrament, setSacrament] = useState('all')

  const [editOpen, setEditOpen] = useState(false)
  const [editKey, setEditKey] = useState('')
  const [draft, setDraft] = useState(null)
  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])

  const visibleMembers = useMemo(() => {
    if (currentUser?.role !== 'chefe_nucleo') return members
    const allowed = new Set()
    for (const n of accessibleNucleos) {
      const keys = Array.isArray(n.memberKeys) ? n.memberKeys : []
      for (const k of keys) allowed.add(k)
    }
    return members.filter((m) => allowed.has(resolveMemberKey(m)))
  }, [accessibleNucleos, currentUser, members])

  const communities = useMemo(() => {
    const values = new Set()
    for (const m of visibleMembers) {
      const c = normalizeValue(m?.Comunidade)
      if (c) values.add(c)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b))
  }, [visibleMembers])

  const filtered = useMemo(() => {
    const q = normalizeForKey(query)
    return visibleMembers.filter((m) => {
      if (community !== 'all' && normalizeValue(m?.Comunidade) !== community) return false
      const d = deriveSacraments(m)
      if (!sacramentMatches(sacrament, d)) return false
      if (!q) return true
      const hay = normalizeForKey(`${m?.['Nome Completo'] ?? ''} ${m?.Comunidade ?? ''}`)
      return hay.includes(q)
    })
  }, [community, query, sacrament, visibleMembers])

  const openEdit = (member) => {
    const key = resolveMemberKey(member)
    setEditKey(key)
    setDraft(member)
    setEditOpen(true)
  }

  const saveEdit = () => {
    updateMemberByKey(editKey, draft)
    setEditOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Pesquisar</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou comunidade…"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Comunidade</div>
              <select
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="all">Todas</option>
                {communities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Estado (derivado)</div>
              <select
                value={sacrament}
                onChange={(e) => setSacrament(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="all">Todos</option>
                <option value="baptismo">Com baptismo</option>
                <option value="crisma">Com crisma</option>
                <option value="casamento">Com casamento</option>
                <option value="none">Sem sacramentos</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Link to={accessibleNucleos.length === 1 ? `/membros/importar?nucleoId=${encodeURIComponent(accessibleNucleos[0].id)}` : '/membros/importar'}>
              <Button>Importar CSV</Button>
            </Link>
            <Link to={accessibleNucleos.length === 1 ? `/membros/novo?nucleoId=${encodeURIComponent(accessibleNucleos[0].id)}` : '/membros/novo'}>
              <Button variant="primary">Adicionar</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Comunidade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nascimento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Sacramentos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m, idx) => {
                const key = resolveMemberKey(m)
                const s = deriveSacraments(m)
                return (
                  <tr key={`${key}:${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{m?.['Nome Completo'] || '—'}</div>
                      <div className="text-xs text-gray-500">{m?.Residencia || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{m?.Comunidade || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{m?.['Data de Nascimento'] || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={s.baptismo ? 'green' : 'red'}>Baptismo</Badge>
                        <Badge tone={s.crisma ? 'blue' : 'yellow'}>Crisma</Badge>
                        <Badge tone={s.casamento ? 'purple' : 'gray'}>Casamento</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Link to={`/membros/${encodeURIComponent(key)}`}>
                          <Button>Ver</Button>
                        </Link>
                        <Button onClick={() => openEdit(m)}>Editar</Button>
                        {currentUser?.role === 'super_admin' ? (
                          <Button variant="danger" onClick={() => removeMemberByKey(key)}>
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sem membros para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={editOpen}
        title="Editar membro"
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveEdit}>
              Guardar
            </Button>
          </div>
        }
      >
        {draft ? <MemberForm value={draft} onChange={setDraft} /> : null}
      </Modal>
    </div>
  )
}
