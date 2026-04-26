import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { useToast } from '../components/ui/useToast.js'
import { normalizeValue } from '../lib/normalize.js'
import { toIsoDate } from '../lib/dates.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { createWhatsappApi } from '../lib/api/whatsapp.js'
import { resolveWhatsappGroupsFromNucleo } from '../lib/whatsappGroups.js'
import { labelForWhatsappTrigger, sendAutomaticGroupNotifications } from '../lib/whatsappNotifications.js'

function emptyDraft() {
  return {
    nucleoId: '',
    titulo: 'Encontro Semanal',
    data: '',
    horaInicio: '',
    horaFim: '',
    local: '',
    agenda: '',
    estado: 'planeada',
    participantesEstimados: '',
    participantesPresentes: '',
    notas: '',
  }
}

export function ActividadeNew() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const preNucleoId = params.get('nucleoId') || ''
  const [saving, setSaving] = useState(false)

  const { nucleos, whatsappConfig, whatsappNotificacoes, upsertActividade, addLog } = useAppData()
  const { currentUser, authFetch } = useAuth()
  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])
  const [draft, setDraft] = useState(() => {
    const base = emptyDraft()
    if (!preNucleoId) return base
    const n = accessibleNucleos.find((x) => x.id === preNucleoId) ?? null
    if (!n) return base
    return {
      ...base,
      nucleoId: n.id,
      horaInicio: n.horaEncontro || '19:00',
      local: n.localEncontro || '',
      data: toIsoDate(new Date()),
    }
  })

  const nucleo = useMemo(() => nucleos.find((n) => n.id === draft.nucleoId) ?? null, [draft.nucleoId, nucleos])
  const whatsappTargets = useMemo(() => resolveWhatsappGroupsFromNucleo(nucleo), [nucleo])
  const whatsappApi = useMemo(() => createWhatsappApi(authFetch), [authFetch])
  const waEnabled = Boolean(whatsappConfig?.enabled)
  const waNotifsForNucleo = useMemo(
    () => whatsappNotificacoes.filter((item) => item.nucleoId === draft.nucleoId),
    [draft.nucleoId, whatsappNotificacoes],
  )

  const plannedTriggers = useMemo(() => {
    const base = ['actividade_criada']
    if (String(draft.estado || '') === 'confirmada') base.push('apos_confirmacao')
    return base
  }, [draft.estado])

  const plannedFunnels = useMemo(
    () => waNotifsForNucleo.filter((n) => n?.enabled !== false && plannedTriggers.includes(n.trigger || 'manual')),
    [plannedTriggers, waNotifsForNucleo],
  )

  const save = async () => {
    if (!draft.nucleoId) {
      toast.warning('Escolha o núcleo.')
      return
    }
    if (!normalizeValue(draft.data)) {
      toast.warning('Escolha a data do encontro.')
      return
    }
    setSaving(true)
    try {
      const savedActivity = {
        ...draft,
        participantesEstimados: draft.participantesEstimados ? Number(draft.participantesEstimados) : null,
        participantesPresentes: draft.participantesPresentes ? Number(draft.participantesPresentes) : null,
      }
      const id = await upsertActividade(savedActivity)
      if (!id) {
        throw new Error('Falha ao criar actividade.')
      }

      if (waEnabled && whatsappTargets.length > 0 && plannedFunnels.length > 0) {
        const triggerResults = []
        for (const trigger of plannedTriggers) {
          triggerResults.push(
            await sendAutomaticGroupNotifications({
              whatsappApi,
              notifications: waNotifsForNucleo,
              trigger,
              nucleo,
              actividade: { ...savedActivity, id },
            }),
          )
        }
        const autoSent = triggerResults.reduce((sum, item) => sum + Number(item?.sent || 0), 0)
        const autoFailed = triggerResults.flatMap((item) => item?.failed || [])

        if (autoSent > 0) {
          toast.success(`${autoSent} notificação(ões) enviada(s) ao grupo.`)
        }
        if (autoFailed.length > 0) {
          toast.error(`${autoFailed.length} envio(s) falharam.`)
        }

        if (autoSent > 0 || autoFailed.length > 0) {
          addLog('whatsapp_auto', 'Notificacoes automaticas da nova atividade processadas.', {
            actividadeId: id,
            sent: autoSent,
            failed: autoFailed.length,
          })
        }
      }

      toast.success('Actividade criada.')
      navigate(`/actividades/${encodeURIComponent(id)}`)
    } catch (err) {
      toast.error(err?.message || 'Falha ao criar actividade.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Nova actividade</div>
            <div className="mt-1 text-sm text-gray-600">Criar um encontro/atividade e depois gerir no detalhe.</div>
          </div>
          <div className="flex gap-2">
            <Link to="/actividades">
              <Button>Voltar</Button>
            </Link>
            <Button variant="primary" onClick={save} loading={saving} disabled={!draft.nucleoId || !normalizeValue(draft.data)}>
              Criar
            </Button>
          </div>
        </div>

        {waEnabled && nucleo && plannedFunnels.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
            <div className="flex flex-wrap items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" /></svg>
              <span className="font-semibold">{plannedFunnels.length} funil(is) serão disparados ao criar:</span>
              {plannedFunnels.map((f, i) => (
                <Badge key={`${f.id || i}`} tone="green">{f.nome || 'Mensagem'} ({labelForWhatsappTrigger(f.trigger)})</Badge>
              ))}
            </div>
            <div className="mt-1 text-xs text-emerald-800">Destino: {whatsappTargets.length} grupo(s) vinculado(s) a este núcleo.</div>
          </div>
        ) : null}
        {waEnabled && nucleo && plannedFunnels.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
            Este núcleo ainda não tem funis activos para envio automático. Vá ao separador WhatsApp do núcleo para criar.
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Núcleo</div>
            <select
              value={draft.nucleoId}
              onChange={(e) => setDraft((d) => ({ ...d, nucleoId: e.target.value }))}
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
            <div className="text-xs font-medium text-gray-600">Título</div>
            <input
              value={draft.titulo}
              onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-600">Data</div>
            <input type="date"
              value={draft.data}
              onChange={(e) => setDraft((d) => ({ ...d, data: e.target.value }))}
              placeholder="2026-01-07"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <div className="flex items-end justify-end">
            {nucleo ? (
              <Badge tone="gray">
                {nucleo.diaEncontro || 'Quarta-feira'} • {nucleo.horaEncontro || '—'}
              </Badge>
            ) : (
              <Badge tone="gray">Selecione um núcleo</Badge>
            )}
          </div>

          <label className="block">
            <div className="text-xs font-medium text-gray-600">Hora início</div>
            <input type="time"
              value={draft.horaInicio}
              onChange={(e) => setDraft((d) => ({ ...d, horaInicio: e.target.value }))}
              placeholder="19:00"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Hora fim</div>
            <input type="time"
              value={draft.horaFim}
              onChange={(e) => setDraft((d) => ({ ...d, horaFim: e.target.value }))}
              placeholder="21:00"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Local</div>
            <input
              value={draft.local}
              onChange={(e) => setDraft((d) => ({ ...d, local: e.target.value }))}
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
              <option value="planeada">Planeada</option>
              <option value="confirmada">Confirmada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Participantes estimados</div>
            <input
              value={draft.participantesEstimados}
              onChange={(e) => setDraft((d) => ({ ...d, participantesEstimados: e.target.value }))}
              placeholder="ex.: 25"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Agenda</div>
            <textarea
              value={draft.agenda}
              onChange={(e) => setDraft((d) => ({ ...d, agenda: e.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Notas</div>
            <textarea
              value={draft.notas}
              onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
