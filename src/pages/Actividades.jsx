import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { useToast } from '../components/ui/useToast.js'
import { normalizeForKey } from '../lib/normalize.js'
import { formatMonthKey, parseFlexibleDate, toIsoDate } from '../lib/dates.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'

function nextWednesday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const delta = (3 - day + 7) % 7
  const add = delta === 0 ? 7 : delta
  d.setDate(d.getDate() + add)
  return d
}

function estadoTone(estado) {
  if (estado === 'realizada') return 'green'
  if (estado === 'confirmada') return 'blue'
  if (estado === 'cancelada') return 'red'
  return 'yellow'
}

export function Actividades() {
  const navigate = useNavigate()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const { nucleos, actividades, upsertActividade } = useAppData()
  const { currentUser } = useAuth()

  const [query, setQuery] = useState('')
  const [nucleoId, setNucleoId] = useState('all')
  const [month, setMonth] = useState('all')
  const [estado, setEstado] = useState('all')

  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])
  const accessibleNucleoIds = useMemo(() => new Set(accessibleNucleos.map((n) => n.id)), [accessibleNucleos])

  const months = useMemo(() => {
    const set = new Set()
    for (const a of actividades) {
      if (!accessibleNucleoIds.has(a.nucleoId)) continue
      const d = parseFlexibleDate(a.data)
      const key = d ? formatMonthKey(d) : ''
      if (key) set.add(key)
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [accessibleNucleoIds, actividades])

  const filtered = useMemo(() => {
    const q = normalizeForKey(query)
    return actividades
      .filter((a) => {
        if (!accessibleNucleoIds.has(a.nucleoId)) return false
        if (nucleoId !== 'all' && a.nucleoId !== nucleoId) return false
        if (estado !== 'all' && (a.estado || 'planeada') !== estado) return false
        if (month !== 'all') {
          const d = parseFlexibleDate(a.data)
          if (!d || formatMonthKey(d) !== month) return false
        }
        if (!q) return true
        const n = accessibleNucleos.find((x) => x.id === a.nucleoId)
        const hay = normalizeForKey(`${a.titulo ?? ''} ${a.local ?? ''} ${a.data ?? ''} ${n?.nome ?? ''}`)
        return hay.includes(q)
      })
      .slice()
      .sort((a, b) => {
        const da = parseFlexibleDate(a.data)?.getTime() ?? 0
        const db = parseFlexibleDate(b.data)?.getTime() ?? 0
        return db - da
      })
  }, [accessibleNucleoIds, accessibleNucleos, actividades, estado, month, nucleoId, query])

  const createWednesdayMeeting = async () => {
    if (nucleoId === 'all') {
      toast.warning('Escolha primeiro um núcleo para criar o encontro.')
      return
    }
    const nucleo = accessibleNucleos.find((n) => n.id === nucleoId) ?? null
    if (!nucleo) return
    setCreating(true)
    try {
      const actId = await upsertActividade({
        nucleoId: nucleo.id,
        titulo: 'Encontro Semanal',
        data: toIsoDate(nextWednesday()),
        horaInicio: nucleo.horaEncontro || '19:00',
        local: nucleo.localEncontro || '',
        estado: 'planeada',
      })
      if (!actId) {
        toast.error('Falha ao criar o encontro.')
        return
      }
      toast.success('Encontro criado.')
      navigate(`/actividades/${encodeURIComponent(actId)}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Actividades</div>
            <div className="mt-1 text-sm text-gray-600">Lista geral de encontros e actividades dos núcleos.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createWednesdayMeeting} disabled={nucleoId === 'all'} loading={creating}>
              Criar Encontro de Quarta
            </Button>
            <Link to="/actividades/nova">
              <Button variant="primary">Nova actividade</Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Pesquisar</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Título, data, núcleo, local..."
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
            <div className="text-xs font-medium text-gray-600">Mês</div>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="all">Todos</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
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
              <option value="planeada">Planeada</option>
              <option value="confirmada">Confirmada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>

          <div className="flex items-end justify-end sm:col-span-3">
            <Badge tone="gray">{filtered.length} registos</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3">Atividade</th>
                <th className="px-4 py-3">Núcleo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => {
                const nucleo = accessibleNucleos.find((n) => n.id === a.nucleoId) ?? null
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.titulo || 'Encontro Semanal'}</div>
                      {a.local ? <div className="mt-0.5 text-xs text-gray-500">{a.local}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{nucleo?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{a.data || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.horaInicio || '—'}
                      {a.horaFim ? `–${a.horaFim}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={estadoTone(a.estado || 'planeada')}>{a.estado || 'planeada'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/actividades/${encodeURIComponent(a.id)}`}>
                        <Button>Detalhe</Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sem actividades para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
