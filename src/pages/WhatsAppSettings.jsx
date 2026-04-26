import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Spinner, InlineSpinner } from '../components/ui/Spinner.jsx'
import { ProgressBar, Stepper } from '../components/ui/Progress.jsx'
import { SkeletonList } from '../components/ui/Skeleton.jsx'
import { useToast } from '../components/ui/useToast.js'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { createWhatsappApi, pickArray, pickObject } from '../lib/api/whatsapp.js'
import {
  hasVisibleQr,
  qrAsciiOf,
  qrSrcOf,
  qrTextOf,
  shouldAutoEnsureWhatsappSession,
  sessionLabel,
  sessionTone,
  shouldPollWhatsappSession,
  unwrapWhatsappData,
  WHATSAPP_SESSION_POLL_MS,
} from '../lib/whatsappSession.js'

const WIZARD_STEPS = ['Ligar o WhatsApp', 'Escolher grupos', 'Mensagens automáticas']

function SectionCard({ title, description, right, children, tone = 'default' }) {
  const tones = {
    default: 'border-gray-200 bg-white',
    emerald: 'border-emerald-200 bg-emerald-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    rose: 'border-rose-200 bg-rose-50/40',
  }
  return (
    <div className={['rounded-2xl border p-5 shadow-sm transition-colors', tones[tone] || tones.default].join(' ')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {description ? <div className="mt-1 text-sm text-gray-600">{description}</div> : null}
        </div>
        {right ? <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}

function StatusPill({ session }) {
  const tone = sessionTone(session)
  const label = sessionLabel(session)
  return (
    <span className={[
      'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
      tone === 'green' ? 'bg-emerald-100 text-emerald-800' : tone === 'yellow' ? 'bg-amber-100 text-amber-800' : tone === 'red' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-700',
    ].join(' ')}>
      <span className={['inline-block h-2 w-2 rounded-full', tone === 'green' ? 'bg-emerald-500 animate-pulse' : tone === 'yellow' ? 'bg-amber-500 animate-pulse' : tone === 'red' ? 'bg-rose-500' : 'bg-gray-400'].join(' ')} />
      {label}
    </span>
  )
}

function ConnectionProgress({ session, connected }) {
  const data = unwrapWhatsappData(session)
  if (connected) return <ProgressBar value={100} tone="emerald" label="Ligação pronta" />
  if (data?.qrAvailable) return <ProgressBar value={60} tone="amber" label="Aguardando leitura do QR" />
  if (shouldPollWhatsappSession(session)) return <ProgressBar indeterminate tone="indigo" label="A preparar ligação" />
  return <ProgressBar value={15} tone="indigo" label="Pronto para iniciar" />
}

function GroupJidHint({ value }) {
  if (!value) return null
  return <div className="mt-1 font-mono text-[10px] text-gray-400 truncate" title={value}>{value}</div>
}

export function WhatsAppSettings() {
  const toast = useToast()
  const { authFetch } = useAuth()
  const { addLog, saveWhatsAppConfig } = useAppData()
  const api = useMemo(() => createWhatsappApi(authFetch), [authFetch])

  const [status, setStatus] = useState(null)
  const [groups, setGroups] = useState([])
  const [templatesText, setTemplatesText] = useState('{}')
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [qrData, setQrData] = useState(null)
  const [qrImageSrc, setQrImageSrc] = useState('')
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [loadingLogout, setLoadingLogout] = useState(false)
  const [loadingPrepare, setLoadingPrepare] = useState(false)
  const [sendBusy, setSendBusy] = useState(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [groupQuery, setGroupQuery] = useState('')

  const [sessionForm, setSessionForm] = useState({ phoneNumber: '', label: '' })
  const [quickMessage, setQuickMessage] = useState({ groupJid: '', message: '' })

  const sessionData = unwrapWhatsappData(status)
  const connected = sessionData?.isConnected === true

  const currentStep = !connected ? 0 : groups.length === 0 ? 1 : 2

  const applySessionSnapshot = (data) => {
    setStatus(data)
    setQrData(data)
  }

  const refreshSessionSnapshot = async ({ silent = false } = {}) => {
    try {
      const data = await api.getSessionSnapshot()
      applySessionSnapshot(data)
      return data
    } catch (err) {
      if (!silent) toast.error(err.message || 'Falha ao actualizar a ligação.')
      return null
    }
  }

  const ensureSession = async ({ silent = false, payload = {} } = {}) => {
    try {
      const data = await api.ensureSession({
        phoneNumber: String(payload.phoneNumber || sessionForm.phoneNumber || '').trim() || undefined,
        label: String(payload.label || sessionForm.label || '').trim() || undefined,
      })
      applySessionSnapshot(data)
      return data
    } catch (err) {
      if (!silent) toast.error(err.message || 'Falha ao preparar a ligação.')
      return null
    }
  }

  const loadAll = async () => {
    setLoading(true)
    const [healthResult, statusResult, registrationsResult, templatesResult, eventsResult] = await Promise.allSettled([
      api.health(),
      api.getSessionSnapshot(),
      api.listRegistrations(),
      api.getTemplates(),
      api.listEvents({ limit: 20 }),
    ])

    if (healthResult.status === 'fulfilled') setHealth(healthResult.value)
    else setHealth(null)

    if (statusResult.status === 'fulfilled') applySessionSnapshot(statusResult.value)
    else { setStatus(null); setQrData(null) }

    if (registrationsResult.status === 'fulfilled') {
      setRegistrations(pickArray(registrationsResult.value, ['registrations', 'data', 'items']))
    }
    if (templatesResult.status === 'fulfilled') {
      setTemplatesText(JSON.stringify(pickObject(templatesResult.value?.templates ?? templatesResult.value, ['templates', 'data']), null, 2))
    }
    if (eventsResult.status === 'fulfilled') setEvents(pickArray(eventsResult.value, ['events', 'data', 'items']))

    const isConnected = unwrapWhatsappData(statusResult.status === 'fulfilled' ? statusResult.value : null)?.isConnected === true
    if (isConnected) {
      try {
        const groupsData = await api.listGroups()
        setGroups(pickArray(groupsData, ['groups', 'data', 'items']))
      } catch {
        setGroups([])
      }
    } else {
      setGroups([])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldAutoEnsureWhatsappSession(status)) return undefined
    const timer = window.setTimeout(() => ensureSession({ silent: true }), 250)
    return () => window.clearTimeout(timer)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shouldPollWhatsappSession(status)) return undefined
    const timer = window.setInterval(() => refreshSessionSnapshot({ silent: true }), WHATSAPP_SESSION_POLL_MS)
    return () => window.clearInterval(timer)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!connected) {
      setGroups([])
      return
    }
    let cancelled = false
    setLoadingGroups(true)
    api
      .listGroups()
      .then((data) => { if (!cancelled) setGroups(pickArray(data, ['groups', 'data', 'items'])) })
      .catch(() => { if (!cancelled) setGroups([]) })
      .finally(() => { if (!cancelled) setLoadingGroups(false) })
    return () => { cancelled = true }
  }, [api, connected])

  useEffect(() => {
    const existingImage = qrSrcOf(qrData)
    if (existingImage) {
      setQrImageSrc(existingImage)
      return
    }
    const qrText = qrTextOf(qrData)
    if (!qrText) {
      setQrImageSrc('')
      return
    }
    let cancelled = false
    QRCode.toDataURL(qrText, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
      .then((src) => { if (!cancelled) setQrImageSrc(src) })
      .catch(() => { if (!cancelled) setQrImageSrc('') })
    return () => { cancelled = true }
  }, [qrData])

  const registerSession = async () => {
    setLoadingPrepare(true)
    const data = await ensureSession()
    if (data) {
      saveWhatsAppConfig({ enabled: true })
      addLog?.('whatsapp_session_register', 'Ligação do WhatsApp preparada.')
      toast.success('Leia o QR no seu WhatsApp para concluir a ligação.')
    }
    setLoadingPrepare(false)
  }

  const refreshQr = async () => {
    setLoadingPrepare(true)
    const data = await ensureSession()
    if (data) toast.info('QR actualizado.')
    setLoadingPrepare(false)
  }

  const logout = async () => {
    if (!window.confirm('Pretende desligar o WhatsApp? Vai precisar de escanear o QR novamente.')) return
    setLoadingLogout(true)
    try {
      await api.logoutSession()
      setGroups([])
      await refreshSessionSnapshot({ silent: true })
      addLog?.('whatsapp_session_logout', 'Sessão do WhatsApp encerrada.')
      toast.info('WhatsApp desligado.')
    } catch (err) {
      toast.error(err.message || 'Falha ao desligar.')
    } finally {
      setLoadingLogout(false)
    }
  }

  const sendQuick = async () => {
    const groupJid = (quickMessage.groupJid || '').trim()
    const message = (quickMessage.message || '').trim()
    if (!groupJid || !message) {
      toast.warning('Escolha um grupo e escreva uma mensagem.')
      return
    }
    setSendBusy(groupJid)
    try {
      await api.sendGroupMessage({ groupJid, message })
      toast.success('Mensagem enviada.')
      setQuickMessage((p) => ({ ...p, message: '' }))
      addLog?.('whatsapp_group_send', 'Mensagem rápida enviada ao grupo.', { groupJid })
    } catch (err) {
      toast.error(err.message || 'Falha ao enviar mensagem.')
    } finally {
      setSendBusy(null)
    }
  }

  const filteredGroups = useMemo(() => {
    const q = String(groupQuery || '').trim().toLowerCase()
    const enriched = groups.map((g) => ({
      groupJid: g.groupJid || g.jid || g.id || '',
      subject: g.subject || g.name || g.groupName || '',
      participants: Array.isArray(g.participants) ? g.participants.length : undefined,
    }))
    if (!q) return enriched
    return enriched.filter((g) => `${g.subject} ${g.groupJid}`.toLowerCase().includes(q))
  }, [groupQuery, groups])

  const qrAscii = qrAsciiOf(qrData)

  return (
    <div className="space-y-5">
      {/* Hero + status */}
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5A8.5 8.5 0 116.2 4.4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 20l-1.5 3 3-1.2" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5c1.5 3.5 3.9 5.9 7.4 7.4" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-gray-900">WhatsApp da Paróquia</div>
              <div className="mt-1 text-sm text-gray-600">
                Ligue o WhatsApp uma vez e envie notificações aos grupos dos núcleos automaticamente quando houver encontros ou mudanças.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill session={status} />
            <Button onClick={loadAll} loading={loading}>Atualizar</Button>
            <Button variant="ghost" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? 'Esconder opções avançadas' : 'Opções avançadas'}
            </Button>
          </div>
        </div>
        <div className="mt-5">
          <Stepper steps={WIZARD_STEPS} current={currentStep} />
        </div>
        <div className="mt-5">
          <ConnectionProgress session={status} connected={connected} />
        </div>
      </div>

      {/* Step 1: ligar */}
      {!connected ? (
        <SectionCard
          title="Passo 1 — Ligar o WhatsApp"
          description="Abra o WhatsApp no telemóvel, entre em Definições → Dispositivos ligados e escaneie o código abaixo."
          tone="amber"
          right={<Button variant="primary" onClick={registerSession} loading={loadingPrepare}>Preparar nova ligação</Button>}
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-xl bg-white p-4 ring-1 ring-gray-200">
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span> Abra o WhatsApp no telemóvel.</li>
                  <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span> Toque no menu ⋮ → <b>Dispositivos ligados</b>.</li>
                  <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">3</span> Escolha <b>Ligar um dispositivo</b> e aponte a câmara ao QR ao lado.</li>
                  <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">✓</span> Quando concluir, esta página liga-se sozinha.</li>
                </ol>
              </div>
              {showAdvanced ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="text-xs font-medium text-gray-500">Identificação (opcional)</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      value={sessionForm.phoneNumber}
                      onChange={(e) => setSessionForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                      placeholder="Número do telemóvel (ex.: 258...)"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={sessionForm.label}
                      onChange={(e) => setSessionForm((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Rótulo (ex.: Paróquia)"
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-500">Estes campos ajudam o servidor a identificar a sessão. Podem ficar vazios.</div>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-white p-5">
              {qrImageSrc ? (
                <>
                  <img src={qrImageSrc} alt="QR WhatsApp" className="h-64 w-64 rounded-xl border border-gray-200 bg-white p-2" />
                  <Button variant="ghost" onClick={refreshQr} className="mt-3" loading={loadingPrepare}>Gerar novo QR</Button>
                </>
              ) : qrAscii ? (
                <pre className="max-h-72 overflow-auto rounded-xl bg-white p-3 font-mono text-[9px] leading-none text-gray-800">{qrAscii}</pre>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-sm text-gray-600">
                  <Spinner size="lg" />
                  {hasVisibleQr(status) ? 'A carregar o QR…' : 'A preparar o emparelhamento…'}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Passo 1 — Ligação activa"
          description="O WhatsApp está conectado. Pode agora configurar onde enviar as notificações."
          tone="emerald"
          right={<Button variant="danger" onClick={logout} loading={loadingLogout}>Desligar</Button>}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-900">
            <Badge tone="green">Ligado</Badge>
            {sessionData?.updatedAt ? <span className="text-xs text-emerald-700">Atualizado {sessionData.updatedAt}</span> : null}
            {health?.status ? <span className="text-xs text-emerald-700">• servidor: {health.status}</span> : null}
          </div>
        </SectionCard>
      )}

      {/* Step 2: escolher grupos */}
      {connected ? (
        <SectionCard
          title="Passo 2 — Grupos disponíveis"
          description="Esta é a lista de grupos onde este WhatsApp participa. Abra um Núcleo para vincular o grupo certo e receber envios automáticos."
          right={
            <>
              <input
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                placeholder="Pesquisar grupo..."
                className="w-52 rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
              <Button onClick={() => {
                setLoadingGroups(true)
                api
                  .listGroups()
                  .then((data) => {
                    setGroups(pickArray(data, ['groups', 'data', 'items']))
                    toast.success('Grupos atualizados.')
                  })
                  .catch((err) => toast.error(err.message || 'Falha ao carregar grupos.'))
                  .finally(() => setLoadingGroups(false))
              }} loading={loadingGroups}>Recarregar</Button>
            </>
          }
        >
          {loadingGroups ? (
            <SkeletonList rows={4} />
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">
              Sem grupos para mostrar. Adicione este WhatsApp a um grupo e toque em <b>Recarregar</b>.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredGroups.map((g, i) => (
                <div key={`${g.groupJid}:${i}`} className="rounded-2xl border border-gray-200 bg-white p-4 card-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{g.subject || 'Grupo sem nome'}</div>
                      {typeof g.participants === 'number' ? (
                        <div className="mt-1 text-xs text-gray-500">{g.participants} participantes</div>
                      ) : null}
                      <GroupJidHint value={g.groupJid} />
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setQuickMessage({ groupJid: g.groupJid, message: quickMessage.message })}
                    >Mensagem rápida</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      {/* Step 3: enviar mensagem rápida de teste */}
      {connected ? (
        <SectionCard
          title="Passo 3 — Testar envio"
          description="Envie uma mensagem de teste para garantir que o grupo recebe as notificações. Depois configure as mensagens automáticas no núcleo."
          tone="default"
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Grupo destino</label>
              <select
                value={quickMessage.groupJid}
                onChange={(e) => setQuickMessage((p) => ({ ...p, groupJid: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Escolher grupo…</option>
                {filteredGroups.map((g, i) => (
                  <option key={`${g.groupJid}:${i}`} value={g.groupJid}>{g.subject || g.groupJid}</option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Mensagem</label>
              <textarea
                value={quickMessage.message}
                onChange={(e) => setQuickMessage((p) => ({ ...p, message: e.target.value }))}
                rows={3}
                placeholder="Paz e bem! Esta é uma mensagem de teste do sistema paroquial."
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              onClick={sendQuick}
              loading={Boolean(sendBusy)}
              disabled={!quickMessage.groupJid || !quickMessage.message.trim()}
            >
              Enviar agora
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {/* Links / guias */}
      {connected ? (
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50/50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-indigo-900">Próximo passo</div>
              <div className="mt-1 text-sm text-indigo-900/80">
                Abra um <b>Núcleo</b> e no separador <b>WhatsApp</b> escolha o grupo deste núcleo. A partir daí cria os "funis" de mensagens
                (convite, lembrete 24h antes, mudança de local, etc.) que são enviados sozinhos.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Advanced sections (registrations, templates, events) */}
      {showAdvanced ? (
        <div className="space-y-5">
          <SectionCard
            title="Números registados"
            description="Números pessoais autorizados a receber notificações diretas (opcional)."
          >
            {registrations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                Sem números registados. Pode ser usado para envios individuais.
              </div>
            ) : (
              <ul className="space-y-2">
                {registrations.map((r, i) => {
                  const phoneNumber = r.phoneNumber || r.number || r.msisdn || ''
                  return (
                    <li key={`${phoneNumber}:${i}`} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.label || phoneNumber || `Registo ${i + 1}`}</div>
                        <div className="text-xs text-gray-500">{phoneNumber}{r.groupJid ? ` • ${r.groupJid}` : ''}</div>
                      </div>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          try {
                            await api.deleteRegistration(phoneNumber)
                            setRegistrations((prev) => prev.filter((item) => (item.phoneNumber || item.number || item.msisdn) !== phoneNumber))
                            toast.info('Registo removido.')
                          } catch (err) {
                            toast.error(err.message || 'Falha ao remover.')
                          }
                        }}
                      >Remover</Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Modelos globais (JSON)"
            description="Templates globais disponíveis para todos os núcleos. Cada núcleo pode também ter os seus próprios."
            right={<Button variant="primary" onClick={async () => {
              let payload
              try { payload = JSON.parse(templatesText) } catch { toast.error('JSON inválido.'); return }
              try {
                await api.updateTemplates(payload)
                toast.success('Modelos guardados.')
              } catch (err) {
                toast.error(err.message || 'Falha ao guardar.')
              }
            }}>Guardar</Button>}
          >
            <textarea
              value={templatesText}
              onChange={(e) => setTemplatesText(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs"
            />
          </SectionCard>

          <SectionCard title="Últimos eventos" description="Histórico recente de eventos recebidos pelo gateway." right={<Button onClick={async () => {
            try {
              const data = await api.listEvents({ limit: 20 })
              setEvents(pickArray(data, ['events', 'data', 'items']))
            } catch (err) { toast.error(err.message || 'Falha.') }
          }}>Recarregar</Button>}>
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">Sem eventos recentes.</div>
            ) : (
              <ul className="space-y-2">
                {events.slice(0, 10).map((e, i) => (
                  <li key={`${e.eventId || e.id || i}`} className="flex items-start justify-between rounded-xl bg-gray-50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{e.eventName || e.name || e.title || `Evento ${i + 1}`}</div>
                      <div className="text-xs text-gray-500 truncate">{e.groupJid || e.eventId || ''}</div>
                    </div>
                    <Badge tone="gray">{String(e.status || '—')}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}

      {loading ? (
        <div className="fixed bottom-6 right-6 z-40">
          <InlineSpinner label="A sincronizar…" className="rounded-xl bg-white px-4 py-2 shadow-lg ring-1 ring-gray-200" />
        </div>
      ) : null}
    </div>
  )
}
