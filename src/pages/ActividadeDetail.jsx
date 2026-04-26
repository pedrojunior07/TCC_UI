import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { useToast } from '../components/ui/useToast.js'
import { normalizeValue } from '../lib/normalize.js'
import { parseFlexibleDateTime, toIsoDate } from '../lib/dates.js'
import { fileToDataUrl } from '../lib/files.js'
import { canAccessNucleo } from '../lib/nucleoAccess.js'
import { createWhatsappApi } from '../lib/api/whatsapp.js'
import { resolveWhatsappGroupsFromNucleo } from '../lib/whatsappGroups.js'
import { labelForWhatsappTrigger, sendAutomaticGroupNotifications } from '../lib/whatsappNotifications.js'

function estadoTone(estado) {
  if (estado === 'realizada') return 'green'
  if (estado === 'confirmada') return 'blue'
  if (estado === 'cancelada') return 'red'
  return 'yellow'
}

function icsDateUtc(date) {
  const d = new Date(date.getTime())
  const pad = (n) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    '00Z'
  )
}

function makeIcs({ uid, title, start, end, location, description }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Paroquia//Nucleos//PT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDateUtc(new Date())}`,
    `DTSTART:${icsDateUtc(start)}`,
    `DTEND:${icsDateUtc(end)}`,
    `SUMMARY:${String(title ?? '').replace(/\\n/g, ' ')}`,
    location ? `LOCATION:${String(location).replace(/\\n/g, ' ')}` : '',
    description ? `DESCRIPTION:${String(description).replace(/\\n/g, '\\\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.join('\\r\\n')
}

function emptyContribution() {
  return {
    id: '',
    tipo: 'cota',
    valor: '',
    moeda: 'MZN',
    data: toIsoDate(new Date()),
    pagador: '',
    metodo: 'numerario',
    descricao: '',
    quitado: true,
    comprovado: false,
    comprovativo: null,
  }
}

export function ActividadeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [sendingWa, setSendingWa] = useState(false)
  const { currentUser, authFetch } = useAuth()
  const {
    nucleos,
    actividades,
    cargos,
    contribuicoes,
    imagensActividades,
    whatsappConfig,
    whatsappNotificacoes,
    upsertActividade,
    deleteActividade,
    upsertContribuicao,
    deleteContribuicao,
    addImagemActividade,
    deleteImagemActividade,
    addLog,
  } = useAppData()

  const activity = useMemo(() => actividades.find((a) => a.id === id) ?? null, [actividades, id])
  const nucleo = useMemo(() => nucleos.find((n) => n.id === activity?.nucleoId) ?? null, [activity, nucleos])

  const [draft, setDraft] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [icsOpen, setIcsOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waMessage, setWaMessage] = useState('')
  const [waSelected, setWaSelected] = useState([])
  const [waToGroup, setWaToGroup] = useState(false)

  const [contribOpen, setContribOpen] = useState(false)
  const [contribDraft, setContribDraft] = useState(emptyContribution())
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptId, setReceiptId] = useState('')

  const imgs = useMemo(() => imagensActividades.filter((x) => x.actividadeId === id), [id, imagensActividades])
  const contribs = useMemo(() => contribuicoes.filter((c) => c.actividadeId === id), [contribuicoes, id])
  const contacts = useMemo(() => {
    if (!activity?.nucleoId) return []
    return cargos
      .filter((c) => c.nucleoId === activity.nucleoId && (c.estado || 'ativo') === 'ativo')
      .filter((c) => normalizeValue(c.responsavelContacto))
      .map((c) => ({
        id: c.id,
        nome: c.responsavelNome || c.cargo || 'Responsável',
        contacto: c.responsavelContacto,
        cargo: c.cargo || '',
      }))
  }, [activity, cargos])

  const groupTargets = useMemo(
    () => resolveWhatsappGroupsFromNucleo(nucleo).filter((group) => normalizeValue(group?.groupId)),
    [nucleo],
  )
  const waEnabled = Boolean(whatsappConfig?.enabled)
  const waNotifsForNucleo = useMemo(
    () => whatsappNotificacoes.filter((item) => item.nucleoId === activity?.nucleoId),
    [activity?.nucleoId, whatsappNotificacoes],
  )

  const receipt = useMemo(() => contribuicoes.find((c) => c.id === receiptId) ?? null, [contribuicoes, receiptId])

  if (!id) return <Navigate to="/actividades" replace />
  if (!activity) return <Navigate to="/actividades" replace />
  if (!nucleo) return <Navigate to="/actividades" replace />
  if (!canAccessNucleo({ currentUser, nucleo })) return <Navigate to="/actividades" replace />

  const current = draft || activity
  const whatsappApi = createWhatsappApi(authFetch)

  const icsPayload = (() => {
    const start =
      parseFlexibleDateTime(current.data, current.horaInicio) || parseFlexibleDateTime(current.data, nucleo?.horaEncontro)
    if (!start) return ''
    const end = parseFlexibleDateTime(current.data, current.horaFim) || new Date(start.getTime() + 90 * 60000)
    return makeIcs({
      uid: `paroquia-${activity.id}@local`,
      title: `${current.titulo || 'Encontro Semanal'}${nucleo?.nome ? ` — ${nucleo.nome}` : ''}`,
      start,
      end,
      location: current.local || nucleo?.localEncontro || '',
      description: current.agenda || current.notas || '',
    })
  })()

  const icsHref = icsPayload ? `data:text/calendar;charset=utf-8,${encodeURIComponent(icsPayload)}` : ''

  const save = async () => {
    setError('')
    setNotice('')
    if (!normalizeValue(current.nucleoId)) {
      setError('Selecione um núcleo.')
      toast.warning('Selecione um núcleo.')
      return
    }
    if (!normalizeValue(current.data)) {
      setError('Informe a data.')
      toast.warning('Informe a data.')
      return
    }
    setSaving(true)
    try {
      const savedActivity = {
        ...current,
        id: activity.id,
        participantesEstimados: current.participantesEstimados === '' ? null : Number(current.participantesEstimados ?? null),
        participantesPresentes: current.participantesPresentes === '' ? null : Number(current.participantesPresentes ?? null),
      }
      const savedId = await upsertActividade(savedActivity)
      if (!savedId) {
        throw new Error('Falha ao guardar actividade.')
      }
      setDraft(null)
      const triggerResults = []
      if (waEnabled && groupTargets.length > 0) {
        triggerResults.push(
          await sendAutomaticGroupNotifications({
            whatsappApi,
            notifications: waNotifsForNucleo,
            trigger: 'actividade_actualizada',
            nucleo,
            actividade: savedActivity,
          }),
        )

        if (String(savedActivity.estado || '') === 'confirmada') {
          triggerResults.push(
            await sendAutomaticGroupNotifications({
              whatsappApi,
              notifications: waNotifsForNucleo,
              trigger: 'apos_confirmacao',
              nucleo,
              actividade: savedActivity,
            }),
          )
        }
      }

      const autoSent = triggerResults.reduce((sum, item) => sum + Number(item?.sent || 0), 0)
      const autoFailed = triggerResults.flatMap((item) => item?.failed || [])

      if (autoSent > 0 || autoFailed.length > 0) {
        addLog('whatsapp_auto', 'Notificacoes automaticas da atividade processadas.', {
          actividadeId: activity.id,
          sent: autoSent,
          failed: autoFailed.length,
          triggers: triggerResults.map((item) => item.trigger),
        })
      }

      if (autoFailed.length > 0) {
        setError(autoFailed[0]?.error || 'Falha ao enviar notificacoes automaticas.')
        toast.error(`${autoFailed.length} envio(s) de notificação falharam.`)
      }
      if (autoSent > 0) {
        setNotice(`Alteracoes guardadas. ${autoSent} notificacao(oes) automaticas enviadas.`)
        toast.success(`${autoSent} notificação(ões) enviadas ao grupo.`)
        return
      }
      setNotice('Alteracoes guardadas.')
      toast.success('Alterações guardadas.')
    } finally {
      setSaving(false)
    }
  }

  const openCalendar = () => {
    setIcsOpen(true)
    addLog('calendar', 'Evento preparado para exportação (.ics).', { actividadeId: activity.id })
  }

  const openWhatsApp = () => {
    const msg = `Olá! Lembrete: ${current.titulo || 'Encontro Semanal'}${nucleo?.nome ? ` (${nucleo.nome})` : ''} em ${
      current.data || '—'
    }${current.horaInicio ? ` às ${current.horaInicio}` : ''}${current.local ? ` no(a) ${current.local}` : ''}.`
    setWaMessage(msg)
    setWaSelected(contacts.map((c) => c.id))
    setWaToGroup(groupTargets.length > 0 && waEnabled)
    setWaOpen(true)
  }

  const sendWhatsApp = async () => {
    setError('')
    const selected = contacts.filter((c) => waSelected.includes(c.id))
    setSendingWa(true)
    try {
      await Promise.all(
        selected.map((c) =>
          whatsappApi.sendDirectMessage({
            phoneNumber: String(c.contacto || '').trim(),
            message: waMessage,
          }),
        ),
      )
      if (waToGroup && waEnabled && groupTargets.length > 0) {
        await Promise.all(groupTargets.map((group) => whatsappApi.sendGroupMessage({ groupJid: group.groupId, message: waMessage })))
      }
      addLog('whatsapp', 'Lembrete WhatsApp enviado.', {
        actividadeId: activity.id,
        destinatarios: selected.map((c) => ({ nome: c.nome, contacto: c.contacto })),
        toGroup: waToGroup && waEnabled && groupTargets.length > 0,
        groupIds: waToGroup ? groupTargets.map((group) => group.groupId) : [],
        groupNames: waToGroup ? groupTargets.map((group) => group.groupName || group.groupId) : [],
      })
      setWaOpen(false)
      const summary = `Lembrete enviado para ${selected.length} destinatários${waToGroup && waEnabled && groupTargets.length > 0 ? ` + ${groupTargets.length} grupo(s)` : ''}.`
      setNotice(summary)
      toast.success(summary)
    } catch (err) {
      setError(err.message || 'Falha ao enviar lembrete WhatsApp.')
      toast.error(err.message || 'Falha ao enviar lembrete WhatsApp.')
    } finally {
      setSendingWa(false)
    }
  }

  const openContribution = () => {
    setContribDraft({ ...emptyContribution(), data: current.data || toIsoDate(new Date()) })
    setContribOpen(true)
  }

  const saveContribution = async () => {
    if (!normalizeValue(contribDraft.valor)) return
    const id2 = await upsertContribuicao({
      ...contribDraft,
      nucleoId: activity.nucleoId,
      actividadeId: activity.id,
      valor: Number(contribDraft.valor ?? 0),
    })
    if (!id2) return
    setContribOpen(false)
    setReceiptId(id2)
    setReceiptOpen(true)
  }

  const onUploadImages = async (files) => {
    const list = Array.from(files || [])
    for (const f of list) {
      const dataUrl = await fileToDataUrl(f)
      await addImagemActividade({
        actividadeId: activity.id,
        descricao: '',
        ficheiro: { nomeFicheiro: f.name, mime: f.type, tamanho: f.size, urlLocal: dataUrl, dataUpload: new Date().toISOString() },
      })
    }
  }

  const onUploadComprovativo = async (file) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setContribDraft((d) => ({
      ...d,
      comprovativo: {
        nomeFicheiro: file.name,
        mime: file.type,
        tamanho: file.size,
        dataUpload: new Date().toISOString(),
        urlLocal: dataUrl,
      },
      comprovado: true,
    }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-gray-900">{current.titulo || 'Encontro Semanal'}</div>
              <Badge tone={estadoTone(current.estado || 'planeada')}>{current.estado || 'planeada'}</Badge>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {nucleo?.nome || '—'} • {current.data || '—'}
              {current.horaInicio ? ` • ${current.horaInicio}` : ''}
              {current.horaFim ? `–${current.horaFim}` : ''}
              {current.local ? ` • ${current.local}` : ''}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/actividades">
              <Button>Voltar</Button>
            </Link>
            <Button onClick={openCalendar}>Exportar Calendar</Button>
            <Button onClick={openWhatsApp} disabled={contacts.length === 0}>
              Enviar WhatsApp
            </Button>
            <Button onClick={() => setDraft((d) => ({ ...(d || activity), estado: 'realizada' }))}>Marcar Realizada</Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Guardar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteActividade(activity.id)
                navigate('/actividades')
              }}
            >
              Remover
            </Button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>
        ) : null}

        {waEnabled && groupTargets.length > 0 && waNotifsForNucleo.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-sm text-emerald-900">
            <div className="flex flex-wrap items-start gap-2">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5A8.5 8.5 0 116.2 4.4" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 20l-1.5 3 3-1.2" /></svg>
              <div className="min-w-0">
                <div className="font-semibold">Funis de notificação activos</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {waNotifsForNucleo.filter((n) => n?.enabled !== false).map((n, i) => (
                    <Badge key={`${n.id || i}`} tone="green">{n.nome || 'Mensagem'} · {labelForWhatsappTrigger(n.trigger || 'manual')}</Badge>
                  ))}
                </div>
                <div className="mt-1 text-xs text-emerald-800">
                  Ao guardar alterações, são enviadas as mensagens do funil <b>Quando a actividade é alterada</b>
                  {String(current.estado || '') === 'confirmada' ? ' e do funil de confirmação' : ''}.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="text-sm font-semibold text-gray-900">Detalhes</div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <div className="text-xs font-medium text-gray-600">Título</div>
              <input
                value={current.titulo || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), titulo: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Data</div>
              <input type="date"
                value={current.data || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), data: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Estado</div>
              <select
                value={current.estado || 'planeada'}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), estado: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              >
                <option value="planeada">Planeada</option>
                <option value="confirmada">Confirmada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Hora início</div>
              <input type="time"
                value={current.horaInicio || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), horaInicio: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Hora fim</div>
              <input type="time"
                value={current.horaFim || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), horaFim: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs font-medium text-gray-600">Local</div>
              <input
                value={current.local || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), local: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs font-medium text-gray-600">Agenda</div>
              <textarea
                value={current.agenda || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), agenda: e.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs font-medium text-gray-600">Notas</div>
              <textarea
                value={current.notas || ''}
                onChange={(e) => setDraft((d) => ({ ...(d || activity), notas: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="text-sm font-semibold text-gray-900">Contribuições ligadas</div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Badge tone="gray">{contribs.length} registos</Badge>
            <Button variant="primary" onClick={openContribution}>
              Registar contribuição
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {contribs.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {c.pagador || '—'} • {c.valor} {c.moeda || 'MZN'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {c.data || '—'} • {c.tipo} • {c.metodo}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    onClick={() => {
                      setReceiptId(c.id)
                      setReceiptOpen(true)
                    }}
                  >
                    Recibo
                  </Button>
                  <Button variant="danger" onClick={() => deleteContribuicao(c.id)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
            {contribs.length === 0 ? <div className="py-6 text-sm text-gray-500">Sem contribuições ligadas.</div> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-gray-900">Galeria</div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <span>Upload</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onUploadImages(e.target.files)} />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {imgs.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-900/5">
              {img.ficheiro?.urlLocal ? (
                <img src={img.ficheiro.urlLocal} alt={img.descricao || 'Imagem'} className="h-32 w-full object-cover" />
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-gray-500">Sem preview</div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/50 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                <span className="truncate">{img.ficheiro?.nomeFicheiro || 'imagem'}</span>
                <button type="button" className="rounded px-2 py-1 hover:bg-white/10" onClick={() => deleteImagemActividade(img.id)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
          {imgs.length === 0 ? <div className="col-span-full py-10 text-center text-sm text-gray-500">Sem imagens ainda.</div> : null}
        </div>
      </div>

      <Modal
        open={icsOpen}
        title="Exportar para Google Calendar (simulação)"
        onClose={() => setIcsOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIcsOpen(false)}>Fechar</Button>
            <a
              href={icsHref}
              download={`${normalizeValue(current.titulo) || 'evento'}.ics`}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Download .ics
            </a>
          </div>
        }
      >
        <div className="text-sm text-gray-700">Sem OAuth/back-end; este payload (.ics) simula a integração.</div>
        <textarea readOnly value={icsPayload || 'Informe data/hora para gerar o evento.'} rows={14} className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 font-mono text-xs shadow-sm" />
      </Modal>

      <Modal
        open={waOpen}
        title="Enviar lembrete WhatsApp"
        onClose={() => setWaOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setWaOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={sendWhatsApp}
              loading={sendingWa}
              disabled={waSelected.length === 0 && !(waToGroup && waEnabled && groupTargets.length > 0)}
            >
              Enviar
            </Button>
          </div>
        }
      >
        {!waEnabled ? (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            A API de WhatsApp não está configurada. Solicite à secretaria para configurar em Integrações → WhatsApp.
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={waToGroup}
              onChange={(e) => setWaToGroup(e.target.checked)}
              disabled={!waEnabled || groupTargets.length === 0}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-50"
            />
            <div className="min-w-0">
              <div className="font-medium text-gray-900">Enviar para grupos do núcleo</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {groupTargets.length > 0
                  ? `${groupTargets.length} grupo(s): ${groupTargets.map((group) => group.groupName || group.groupId).join(', ')}`
                  : 'Sem Group ID configurado no núcleo (use a aba WhatsApp no detalhe do núcleo).'}
              </div>
            </div>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">Mensagem</div>
            <textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              rows={8}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
            <div className="mt-2 text-xs text-gray-500">Pode editar o template antes de “enviar”.</div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-900">Destinatários</div>
              <Badge tone="gray">{waSelected.length} selecionados</Badge>
            </div>
            <div className="mt-2 space-y-2">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={waSelected.includes(c.id)}
                    onChange={(e) =>
                      setWaSelected((prev) => (e.target.checked ? Array.from(new Set([...prev, c.id])) : prev.filter((x) => x !== c.id)))
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{c.nome}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {c.contacto}
                      {c.cargo ? ` • ${c.cargo}` : ''}
                    </div>
                  </div>
                </label>
              ))}
              {contacts.length === 0 ? <div className="py-6 text-sm text-gray-500">Sem contactos (adicione em Cargos).</div> : null}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={contribOpen}
        title="Registar contribuição"
        onClose={() => setContribOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setContribOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveContribution} disabled={!normalizeValue(contribDraft.valor)}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Tipo</div>
            <select
              value={contribDraft.tipo}
              onChange={(e) => setContribDraft((d) => ({ ...d, tipo: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="cota">Cota</option>
              <option value="contribuicao">Contribuição</option>
              <option value="doacao">Doação</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Método</div>
            <select
              value={contribDraft.metodo}
              onChange={(e) => setContribDraft((d) => ({ ...d, metodo: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="numerario">Numerário</option>
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Valor</div>
            <input
              value={contribDraft.valor}
              onChange={(e) => setContribDraft((d) => ({ ...d, valor: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Moeda</div>
            <input
              value={contribDraft.moeda}
              onChange={(e) => setContribDraft((d) => ({ ...d, moeda: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Data</div>
            <input
              value={contribDraft.data}
              onChange={(e) => setContribDraft((d) => ({ ...d, data: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Pagador</div>
            <input
              value={contribDraft.pagador}
              onChange={(e) => setContribDraft((d) => ({ ...d, pagador: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Descrição</div>
            <textarea
              value={contribDraft.descricao}
              onChange={(e) => setContribDraft((d) => ({ ...d, descricao: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={contribDraft.quitado}
              onChange={(e) => setContribDraft((d) => ({ ...d, quitado: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
            Quitado
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={contribDraft.comprovado}
              onChange={(e) => setContribDraft((d) => ({ ...d, comprovado: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
            Comprovado
          </label>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Comprovativo (upload)</div>
            <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
              <div className="min-w-0">
                <div className="font-medium">{contribDraft.comprovativo?.nomeFicheiro || 'Selecionar ficheiro'}</div>
                <div className="mt-0.5 truncate text-xs text-gray-500">
                  {contribDraft.comprovativo ? 'Guardado em localStorage (simulado).' : 'PDF, imagem, etc.'}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold ring-1 ring-inset ring-gray-200">
                Upload
              </span>
              <input type="file" className="hidden" onChange={(e) => onUploadComprovativo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={receiptOpen}
        title="Recibo (simulação)"
        onClose={() => setReceiptOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setReceiptOpen(false)}>Fechar</Button>
          </div>
        }
      >
        {receipt ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm font-semibold text-gray-900">Recibo</div>
            <div className="mt-2 text-sm text-gray-700">
              <div>
                <span className="text-gray-500">Núcleo:</span> {nucleo?.nome || '—'}
              </div>
              <div>
                <span className="text-gray-500">Atividade:</span> {current.titulo || '—'}
              </div>
              <div>
                <span className="text-gray-500">Data:</span> {receipt.data || '—'}
              </div>
              <div>
                <span className="text-gray-500">Pagador:</span> {receipt.pagador || '—'}
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {receipt.valor} {receipt.moeda || 'MZN'}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Tipo: {receipt.tipo} • Método: {receipt.metodo} • Quitado: {receipt.quitado ? 'sim' : 'não'}
              </div>
            </div>
            {receipt.descricao ? <div className="mt-4 text-sm text-gray-700">{receipt.descricao}</div> : null}
            {receipt.comprovativo?.urlLocal ? (
              <div className="mt-4">
                <a
                  href={receipt.comprovativo.urlLocal}
                  download={receipt.comprovativo.nomeFicheiro || 'comprovativo'}
                  className="text-sm font-medium text-indigo-700 hover:underline"
                >
                  Download comprovativo
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Recibo não encontrado.</div>
        )}
      </Modal>
    </div>
  )
}
