import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { parseFlexibleDate } from '../lib/dates.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { resolveMemberKey } from '../lib/memberKeys.js'

function emptyDraft() {
  return {
    id: '',
    nucleoId: '',
    cargo: '',
    responsavelNome: '',
    responsavelContacto: '',
    inicioMandato: '',
    fimMandato: '',
    estado: 'ativo',
  }
}

function endsSoon(fimMandato) {
  const d = parseFlexibleDate(fimMandato)
  if (!d) return false
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  return diff >= 0 && diff <= 30 * 86400000
}

export function Cargos() {
  const { members, nucleos, cargos, upsertCargo, deleteCargo } = useAppData()
  const { currentUser } = useAuth()
  const [params] = useSearchParams()
  const preNucleoId = params.get('nucleoId') || 'all'

  const [query, setQuery] = useState('')
  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])
  const accessibleNucleoIds = useMemo(() => new Set(accessibleNucleos.map((n) => n.id)), [accessibleNucleos])

  const [nucleoId, setNucleoId] = useState(() => {
    if (preNucleoId === 'all') return 'all'
    if (accessibleNucleoIds.has(preNucleoId)) return preNucleoId
    return 'all'
  })
  const [estado, setEstado] = useState('all')

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [error, setError] = useState('')
  const [selectedMemberKey, setSelectedMemberKey] = useState('')

  const membersByKey = useMemo(() => {
    const map = new Map()
    for (const m of members) map.set(resolveMemberKey(m), m)
    return map
  }, [members])

  const nucleoMemberOptions = useMemo(() => {
    const nucleo = accessibleNucleos.find((n) => n.id === draft.nucleoId) ?? null
    const keys = Array.isArray(nucleo?.memberKeys) ? nucleo.memberKeys : []
    const opts = []
    for (const k of keys) {
      const m = membersByKey.get(k)
      if (!m) continue
      const name = normalizeValue(m?.['Nome Completo']) || k
      const comm = normalizeValue(m?.Comunidade)
      opts.push({ key: k, label: comm ? `${name} • ${comm}` : name })
    }
    opts.sort((a, b) => a.label.localeCompare(b.label))
    return opts
  }, [accessibleNucleos, draft.nucleoId, membersByKey])

  const expiring = useMemo(
    () => cargos.filter((c) => accessibleNucleoIds.has(c.nucleoId) && c.estado === 'ativo' && endsSoon(c.fimMandato)),
    [accessibleNucleoIds, cargos],
  )

  const filtered = useMemo(() => {
    const q = normalizeForKey(query)
    return cargos.filter((c) => {
      if (!accessibleNucleoIds.has(c.nucleoId)) return false
      if (nucleoId !== 'all' && c.nucleoId !== nucleoId) return false
      if (estado !== 'all' && (c.estado || 'ativo') !== estado) return false
      if (!q) return true
      const n = accessibleNucleos.find((x) => x.id === c.nucleoId)
      const hay = normalizeForKey(`${c.cargo ?? ''} ${c.responsavelNome ?? ''} ${c.responsavelContacto ?? ''} ${n?.nome ?? ''}`)
      return hay.includes(q)
    })
  }, [accessibleNucleoIds, accessibleNucleos, cargos, estado, nucleoId, query])

  const openCreate = () => {
    setError('')
    setDraft({ ...emptyDraft(), nucleoId: nucleoId !== 'all' ? nucleoId : '' })
    setSelectedMemberKey('')
    setOpen(true)
  }

  const openEdit = (c) => {
    setError('')
    setDraft({ ...emptyDraft(), ...c })
    setSelectedMemberKey('')
    setOpen(true)
  }

  const save = () => {
    setError('')
    if (!draft.nucleoId) return setError('Selecione um núcleo.')
    if (!normalizeValue(draft.cargo)) return setError('Informe o cargo.')
    if (!normalizeValue(draft.responsavelNome)) return setError('Informe o responsável.')
    if (!normalizeValue(draft.inicioMandato)) return setError('Informe o início do mandato.')
    upsertCargo(draft)
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Cargos</div>
            <div className="mt-1 text-sm text-gray-600">Atribuição e monitorização de responsabilidades por núcleo.</div>
          </div>
          <Button variant="primary" onClick={openCreate}>
            Atribuir cargo
          </Button>
        </div>

        {expiring.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <span className="font-semibold">{expiring.length}</span> mandatos terminam nos próximos 30 dias.
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Pesquisar</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cargo, responsável, contacto..."
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Núcleo</div>
            <select
              value={nucleoId}
              onChange={(e) => setNucleoId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="all">Todos</option>
              {accessibleNucleos.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome || 'Núcleo'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Estado</div>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="all">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Mandato</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const n = accessibleNucleos.find((x) => x.id === c.nucleoId)
                const soon = c.estado === 'ativo' && endsSoon(c.fimMandato)
                return (
                  <tr key={c.id} className={['hover:bg-gray-50', soon ? 'bg-yellow-50/40' : ''].join(' ')}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.cargo || '—'}</div>
                      <div className="mt-0.5 text-xs text-gray-500">{n?.nome || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.responsavelNome || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.responsavelContacto || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.inicioMandato || '—'}
                      {c.fimMandato ? ` → ${c.fimMandato}` : ''}
                      {soon ? <div className="mt-0.5 text-xs text-yellow-800">Termina em breve</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.estado === 'ativo' ? 'green' : 'gray'}>{c.estado || 'ativo'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button onClick={() => openEdit(c)}>Editar</Button>
                        <Button variant="danger" onClick={() => deleteCargo(c.id)}>
                          Remover
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sem cargos para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title={draft.id ? 'Editar cargo' : 'Atribuir cargo'}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>
              Guardar
            </Button>
          </div>
        }
      >
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Núcleo</div>
            <select
              value={draft.nucleoId}
              onChange={(e) => {
                const nextId = e.target.value
                setDraft((d) => ({ ...d, nucleoId: nextId }))
                setSelectedMemberKey('')
              }}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Selecionar...</option>
              {accessibleNucleos.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome || 'Núcleo'}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Membro do núcleo (opcional)</div>
            <select
              value={selectedMemberKey}
              onChange={(e) => {
                const k = e.target.value
                setSelectedMemberKey(k)
                const m = k ? membersByKey.get(k) : null
                if (m) setDraft((d) => ({ ...d, responsavelNome: normalizeValue(m?.['Nome Completo']) || d.responsavelNome }))
              }}
              disabled={!draft.nucleoId || nucleoMemberOptions.length === 0}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm disabled:opacity-50 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Selecionar...</option>
              {nucleoMemberOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            {!draft.nucleoId ? (
              <div className="mt-1 text-xs text-gray-500">Selecione primeiro o núcleo.</div>
            ) : nucleoMemberOptions.length === 0 ? (
              <div className="mt-1 text-xs text-gray-500">Sem membros atribuídos a este núcleo.</div>
            ) : null}
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Cargo</div>
            <input
              value={draft.cargo}
              onChange={(e) => setDraft((d) => ({ ...d, cargo: e.target.value }))}
              placeholder="Coordenador"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Estado</div>
            <select
              value={draft.estado}
              onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Responsável</div>
            <input
              value={draft.responsavelNome}
              onChange={(e) => setDraft((d) => ({ ...d, responsavelNome: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Contacto (WhatsApp)</div>
            <input
              value={draft.responsavelContacto}
              onChange={(e) => setDraft((d) => ({ ...d, responsavelContacto: e.target.value }))}
              placeholder="ex.: +258 84 000 0000"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Início do mandato</div>
            <input
              value={draft.inicioMandato}
              onChange={(e) => setDraft((d) => ({ ...d, inicioMandato: e.target.value }))}
              placeholder="2026-01-01"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Fim do mandato (opcional)</div>
            <input
              value={draft.fimMandato}
              onChange={(e) => setDraft((d) => ({ ...d, fimMandato: e.target.value }))}
              placeholder="2026-12-31"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
