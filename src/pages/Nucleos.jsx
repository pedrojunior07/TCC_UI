import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { useToast } from '../components/ui/useToast.js'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { makeMemberKey } from '../lib/derive/makeMemberKey.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'

function emptyDraft() {
  return {
    id: '',
    nome: '',
    comunidade: '',
    descricao: '',
    diaEncontro: 'Quarta-feira',
    horaEncontro: '19:00',
    localEncontro: '',
    ativo: true,
  }
}

export function Nucleos() {
  const toast = useToast()
  const { nucleos, actividades, members, upsertNucleo, deleteNucleo } = useAppData()
  const { currentUser, users } = useAuth()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ativos')

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [memberQuery, setMemberQuery] = useState('')
  const [error, setError] = useState('')

  const isSuperAdmin = currentUser?.role === 'super_admin'
  const chiefCandidates = useMemo(() => users.filter((u) => u.active !== false && u.role === 'chefe_nucleo'), [users])

  const activityCountByNucleo = useMemo(() => {
    const map = new Map()
    for (const a of actividades) map.set(a.nucleoId, (map.get(a.nucleoId) || 0) + 1)
    return map
  }, [actividades])

  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])

  const filtered = useMemo(() => {
    const q = normalizeForKey(query)
    return accessibleNucleos.filter((n) => {
      if (status === 'ativos' && n.ativo === false) return false
      if (status === 'inativos' && n.ativo !== false) return false
      if (!q) return true
      const hay = normalizeForKey(`${n.nome ?? ''} ${n.comunidade ?? ''} ${n.localEncontro ?? ''}`)
      return hay.includes(q)
    })
  }, [accessibleNucleos, query, status])

  const memberOptions = useMemo(() => {
    // Prefere a chave do backend (PK real). Cai no makeMemberKey só como fallback
    // para membros locais ainda não persistidos.
    return members
      .map((m) => ({
        key: normalizeValue(m?.__memberKey) || makeMemberKey(m),
        nome: m?.['Nome Completo'] || '',
        comunidade: m?.Comunidade || '',
      }))
      .filter((x) => x.key && normalizeValue(x.nome))
  }, [members])

  const filteredMemberOptions = useMemo(() => {
    const q = normalizeForKey(memberQuery)
    if (!q) return memberOptions.slice(0, 50)
    const out = []
    for (const m of memberOptions) {
      const hay = normalizeForKey(`${m.nome} ${m.comunidade}`)
      if (!hay.includes(q)) continue
      out.push(m)
      if (out.length >= 50) break
    }
    return out
  }, [memberOptions, memberQuery])

  const openCreate = () => {
    const base = emptyDraft()
    const chefeUserIds = currentUser?.role === 'chefe_nucleo' ? [currentUser.userId] : []
    setDraft({ ...base, chefeUserIds, memberKeys: [] })
    setMemberQuery('')
    setError('')
    setOpen(true)
  }

  const openEdit = (n) => {
    setDraft({
      id: n.id,
      nome: n.nome ?? '',
      comunidade: n.comunidade ?? '',
      descricao: n.descricao ?? '',
      diaEncontro: n.diaEncontro ?? 'Quarta-feira',
      horaEncontro: n.horaEncontro ?? '19:00',
      localEncontro: n.localEncontro ?? '',
      ativo: n.ativo !== false,
      memberKeys: Array.isArray(n.memberKeys) ? n.memberKeys : [],
      chefeUserIds: Array.isArray(n.chefeUserIds) ? n.chefeUserIds : [],
    })
    setMemberQuery('')
    setError('')
    setOpen(true)
  }

  const save = async () => {
    if (!normalizeValue(draft.nome)) return
    const nextChefeUserIds =
      currentUser?.role === 'chefe_nucleo'
        ? Array.from(new Set([...(draft.chefeUserIds || []), currentUser.userId].filter(Boolean)))
        : Array.isArray(draft.chefeUserIds)
          ? draft.chefeUserIds
          : []

    if (isSuperAdmin && nextChefeUserIds.length === 0) {
      setError('Selecione pelo menos 1 gestor do núcleo.')
      return
    }

    const enforced = { ...draft, chefeUserIds: nextChefeUserIds }
    setError('')
    const result = await upsertNucleo(enforced)
    if (!result?.ok) {
      setError(result?.error || 'Falha ao guardar o núcleo.')
      toast.error(result?.error || 'Falha ao guardar o núcleo.')
      return
    }
    toast.success(draft.id ? 'Núcleo actualizado.' : 'Núcleo criado.')
    setOpen(false)
  }

  const canSave =
    Boolean(normalizeValue(draft.nome)) && (!isSuperAdmin || (Array.isArray(draft.chefeUserIds) && draft.chefeUserIds.length > 0))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Núcleos</div>
            <div className="mt-1 text-sm text-gray-600">Gestão de núcleos e encontros semanais (quarta-feira).</div>
          </div>
          {isSuperAdmin ? (
            <Button variant="primary" onClick={openCreate}>
            Novo Núcleo
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Pesquisar</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, comunidade, local..."
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Estado</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <div className="flex items-end justify-end">
            <Badge tone="gray">{filtered.length} núcleos</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((n) => {
          const count = activityCountByNucleo.get(n.id) || 0
          return (
            <div key={n.id} className="card-pop rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{n.nome || '(sem nome)'}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {n.diaEncontro || 'Quarta-feira'} • {n.horaEncontro || '—'}
                    {n.localEncontro ? ` • ${n.localEncontro}` : ''}
                  </div>
                  {n.comunidade ? <div className="mt-1 text-xs text-gray-500">Comunidade: {n.comunidade}</div> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge tone={n.ativo === false ? 'red' : 'green'}>{n.ativo === false ? 'inativo' : 'ativo'}</Badge>
                  {currentUser?.role === 'chefe_nucleo' ? <Badge tone="blue">{count} actividades</Badge> : null}
                </div>
              </div>

              {n.descricao ? <div className="mt-4 text-sm text-gray-700">{n.descricao}</div> : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/nucleos/${encodeURIComponent(n.id)}`}>
                  <Button>Detalhe</Button>
                </Link>
                <Button onClick={() => openEdit(n)}>Editar</Button>
                {isSuperAdmin ? (
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm(`Remover o núcleo "${n.nome}"? Esta acção é irreversível.`)) return
                      deleteNucleo(n.id)
                      toast.info('Núcleo removido.')
                    }}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-900/5">
            Sem núcleos para mostrar.
          </div>
        ) : null}
      </div>

      <Modal
        open={open}
        title={draft.id ? 'Editar Núcleo' : 'Novo Núcleo'}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save} disabled={!canSave}>
              Guardar
            </Button>
          </div>
        }
      >
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Nome</div>
            <input
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Comunidade (opcional)</div>
            <input
              value={draft.comunidade}
              onChange={(e) => setDraft((d) => ({ ...d, comunidade: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Local (opcional)</div>
            <input
              value={draft.localEncontro}
              onChange={(e) => setDraft((d) => ({ ...d, localEncontro: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Dia do encontro</div>
            <input
              value={draft.diaEncontro}
              onChange={(e) => setDraft((d) => ({ ...d, diaEncontro: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Hora do encontro</div>
            <input
              value={draft.horaEncontro}
              onChange={(e) => setDraft((d) => ({ ...d, horaEncontro: e.target.value }))}
              placeholder="19:00"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Descrição (opcional)</div>
            <textarea
              value={draft.descricao}
              onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="mt-1 inline-flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.ativo}
              onChange={(e) => setDraft((d) => ({ ...d, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
            Núcleo ativo
          </label>

          {isSuperAdmin ? (
            <div className="sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Membros do núcleo</div>
            <div className="mt-2 rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-3">
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Pesquisar membros..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
                <div className="mt-2 text-xs text-gray-500">
                  Selecionados: <span className="font-medium text-gray-700">{(draft.memberKeys || []).length}</span>
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-3">
                <div className="space-y-2">
                  {filteredMemberOptions.map((m, idx) => {
                    const checked = (draft.memberKeys || []).includes(m.key)
                    return (
                      <label key={`${m.key}:${idx}`} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? Array.from(new Set([...(draft.memberKeys || []), m.key]))
                              : (draft.memberKeys || []).filter((k) => k !== m.key)
                            setDraft((d) => ({ ...d, memberKeys: next }))
                          }}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{m.nome}</div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">{m.comunidade || 'Sem comunidade'}</div>
                        </div>
                      </label>
                    )
                  })}
                  {members.length === 0 ? <div className="py-6 text-sm text-gray-500">Sem membros ainda.</div> : null}
                </div>
              </div>
            </div>
            </div>
          ) : null}

          {isSuperAdmin ? (
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-gray-600">Gestores do núcleo</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {chiefCandidates.map((u) => {
                  const checked = (draft.chefeUserIds || []).includes(u.userId)
                  return (
                    <label key={u.userId} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...(draft.chefeUserIds || []), u.userId]))
                            : (draft.chefeUserIds || []).filter((id) => id !== u.userId)
                          setDraft((d) => ({ ...d, chefeUserIds: next }))
                        }}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{u.name || u.username}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">{u.username}</div>
                      </div>
                    </label>
                  )
                })}
                {chiefCandidates.length === 0 ? (
                  <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    Crie utilizadores com perfil “Gestor do núcleo” em Utilizadores.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

        </div>
      </Modal>
    </div>
  )
}
