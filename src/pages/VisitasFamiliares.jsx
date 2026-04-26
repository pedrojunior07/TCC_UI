import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { normalizeForKey } from '../lib/normalize.js'
import { isoWeekRef, nextWeekRef, weekRangeLabel } from '../lib/dates.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'

export function VisitasFamiliares() {
  const {
    nucleos,
    families,
    visitasFamiliares,
    upsertVisitaFamiliar,
    deleteVisitaFamiliar,
  } = useAppData()
  const { currentUser } = useAuth()

  const [params] = useSearchParams()
  const preNucleoId = params.get('nucleoId') || ''

  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])
  const accessibleNucleoIds = useMemo(() => new Set(accessibleNucleos.map((n) => n.id)), [accessibleNucleos])

  const [nucleoId, setNucleoId] = useState(() => {
    if (preNucleoId && accessibleNucleoIds.has(preNucleoId)) return preNucleoId
    return accessibleNucleos[0]?.id ?? ''
  })
  const [weekRef, setWeekRef] = useState(isoWeekRef(new Date()))

  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const nucleo = useMemo(() => accessibleNucleos.find((n) => n.id === nucleoId) ?? null, [accessibleNucleos, nucleoId])

  const currentVisit = useMemo(() => {
    return visitasFamiliares.find((v) => v.nucleoId === nucleoId && v.semanaRef === weekRef) ?? null
  }, [nucleoId, visitasFamiliares, weekRef])

  const familyForCurrent = useMemo(() => {
    if (!currentVisit) return null
    return families.find((f) => f.familyId === currentVisit.familiaId) ?? null
  }, [currentVisit, families])

  const filteredFamilies = useMemo(() => {
    const q = normalizeForKey(query)
    return families
      .filter((f) => {
        if (!q) return true
        const hay = normalizeForKey(`${f.nome ?? ''} ${f.residencia ?? ''} ${f.nomeDoPai ?? ''} ${f.nomeDaMae ?? ''}`)
        return hay.includes(q)
      })
      .slice()
      .sort((a, b) => String(a.nome ?? '').localeCompare(String(b.nome ?? '')))
  }, [families, query])

  const history = useMemo(() => {
    return visitasFamiliares
      .filter((v) => v.nucleoId === nucleoId)
      .slice()
      .sort((a, b) => String(b.semanaRef).localeCompare(String(a.semanaRef)))
      .slice(0, 10)
  }, [nucleoId, visitasFamiliares])

  const chooseFamily = async (familyId) => {
    setError('')
    setNotice('')
    const res = await upsertVisitaFamiliar({
      id: currentVisit?.id || '',
      semanaRef: weekRef,
      familiaId: familyId,
      nucleoId,
      estado: currentVisit?.estado || 'planeada',
      observacoes: currentVisit?.observacoes || '',
    })
    if (!res.ok) {
      setError(res.error || 'Falha ao atribuir.')
      return
    }
    setPickerOpen(false)
    setNotice('Família atribuída à semana.')
  }

  const setEstado = async (estado) => {
    if (!currentVisit) return
    const res = await upsertVisitaFamiliar({ ...currentVisit, estado })
    if (!res.ok) setError(res.error || 'Falha ao atualizar.')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Visitas familiares</div>
            <div className="mt-1 text-sm text-gray-600">Plano semanal: 1 família por semana (por núcleo).</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setWeekRef(nextWeekRef(weekRef, -1))}>Semana anterior</Button>
            <Button onClick={() => setWeekRef(nextWeekRef(weekRef, 1))}>Próxima semana</Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Núcleo</div>
            <select
              value={nucleoId}
              onChange={(e) => setNucleoId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              {accessibleNucleos.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome || 'Núcleo'}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end justify-end">
            <Badge tone="gray">
              {weekRef} • {weekRangeLabel(weekRef)}
            </Badge>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Família da semana</div>
            <Badge tone={currentVisit?.estado === 'realizada' ? 'green' : currentVisit?.estado === 'cancelada' ? 'red' : 'yellow'}>
              {currentVisit?.estado || 'planeada'}
            </Badge>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-medium text-gray-900">{familyForCurrent?.nome || 'Nenhuma família atribuída.'}</div>
            {familyForCurrent ? (
              <div className="mt-1 text-xs text-gray-500">
                {familyForCurrent.residencia ? `Residência: ${familyForCurrent.residencia}` : 'Sem residência.'}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500">Escolha uma família para esta semana.</div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => { setQuery(''); setPickerOpen(true) }} disabled={!nucleoId}>
              Escolher família
            </Button>
            {currentVisit ? (
              <>
                <Button onClick={() => setEstado('realizada')}>Marcar realizada</Button>
                <Button onClick={() => setEstado('cancelada')}>Cancelar</Button>
                <Button variant="danger" onClick={() => deleteVisitaFamiliar(currentVisit.id)}>
                  Remover
                </Button>
              </>
            ) : null}
          </div>

          {nucleo ? (
            <div className="mt-4 text-xs text-gray-500">
              Núcleo: <span className="font-medium text-gray-700">{nucleo.nome}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="text-sm font-semibold text-gray-900">Histórico (últimas visitas)</div>
          <div className="mt-3 space-y-2">
            {history.map((v) => {
              const fam = families.find((f) => f.familyId === v.familiaId) ?? null
              return (
                <div key={v.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{fam?.nome || 'Família'}</div>
                    <div className="mt-1 text-xs text-gray-500">{v.semanaRef}</div>
                  </div>
                  <Badge tone={v.estado === 'realizada' ? 'green' : v.estado === 'cancelada' ? 'red' : 'yellow'}>{v.estado}</Badge>
                </div>
              )
            })}
            {history.length === 0 ? <div className="py-6 text-sm text-gray-500">Sem histórico ainda.</div> : null}
          </div>
        </div>
      </div>

      <Modal
        open={pickerOpen}
        title="Escolher família"
        onClose={() => setPickerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setPickerOpen(false)}>Fechar</Button>
          </div>
        }
      >
        <label className="block">
          <div className="text-xs font-medium text-gray-600">Pesquisar</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, residência..."
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <div className="mt-4 space-y-2">
          {filteredFamilies.map((f) => (
            <button
              key={f.familyId}
              type="button"
              onClick={() => chooseFamily(f.familyId)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{f.nome || 'Família'}</div>
                  <div className="mt-1 truncate text-xs text-gray-500">{f.residencia || 'Sem residência'}</div>
                </div>
                <Badge tone="blue">Escolher</Badge>
              </div>
            </button>
          ))}
          {filteredFamilies.length === 0 ? <div className="py-6 text-sm text-gray-500">Sem famílias encontradas.</div> : null}
        </div>
      </Modal>
    </div>
  )
}
