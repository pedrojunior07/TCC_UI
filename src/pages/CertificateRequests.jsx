import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { findMemberByKey, resolveMemberKey } from '../lib/memberKeys.js'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

const CERT_TYPES = [
  { value: 'batismo', label: 'Certificado de Baptismo' },
  { value: 'crisma', label: 'Certificado de Crisma' },
  { value: 'casamento', label: 'Certificado de Casamento' },
  { value: 'declaracao', label: 'Declaração' },
]

function estadoTone(estado) {
  if (estado === 'emitido') return 'green'
  if (estado === 'aprovado') return 'blue'
  if (estado === 'recusado') return 'red'
  return 'yellow'
}

export function CertificateRequests() {
  const { currentUser } = useAuth()
  const { members, nucleos, certificateRequests, upsertCertificateRequest, deleteCertificateRequest } = useAppData()
  const [params] = useSearchParams()

  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState(() => params.get('memberKey') || '')
  const [certType, setCertType] = useState('batismo')
  const [observacoes, setObservacoes] = useState('')
  const [notice, setNotice] = useState('')

  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])

  const allowedMemberKeys = useMemo(() => {
    const set = new Set()
    for (const n of accessibleNucleos) {
      const keys = Array.isArray(n.memberKeys) ? n.memberKeys : []
      for (const k of keys) set.add(k)
    }
    return set
  }, [accessibleNucleos])

  const visibleMembers = useMemo(() => {
    return members.filter((m) => allowedMemberKeys.has(resolveMemberKey(m)))
  }, [allowedMemberKeys, members])

  const results = useMemo(() => {
    const q = normalizeForKey(query)
    if (!q) return visibleMembers.slice(0, 10).map((m) => ({ key: resolveMemberKey(m), member: m }))
    const out = []
    for (const m of visibleMembers) {
      const key = resolveMemberKey(m)
      const hay = normalizeForKey(`${m?.['Nome Completo'] ?? ''} ${m?.Comunidade ?? ''} ${m?.['Data de Nascimento'] ?? ''}`)
      if (!hay.includes(q)) continue
      out.push({ key, member: m })
      if (out.length >= 10) break
    }
    return out
  }, [query, visibleMembers])

  const myRequests = useMemo(() => {
    const uid = currentUser?.userId
    if (!uid) return []
    return certificateRequests
      .filter((r) => r.requestedByUserId === uid)
      .slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
  }, [certificateRequests, currentUser?.userId])

  const selected = useMemo(() => {
    if (!selectedKey) return null
    return findMemberByKey(members, selectedKey)
  }, [members, selectedKey])

  const guessNucleoIdForMember = (memberKey) => {
    const explicit = params.get('nucleoId')
    if (explicit) return explicit
    for (const n of accessibleNucleos) {
      const keys = Array.isArray(n.memberKeys) ? n.memberKeys : []
      if (keys.includes(memberKey)) return n.id
    }
    return accessibleNucleos[0]?.id || ''
  }

  const onSubmit = async () => {
    setNotice('')
    const uid = currentUser?.userId
    if (!uid) return
    if (!selectedKey) return
    const nucleoId = guessNucleoIdForMember(selectedKey)
    const id = await upsertCertificateRequest({
      tipo: certType,
      estado: 'pendente',
      memberKey: selectedKey,
      nucleoId,
      observacoes,
      requestedByUserId: uid,
    })
    setNotice('Solicitação enviada para a secretaria.')
    if (!id) {
      setNotice('Nao foi possivel enviar a solicitacao.')
      return
    }
    setObservacoes('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Solicitar certificado</div>
            <div className="mt-1 text-sm text-gray-600">O gestor do núcleo solicita; a secretaria emite e devolve.</div>
          </div>
          <Badge tone="blue">Fluxo com secretaria</Badge>
        </div>
      </div>

      {accessibleNucleos.length === 0 ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800 shadow-sm">
          Sem núcleos atribuídos a si. Peça ao super admin para lhe atribuir um núcleo.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Nova solicitação</div>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Tipo</div>
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              {CERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Membro</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por nome, comunidade ou data..."
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <div className="mt-3 space-y-1">
            {results.map(({ key, member }, idx) => {
              const active = key === selectedKey
              return (
                <button
                  key={`${key}:${idx}`}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={[
                    'w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset',
                    active ? 'bg-indigo-50 text-indigo-900 ring-indigo-200' : 'bg-white text-gray-900 ring-gray-200 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{normalizeValue(member?.['Nome Completo']) || '(sem nome)'}</div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">
                        {normalizeValue(member?.Comunidade) || 'Sem comunidade'} • {normalizeValue(member?.['Data de Nascimento']) || 'Sem data'}
                      </div>
                    </div>
                    {active ? <Badge tone="blue">selecionado</Badge> : null}
                  </div>
                </button>
              )
            })}
            {visibleMembers.length === 0 ? (
              <div className="py-6 text-sm text-gray-500">Sem membros atribuídos ao(s) seu(s) núcleo(s).</div>
            ) : null}
          </div>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Observações (opcional)</div>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={onSubmit} disabled={!selectedKey || accessibleNucleos.length === 0}>
              Enviar para secretaria
            </Button>
            <Button
              onClick={() => {
                setSelectedKey('')
                setQuery('')
                setObservacoes('')
                setNotice('')
              }}
            >
              Limpar
            </Button>
          </div>

          {notice ? (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              {notice}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Minhas solicitações</div>
            <Badge tone="gray">{myRequests.length}</Badge>
          </div>

          <div className="mt-4 space-y-2">
            {myRequests.map((r) => {
              const member = findMemberByKey(members, r.memberKey)
              const label = CERT_TYPES.find((t) => t.value === r.tipo)?.label || r.tipo
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{label}</div>
                    <div className="mt-0.5 truncate text-xs text-gray-500">
                      {normalizeValue(member?.['Nome Completo']) || r.memberKey || 'Membro'} • {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : ''}
                    </div>
                    {r.observacoes ? <div className="mt-2 text-sm text-gray-700">{r.observacoes}</div> : null}
                    {r.memberKey ? (
                      <div className="mt-2">
                        <Link
                          to={`/membros/${encodeURIComponent(r.memberKey)}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          Abrir ficha do membro
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge tone={estadoTone(r.estado)}>{r.estado || 'pendente'}</Badge>
                    {r.estado === 'pendente' ? (
                      <Button variant="danger" onClick={() => deleteCertificateRequest(r.id)}>
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {myRequests.length === 0 ? <div className="py-10 text-center text-sm text-gray-500">Sem solicitações ainda.</div> : null}
          </div>
        </div>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Resumo do membro</div>
          <div className="mt-2 text-sm text-gray-700">
            <div>Nome: {normalizeValue(selected?.['Nome Completo'])}</div>
            <div>Comunidade: {normalizeValue(selected?.Comunidade) || '—'}</div>
            <div>Data de nascimento: {normalizeValue(selected?.['Data de Nascimento']) || '—'}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
