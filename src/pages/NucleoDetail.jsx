import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { Spinner } from '../components/ui/Spinner.jsx'
import { ProgressBar } from '../components/ui/Progress.jsx'
import { SkeletonList } from '../components/ui/Skeleton.jsx'
import { useToast } from '../components/ui/useToast.js'
import { normalizeValue } from '../lib/normalize.js'
import { parseFlexibleDateTime, toIsoDate } from '../lib/dates.js'
import { makeMemberKey } from '../lib/derive/makeMemberKey.js'
import { canAccessNucleo } from '../lib/nucleoAccess.js'
import { createWhatsappApi, pickArray } from '../lib/api/whatsapp.js'
import { normalizeWhatsappGroup, resolveWhatsappGroupsFromNucleo } from '../lib/whatsappGroups.js'
import {
  buildWhatsAppTemplateMessage,
  labelForWhatsappTrigger,
  WHATSAPP_TRIGGER_OPTIONS,
  WHATSAPP_FUNNEL_PRESETS,
} from '../lib/whatsappNotifications.js'
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

function nextWednesday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0..6 (Sun..Sat)
  const delta = (3 - day + 7) % 7 // 3 is Wed
  const add = delta === 0 ? 7 : delta
  d.setDate(d.getDate() + add)
  return d
}

function tabButton(active) {
  return [
    'rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-inset',
    active ? 'bg-indigo-600 text-white ring-indigo-600/20 shadow-sm' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50',
  ].join(' ')
}

export function NucleoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const {
    nucleos,
    actividades,
    cargos,
    contribuicoes,
    visitasFamiliares,
    families,
    members,
    whatsappConfig,
    whatsappNotificacoes,
    upsertNucleo,
    upsertActividade,
    upsertWhatsAppNotificacao,
    deleteWhatsAppNotificacao,
    deleteNucleo,
    addLog,
  } = useAppData()
  const { currentUser, users, authFetch } = useAuth()
  const toast = useToast()
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const tabParam = params.get('tab')
  const tab = tabParam || (isSuperAdmin ? 'membros' : 'actividades')
  const effectiveTab = isSuperAdmin ? (tab === 'membros' || tab === 'gestores' ? tab : 'membros') : tab

  const nucleo = useMemo(() => nucleos.find((n) => n.id === id) ?? null, [id, nucleos])
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberActionKey, setMemberActionKey] = useState('')
  const [memberActionBusy, setMemberActionBusy] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [gestorError, setGestorError] = useState('')
  const [waNotifOpen, setWaNotifOpen] = useState(false)
  const [waNotifDraft, setWaNotifDraft] = useState(null)
  const [waSendOpen, setWaSendOpen] = useState(false)
  const [waSendPayload, setWaSendPayload] = useState(null)
  const [waSession, setWaSession] = useState(null)
  const [waQrImageSrc, setWaQrImageSrc] = useState('')
  const [waGroups, setWaGroups] = useState([])
  const [, setWaGroupMetadata] = useState(null)
  const [waSelectedGroupId, setWaSelectedGroupId] = useState('')
  const waSessionForm = { phoneNumber: '', label: '' }
  const [waLoadingSession, setWaLoadingSession] = useState(false)
  const [waLoadingGroups, setWaLoadingGroups] = useState(false)
  const setWaError = (msg) => { if (msg) toast.error(msg) }
  const setWaNotice = (msg) => { if (msg) toast.success(msg) }

  const chiefCandidates = useMemo(() => users.filter((u) => u.active !== false && u.role === 'chefe_nucleo'), [users])

  const activitiesForNucleo = useMemo(() => actividades.filter((a) => a.nucleoId === id), [actividades, id])
  const cargosForNucleo = useMemo(() => cargos.filter((c) => c.nucleoId === id), [cargos, id])
  const contribForNucleo = useMemo(() => contribuicoes.filter((c) => c.nucleoId === id), [contribuicoes, id])
  const visitsForNucleo = useMemo(() => visitasFamiliares.filter((v) => v.nucleoId === id), [id, visitasFamiliares])
  const waNotifsForNucleo = useMemo(() => whatsappNotificacoes.filter((n) => n.nucleoId === id), [id, whatsappNotificacoes])
  const whatsappApi = useMemo(() => createWhatsappApi(authFetch), [authFetch])

  const waSavedGroups = useMemo(() => resolveWhatsappGroupsFromNucleo(nucleo), [nucleo])
  const waPrimaryGroup = waSavedGroups[0] || null
  const waEnabled = Boolean(whatsappConfig?.enabled)
  const waSessionData = useMemo(() => unwrapWhatsappData(waSession), [waSession])
  const waConnected = waSessionData?.isConnected === true

  const openEdit = () => {
    if (!nucleo) return
    setDraft({
      id: nucleo.id,
      nome: nucleo.nome ?? '',
      comunidade: nucleo.comunidade ?? '',
      descricao: nucleo.descricao ?? '',
      diaEncontro: nucleo.diaEncontro ?? 'Quarta-feira',
      horaEncontro: nucleo.horaEncontro ?? '19:00',
      localEncontro: nucleo.localEncontro ?? '',
      ativo: nucleo.ativo !== false,
      memberKeys: Array.isArray(nucleo.memberKeys) ? nucleo.memberKeys : [],
      chefeUserIds: Array.isArray(nucleo.chefeUserIds) ? nucleo.chefeUserIds : [],
    })
    setEditOpen(true)
  }

  const save = () => {
    if (!normalizeValue(draft?.nome)) return
    upsertNucleo(draft)
    setEditOpen(false)
  }

  const createWednesdayMeeting = async () => {
    if (!nucleo) return
    const date = toIsoDate(nextWednesday())
    const actId = await upsertActividade({
      nucleoId: nucleo.id,
      titulo: 'Encontro Semanal',
      data: date,
      horaInicio: nucleo.horaEncontro || '19:00',
      local: nucleo.localEncontro || '',
      estado: 'planeada',
    })
    if (!actId) return
    navigate(`/actividades/${encodeURIComponent(actId)}`)
  }

  const memberOptions = useMemo(() => {
    return (members || [])
      .map((m) => ({
        key: normalizeValue(m?.__memberKey) || makeMemberKey(m),
        nome: m?.['Nome Completo'] || '',
        comunidade: m?.Comunidade || '',
      }))
      .filter((x) => x.key && normalizeValue(x.nome))
  }, [members])

  const selectedMemberKeys = useMemo(() => (Array.isArray(nucleo?.memberKeys) ? nucleo.memberKeys : []), [nucleo])
  const selectedMembers = useMemo(() => {
    // map por chave actual (PK do backend)
    const byPk = new Map()
    // map por chave antiga (makeMemberKey com pipes) — fallback para núcleos
    // que foram guardados antes de passarmos a usar a PK do backend.
    const byLegacy = new Map()
    for (const m of (members || [])) {
      const pk = normalizeValue(m?.__memberKey)
      const legacy = makeMemberKey(m)
      const opt = { key: pk || legacy, nome: m?.['Nome Completo'] || '', comunidade: m?.Comunidade || '' }
      if (pk) byPk.set(pk, opt)
      if (legacy) byLegacy.set(legacy, opt)
    }
    return selectedMemberKeys.map(
      (k) => byPk.get(k) || byLegacy.get(k) || { key: k, nome: '(membro)', comunidade: '' },
    )
  }, [members, selectedMemberKeys])

  const filteredMemberOptions = useMemo(() => {
    const q = String(memberQuery || '').trim().toLowerCase()
    if (!q) return memberOptions.slice(0, 50)
    const out = []
    for (const m of memberOptions) {
      const hay = `${m.nome} ${m.comunidade}`.toLowerCase()
      if (!hay.includes(q)) continue
      out.push(m)
      if (out.length >= 50) break
    }
    return out
  }, [memberOptions, memberQuery])

  const saveMemberSelection = async (nextKeys, { successMessage } = {}) => {
    if (!nucleo) return false
    setMemberActionBusy(true)
    try {
      const result = await upsertNucleo({ ...nucleo, memberKeys: nextKeys })
      if (!result?.ok) {
        toast.error(result?.error || 'Falha ao actualizar os membros do nucleo.')
        return false
      }
      if (successMessage) toast.success(successMessage)
      return true
    } finally {
      setMemberActionBusy(false)
    }
  }

  const toggleMemberSelection = async ({ memberKey, memberName, selected }) => {
    if (!memberKey || memberActionBusy) return
    setMemberActionKey(memberKey)
    const nextKeys = selected
      ? Array.from(new Set([...selectedMemberKeys, memberKey]))
      : selectedMemberKeys.filter((key) => key !== memberKey)
    const label = normalizeValue(memberName) || 'Membro'
    await saveMemberSelection(nextKeys, {
      successMessage: selected ? `${label} adicionado ao nucleo.` : `${label} removido do nucleo.`,
    })
    setMemberActionKey('')
  }

  const requestMemberRemoval = (member) => {
    if (!member || memberActionBusy) return
    setMemberToRemove(member)
  }

  const cancelMemberRemoval = () => {
    if (memberActionBusy) return
    setMemberToRemove(null)
  }

  const confirmMemberRemoval = async () => {
    if (!memberToRemove?.key || memberActionBusy) return
    setMemberActionKey(memberToRemove.key)
    const ok = await saveMemberSelection(
      selectedMemberKeys.filter((key) => key !== memberToRemove.key),
      { successMessage: `${normalizeValue(memberToRemove.nome) || 'Membro'} removido do nucleo.` },
    )
    if (ok) setMemberToRemove(null)
    setMemberActionKey('')
  }

  const applyWaSession = (data) => {
    setWaSession(data)
  }

  const refreshWaSession = async ({ silent = false } = {}) => {
    if (!waEnabled) return null
    if (!silent) {
      setWaLoadingSession(true)
      setWaError('')
    }
    try {
      const data = await whatsappApi.getSessionSnapshot()
      applyWaSession(data)
      return data
    } catch (err) {
      if (!silent) setWaError(err.message || 'Falha ao atualizar sessao do WhatsApp.')
      return null
    } finally {
      if (!silent) setWaLoadingSession(false)
    }
  }

  const refreshWaGroups = async ({ silent = false } = {}) => {
    if (!waEnabled) return []
    if (!silent) {
      setWaLoadingGroups(true)
      setWaError('')
    }
    try {
      const data = await whatsappApi.listGroups()
      const nextGroups = pickArray(data, ['groups', 'data', 'items'])
      setWaGroups(nextGroups)
      return nextGroups
    } catch (err) {
      if (!silent) setWaError(err.message || 'Falha ao carregar grupos do WhatsApp.')
      return []
    } finally {
      if (!silent) setWaLoadingGroups(false)
    }
  }

  const refreshWaMetadata = async (groupJid = normalizeValue(waSelectedGroupId || waPrimaryGroup?.groupId), { silent = false } = {}) => {
    if (!normalizeValue(groupJid)) {
      setWaGroupMetadata(null)
      return null
    }

    try {
      const data = await whatsappApi.getGroupMetadata(groupJid)
      setWaGroupMetadata(data)
      return data
    } catch (err) {
      if (!silent) setWaError(err.message || 'Falha ao carregar metadata do grupo.')
      return null
    }
  }

  const persistWaGroups = (nextGroups) => {
    upsertNucleo({
      ...nucleo,
      whatsappGroups: nextGroups,
      whatsappGroup: nextGroups[0] || null,
    })
  }

  const applyWaGroupOption = (group) => {
    const normalized = normalizeWhatsappGroup(group)
    if (!normalizeValue(normalized?.groupId)) return
    const nextGroups = [...waSavedGroups.filter((item) => item.groupId !== normalized.groupId), normalized]
    persistWaGroups(nextGroups)
    setWaSelectedGroupId(normalized.groupId)
    setWaNotice('Grupo adicionado ao nucleo.')
    setWaError('')
  }

  const removeWaGroup = (groupId) => {
    const nextGroups = waSavedGroups.filter((item) => item.groupId !== groupId)
    persistWaGroups(nextGroups)
    if (waSelectedGroupId === groupId) {
      setWaSelectedGroupId(nextGroups[0]?.groupId || '')
      setWaGroupMetadata(null)
    }
    setWaNotice('Grupo removido do nucleo.')
    setWaError('')
  }

  const registerWaSession = async () => {
    const payload = {
      phoneNumber: String(waSessionForm.phoneNumber || '').trim() || undefined,
      label: String(waSessionForm.label || '').trim() || undefined,
    }

    setWaLoadingSession(true)
    setWaError('')
    setWaNotice('')
    try {
      const data = await whatsappApi.ensureSession(payload)
      applyWaSession(data)
      setWaNotice('Sessao preparada. Leia o QR no WhatsApp.')
      addLog('whatsapp_session_register', 'Sessao do WhatsApp preparada no nucleo.', { nucleoId: nucleo.id, ...payload })
    } catch (err) {
      setWaError(err.message || 'Falha ao preparar sessao do WhatsApp.')
    } finally {
      setWaLoadingSession(false)
    }
  }

  const logoutWaSession = async () => {
    setWaLoadingSession(true)
    setWaError('')
    setWaNotice('')
    try {
      await whatsappApi.logoutSession()
      setWaGroups([])
      setWaGroupMetadata(null)
      await refreshWaSession({ silent: true })
      setWaNotice('Sessao do WhatsApp encerrada.')
      addLog('whatsapp_session_logout', 'Sessao do WhatsApp encerrada no nucleo.', { nucleoId: nucleo.id })
    } catch (err) {
      setWaError(err.message || 'Falha ao encerrar sessao do WhatsApp.')
    } finally {
      setWaLoadingSession(false)
    }
  }

  const openNewWaNotif = () => {
    setWaNotifDraft({
      id: '',
      nome: 'Lembrete',
      trigger: 'manual',
      template: 'Paz e bem! Lembrete: {titulo} ({nucleo}) em {data} às {hora}. Local: {local}.',
      enabled: true,
    })
    setWaNotifOpen(true)
  }

  const openEditWaNotif = (n) => {
    setWaNotifDraft({
      id: n.id,
      nome: n.nome || '',
      trigger: n.trigger || 'manual',
      template: n.template || '',
      enabled: n.enabled !== false,
    })
    setWaNotifOpen(true)
  }

  const saveWaNotif = () => {
    if (!waNotifDraft) return
    if (!normalizeValue(waNotifDraft.nome)) return
    upsertWhatsAppNotificacao({ ...waNotifDraft, nucleoId: nucleo.id })
    setWaNotice(`Notificacao guardada (${labelForWhatsappTrigger(waNotifDraft.trigger)}).`)
    setWaNotifOpen(false)
  }

  const canSendToGroup = waEnabled && waSavedGroups.some((group) => normalizeValue(group?.groupId))

  const previewSendToGroup = async ({ nome = 'WhatsApp', template = '' }) => {
    let best = null
    for (const a of activitiesForNucleo) {
      if (String(a.estado || 'planeada') === 'cancelada') continue
      if (String(a.estado || 'planeada') === 'realizada') continue
      const start = parseFlexibleDateTime(a.data, a.horaInicio || nucleo?.horaEncontro)
      if (!start) continue
      const t = start.getTime()
      if (!best || t < best.t) best = { t, a }
    }
    const activityCtx = best ? best.a : null
    const targets = waSavedGroups.filter((group) => normalizeValue(group?.groupId))
    const payload = {
      groups: targets,
      activityId: activityCtx?.id || '',
      message: buildWhatsAppTemplateMessage(template, { nucleo, actividade: activityCtx }),
    }
    try {
      const response = await Promise.all(
        targets.map((group) =>
          whatsappApi.sendGroupMessage({
            groupJid: group.groupId,
            message: payload.message,
          }),
        ),
      )
      setWaSendPayload({ ...payload, response })
      setWaSendOpen(true)
      toast.success(`Mensagem enviada para ${targets.length} grupo(s).`)
      addLog('whatsapp_group', 'Notificacao WhatsApp enviada ao grupo.', {
        nucleoId: nucleo.id,
        groupIds: targets.map((group) => group.groupId),
        nome,
      })
    } catch (err) {
      setWaSendPayload({ ...payload, error: err.message || 'Falha ao enviar mensagem.' })
      setWaSendOpen(true)
      toast.error(err.message || 'Falha ao enviar mensagem.')
    }
  }

  useEffect(() => {
    if (!waEnabled || effectiveTab !== 'whatsapp') return
    refreshWaSession({ silent: true })
  }, [effectiveTab, waEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waEnabled || effectiveTab !== 'whatsapp' || !shouldAutoEnsureWhatsappSession(waSession)) return undefined

    const timer = window.setTimeout(() => {
      whatsappApi
        .ensureSession({
          phoneNumber: String(waSessionForm.phoneNumber || '').trim() || undefined,
          label: String(waSessionForm.label || '').trim() || undefined,
        })
        .then((data) => applyWaSession(data))
        .catch(() => {})
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [effectiveTab, waEnabled, waSession]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waEnabled || effectiveTab !== 'whatsapp' || !shouldPollWhatsappSession(waSession)) return undefined

    const timer = window.setInterval(() => {
      refreshWaSession({ silent: true })
    }, WHATSAPP_SESSION_POLL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [effectiveTab, waEnabled, waSession]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waEnabled || effectiveTab !== 'whatsapp' || !waConnected) {
      setWaGroups([])
      return
    }
    refreshWaGroups({ silent: true })
  }, [effectiveTab, waEnabled, waConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waEnabled || effectiveTab !== 'whatsapp') return
    const groupId = normalizeValue(waSelectedGroupId || waPrimaryGroup?.groupId)
    if (!groupId) {
      setWaGroupMetadata(null)
      return
    }
    refreshWaMetadata(groupId, { silent: true })
  }, [effectiveTab, waEnabled, waSelectedGroupId, waPrimaryGroup?.groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waSelectedGroupId && waSavedGroups.length > 0) {
      setWaSelectedGroupId(waSavedGroups[0].groupId || '')
    }
  }, [waSavedGroups, waSelectedGroupId])

  useEffect(() => {
    const existingImage = qrSrcOf(waSession)
    if (existingImage) {
      setWaQrImageSrc(existingImage)
      return
    }

    const qrText = qrTextOf(waSession)
    if (!qrText) {
      setWaQrImageSrc('')
      return
    }

    let cancelled = false
    QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    })
      .then((src) => {
        if (!cancelled) setWaQrImageSrc(src)
      })
      .catch(() => {
        if (!cancelled) setWaQrImageSrc('')
      })

    return () => {
      cancelled = true
    }
  }, [waSession])

  if (!id) return <Navigate to="/nucleos" replace />
  if (!nucleo) return <Navigate to="/nucleos" replace />
  if (!canAccessNucleo({ currentUser, nucleo })) return <Navigate to="/nucleos" replace />

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-gray-900">{nucleo.nome || '(sem nome)'}</div>
              <Badge tone={nucleo.ativo === false ? 'red' : 'green'}>{nucleo.ativo === false ? 'inativo' : 'ativo'}</Badge>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {nucleo.diaEncontro || 'Quarta-feira'} • {nucleo.horaEncontro || '—'}
              {nucleo.localEncontro ? ` • ${nucleo.localEncontro}` : ''}
            </div>
            {nucleo.comunidade ? <div className="mt-1 text-xs text-gray-500">Comunidade: {nucleo.comunidade}</div> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isSuperAdmin ? (
              <>
                <Button variant="primary" onClick={createWednesdayMeeting}>
                  Criar Encontro de Quarta
                </Button>
                <Link to={`/actividades/nova?nucleoId=${encodeURIComponent(nucleo.id)}`}>
                  <Button>Nova actividade</Button>
                </Link>
              </>
            ) : null}
            <Button onClick={openEdit}>Editar núcleo</Button>
            {isSuperAdmin ? (
              <Button
                variant="danger"
                onClick={() => {
                  deleteNucleo(nucleo.id)
                  navigate('/nucleos')
                }}
              >
                Remover
              </Button>
            ) : null}
          </div>
        </div>

        {nucleo.descricao ? <div className="mt-4 text-sm text-gray-700">{nucleo.descricao}</div> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {!isSuperAdmin ? (
            <button
              type="button"
              className={tabButton(effectiveTab === 'actividades')}
              onClick={() => setParams({ tab: 'actividades' })}
            >
              Actividades <span className="ml-2 text-xs opacity-80">{activitiesForNucleo.length}</span>
            </button>
          ) : null}
          <button
            type="button"
            className={tabButton(effectiveTab === 'membros')}
            onClick={() => setParams({ tab: 'membros' })}
          >
            Membros <span className="ml-2 text-xs opacity-80">{selectedMemberKeys.length}</span>
          </button>
          {isSuperAdmin ? (
            <button
              type="button"
              className={tabButton(effectiveTab === 'gestores')}
              onClick={() => setParams({ tab: 'gestores' })}
            >
              Gestores{' '}
              <span className="ml-2 text-xs opacity-80">{Array.isArray(nucleo.chefeUserIds) ? nucleo.chefeUserIds.length : 0}</span>
            </button>
          ) : null}
          {!isSuperAdmin ? (
            <button type="button" className={tabButton(effectiveTab === 'cargos')} onClick={() => setParams({ tab: 'cargos' })}>
              Cargos <span className="ml-2 text-xs opacity-80">{cargosForNucleo.length}</span>
            </button>
          ) : null}
          {!isSuperAdmin ? (
            <button
              type="button"
              className={tabButton(effectiveTab === 'contribuicoes')}
              onClick={() => setParams({ tab: 'contribuicoes' })}
            >
            Contribuições <span className="ml-2 text-xs opacity-80">{contribForNucleo.length}</span>
            </button>
          ) : null}
          {!isSuperAdmin ? (
            <button
              type="button"
              className={tabButton(effectiveTab === 'visitas')}
              onClick={() => setParams({ tab: 'visitas' })}
            >
              Visitas <span className="ml-2 text-xs opacity-80">{visitsForNucleo.length}</span>
            </button>
          ) : null}
          {!isSuperAdmin ? (
            <button
              type="button"
              className={tabButton(effectiveTab === 'whatsapp')}
              onClick={() => setParams({ tab: 'whatsapp' })}
            >
              WhatsApp <span className="ml-2 text-xs opacity-80">{waNotifsForNucleo.length}</span>
            </button>
          ) : null}
        </div>
      </div>

      {effectiveTab === 'membros' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Membros do núcleo</div>
              <div className="mt-1 text-sm text-gray-600">
                {isSuperAdmin ? 'Defina os membros que podem ser usados neste núcleo.' : 'Membros atribuídos a este núcleo.'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {memberActionBusy ? (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-indigo-700">
                  <Spinner size="sm" />
                  A actualizar membros...
                </div>
              ) : null}
              <Badge tone="gray">{selectedMemberKeys.length} selecionados</Badge>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-3">
                <div className="text-xs font-medium text-gray-600">Pesquisar membros</div>
                <input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Nome, comunidade..."
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>
              <div className="max-h-72 overflow-y-auto p-3">
                <div className="space-y-2">
                  {filteredMemberOptions.map((m, idx) => {
                    const checked = selectedMemberKeys.includes(m.key)
                    return (
                      <label key={`${m.key}:${idx}`} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={memberActionBusy}
                          onChange={(e) => toggleMemberSelection({ memberKey: m.key, memberName: m.nome, selected: e.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{m.nome}</div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">{m.comunidade || 'Sem comunidade'}</div>
                        </div>
                      </label>
                    )
                  })}
                  {memberOptions.length === 0 ? <div className="py-6 text-sm text-gray-500">Sem membros ainda.</div> : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Selecionados</div>
              <div className="mt-3 space-y-2">
                {selectedMembers.map((m, idx) => (
                  <div key={`${m.key}:${idx}`} className="flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-900/5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{m.nome}</div>
                      <div className="mt-0.5 truncate text-xs text-gray-500">{m.comunidade || 'Sem comunidade'}</div>
                    </div>
                    <Button
                      variant="danger"
                      loading={memberActionBusy && memberActionKey === m.key}
                      disabled={memberActionBusy && memberActionKey !== m.key}
                      onClick={() => requestMemberRemoval(m)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                {selectedMembers.length === 0 ? <div className="py-6 text-sm text-gray-500">Nenhum membro selecionado.</div> : null}
              </div>
            </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-indigo-900">
                    Como gestor, só consegue ver os membros deste núcleo. Para adicionar um novo membro, crie-o manualmente.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/membros/importar?nucleoId=${encodeURIComponent(nucleo.id)}`}>
                      <Button>Importar CSV</Button>
                    </Link>
                    <Link to={`/membros/novo?nucleoId=${encodeURIComponent(nucleo.id)}`}>
                      <Button variant="primary">Adicionar membro</Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">Membros</div>
                <div className="mt-3 space-y-2">
                  {selectedMembers.map((m, idx) => (
                    <div key={`${m.key}:${idx}`} className="flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-gray-900/5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{m.nome}</div>
                        <div className="mt-0.5 truncate text-xs text-gray-500">{m.comunidade || 'Sem comunidade'}</div>
                      </div>
                      <Button
                        variant="danger"
                        loading={memberActionBusy && memberActionKey === m.key}
                        disabled={memberActionBusy && memberActionKey !== m.key}
                        onClick={() => requestMemberRemoval(m)}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                  {selectedMembers.length === 0 ? <div className="py-6 text-sm text-gray-500">Nenhum membro selecionado.</div> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {effectiveTab === 'gestores' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Gestores do núcleo</div>
              <div className="mt-1 text-sm text-gray-600">Defina quais gestores podem aceder e gerir este núcleo.</div>
            </div>
            <Badge tone="gray">{Array.isArray(nucleo.chefeUserIds) ? nucleo.chefeUserIds.length : 0} selecionados</Badge>
          </div>

          {gestorError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{gestorError}</div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chiefCandidates.map((u) => {
              const selected = Array.isArray(nucleo.chefeUserIds) ? nucleo.chefeUserIds.includes(u.userId) : false
              return (
                <label key={u.userId} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      setGestorError('')
                      const current = Array.isArray(nucleo.chefeUserIds) ? nucleo.chefeUserIds : []
                      const next = e.target.checked ? Array.from(new Set([...current, u.userId])) : current.filter((id) => id !== u.userId)
                      if (next.length === 0) {
                        setGestorError('Precisa existir pelo menos 1 gestor do núcleo.')
                        return
                      }
                      upsertNucleo({ ...nucleo, chefeUserIds: next })
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
                Sem gestores disponiveis. Crie utilizadores com perfil "Gestor do nucleo" em Utilizadores.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {effectiveTab === 'whatsapp' ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">WhatsApp do núcleo</div>
                <div className="mt-1 text-sm text-gray-600">
                  Ligue este núcleo a um grupo do WhatsApp e crie mensagens automáticas (convite, lembretes, confirmação).
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={sessionTone(waSession)}>{sessionLabel(waSession)}</Badge>
                {!waEnabled ? <Badge tone="yellow">API desligada</Badge> : null}
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                indeterminate={shouldPollWhatsappSession(waSession) && !waConnected}
                value={waConnected ? (waSavedGroups.length ? 100 : 66) : 20}
                tone={waConnected ? 'emerald' : 'indigo'}
                label={
                  !waConnected ? 'Ligue o WhatsApp para começar' :
                  waSavedGroups.length === 0 ? 'Escolha o grupo deste núcleo' :
                  waNotifsForNucleo.length === 0 ? 'Crie as mensagens automáticas' :
                  'Tudo pronto ✨'
                }
              />
            </div>
          </div>

          {!waEnabled ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <div className="font-semibold">A integração ainda não está ligada</div>
              <div className="mt-1">
                Abra <Link to="/integracoes/whatsapp" className="font-medium underline">Integrações → WhatsApp</Link> e
                escaneie o QR para ligar. Volte depois para escolher o grupo deste núcleo.
              </div>
            </div>
          ) : null}

          {/* Conexão + QR quando não estiver ligado */}
          {waEnabled && !waConnected ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl">
                  <div className="text-sm font-semibold text-gray-900">Ligue o WhatsApp para continuar</div>
                  <ol className="mt-3 space-y-2 text-sm text-gray-700">
                    <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span> No telemóvel, abra o WhatsApp.</li>
                    <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">2</span> Vá a <b>Dispositivos ligados → Ligar um dispositivo</b>.</li>
                    <li className="flex gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">3</span> Aponte a câmara ao QR à direita.</li>
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="primary" onClick={registerWaSession} loading={waLoadingSession}>Preparar ligação</Button>
                    <Button onClick={() => refreshWaSession()} loading={waLoadingSession}>Atualizar</Button>
                  </div>
                </div>
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
                  {waQrImageSrc ? (
                    <img src={waQrImageSrc} alt="QR WhatsApp" className="h-56 w-56 rounded-xl border border-white bg-white p-2" />
                  ) : qrAsciiOf(waSession) ? (
                    <pre className="max-h-56 overflow-auto rounded-xl bg-white p-3 font-mono text-[9px] leading-none text-gray-800">{qrAsciiOf(waSession)}</pre>
                  ) : (
                    <div className="flex h-56 w-56 flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-500">
                      <Spinner size="lg" />
                      {hasVisibleQr(waSession) ? 'A gerar o QR…' : 'A preparar…'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Grupo vinculado */}
          {waEnabled && waConnected ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Grupo vinculado</div>
                  <div className="mt-1 text-sm text-gray-600">Escolha entre os grupos onde o WhatsApp ligado participa.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => refreshWaGroups()} loading={waLoadingGroups}>Recarregar grupos</Button>
                  <Button variant="ghost" onClick={logoutWaSession} loading={waLoadingSession}>Desligar</Button>
                </div>
              </div>

              {waPrimaryGroup ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Grupo principal</div>
                      <div className="mt-1 truncate text-base font-semibold text-emerald-900">{waPrimaryGroup.groupName || 'Grupo sem nome'}</div>
                      {waPrimaryGroup.inviteLink ? (
                        <a href={waPrimaryGroup.inviteLink} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-emerald-700 underline">
                          {waPrimaryGroup.inviteLink}
                        </a>
                      ) : null}
                    </div>
                    <Button variant="danger" onClick={() => removeWaGroup(waPrimaryGroup.groupId)}>Desvincular</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  Nenhum grupo vinculado ainda. Escolha um da lista abaixo.
                </div>
              )}

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Grupos disponíveis</div>
                {waLoadingGroups ? (
                  <div className="mt-3"><SkeletonList rows={3} /></div>
                ) : waGroups.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    Sem grupos ainda. Se criou um novo grupo no telemóvel, toque em <b>Recarregar grupos</b>.
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {waGroups.map((group, index) => {
                      const groupId = group.groupJid || group.jid || group.id || ''
                      const groupName = group.subject || group.name || group.groupName || `Grupo ${index + 1}`
                      const isLinked = waPrimaryGroup?.groupId === groupId
                      const count = Array.isArray(group.participants) ? group.participants.length : null
                      return (
                        <button
                          key={`${groupId}:${index}`}
                          type="button"
                          onClick={() => applyWaGroupOption(group)}
                          className={[
                            'flex items-start justify-between gap-3 rounded-xl border p-3 text-left transition card-pop',
                            isLinked ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:border-indigo-300',
                          ].join(' ')}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">{groupName}</div>
                            {count !== null ? <div className="mt-0.5 text-xs text-gray-500">{count} participantes</div> : null}
                          </div>
                          {isLinked ? (
                            <Badge tone="green">Vinculado</Badge>
                          ) : (
                            <span className="text-xs font-semibold text-indigo-700">Usar este</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Funis de notificação */}
          {waEnabled ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Funis de notificação</div>
                  <div className="mt-1 text-sm text-gray-600">
                    Mensagens enviadas automaticamente ao grupo em cada momento do encontro.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={openNewWaNotif}>Nova mensagem</Button>
                </div>
              </div>

              {waNotifsForNucleo.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 p-5">
                  <div className="text-sm font-semibold text-indigo-900">Começar com funis recomendados</div>
                  <div className="mt-1 text-sm text-indigo-900/80">
                    Basta escolher um dos modelos abaixo — pode editar depois.
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {WHATSAPP_FUNNEL_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          upsertWhatsAppNotificacao({
                            nucleoId: nucleo.id,
                            nome: preset.nome,
                            trigger: preset.trigger,
                            template: preset.template,
                            enabled: true,
                          })
                          toast.success(`Funil "${preset.nome}" adicionado.`)
                        }}
                        className="rounded-xl border border-gray-200 bg-white p-3 text-left transition card-pop hover:border-indigo-300"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900">{preset.nome}</div>
                          <Badge tone="blue">{labelForWhatsappTrigger(preset.trigger)}</Badge>
                        </div>
                        <div className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-gray-600">{preset.template}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {waNotifsForNucleo.map((n) => (
                    <div key={n.id} className="rounded-2xl border border-gray-200 bg-white p-4 card-pop">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">{n.nome || 'Mensagem'}</div>
                            <Badge tone={n.enabled !== false ? 'green' : 'gray'}>{n.enabled !== false ? 'ativa' : 'pausada'}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            <span className="font-medium text-gray-700">Quando:</span> {labelForWhatsappTrigger(n.trigger || 'manual')}
                          </div>
                          {n.template ? (
                            <div className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-800">{n.template}</div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              onClick={() => previewSendToGroup({ nome: n.nome, template: n.template })}
                              disabled={!canSendToGroup}
                            >Enviar agora</Button>
                            <Button onClick={() => openEditWaNotif(n)}>Editar</Button>
                            <Button variant="danger" onClick={() => deleteWhatsAppNotificacao(n.id)}>Remover</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 px-3 py-3 text-xs text-indigo-900">
                    <span className="font-semibold">Dica:</span>
                    Pode também adicionar rapidamente um funil recomendado:
                    {WHATSAPP_FUNNEL_PRESETS.filter((p) => !waNotifsForNucleo.some((n) => n.nome === p.nome)).slice(0, 3).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="rounded-full bg-white px-3 py-1 font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-600 hover:text-white"
                        onClick={() => {
                          upsertWhatsAppNotificacao({
                            nucleoId: nucleo.id,
                            nome: preset.nome,
                            trigger: preset.trigger,
                            template: preset.template,
                            enabled: true,
                          })
                          toast.success(`Funil "${preset.nome}" adicionado.`)
                        }}
                      >+ {preset.nome}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {effectiveTab === 'actividades' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Actividades</div>
            <Link to="/actividades">
              <Button>Ver todas</Button>
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activitiesForNucleo.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{a.titulo || 'Encontro Semanal'}</td>
                    <td className="px-4 py-3 text-gray-700">{a.data || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.horaInicio || '—'}
                      {a.horaFim ? `–${a.horaFim}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={a.estado === 'realizada' ? 'green' : a.estado === 'confirmada' ? 'blue' : a.estado === 'cancelada' ? 'red' : 'yellow'}>
                        {a.estado || 'planeada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/actividades/${encodeURIComponent(a.id)}`}>
                        <Button>Detalhe</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {activitiesForNucleo.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      Sem actividades ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {effectiveTab === 'cargos' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Cargos</div>
            <Link to={`/cargos?nucleoId=${encodeURIComponent(nucleo.id)}`}>
              <Button>Gerir</Button>
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Mandato</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargosForNucleo.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.cargo || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.responsavelNome || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.responsavelContacto || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.inicioMandato || '—'}
                      {c.fimMandato ? ` → ${c.fimMandato}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.estado === 'ativo' ? 'green' : 'gray'}>{c.estado || 'ativo'}</Badge>
                    </td>
                  </tr>
                ))}
                {cargosForNucleo.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      Sem cargos atribuídos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {effectiveTab === 'contribuicoes' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Contribuições</div>
            <Link to={`/contribuicoes?nucleoId=${encodeURIComponent(nucleo.id)}`}>
              <Button>Gerir</Button>
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {contribForNucleo.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {c.pagador || '—'} • {c.valor} {c.moeda || 'MZN'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {c.data || '—'} • {c.tipo} • {c.metodo}
                    {c.actividadeId ? ' • ligada a actividade' : ''}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge tone={c.quitado ? 'green' : 'yellow'}>{c.quitado ? 'quitado' : 'pendente'}</Badge>
                  <Badge tone={c.comprovado ? 'blue' : 'gray'}>{c.comprovado ? 'comprovado' : 'sem comprovação'}</Badge>
                </div>
              </div>
            ))}
            {contribForNucleo.length === 0 ? <div className="py-8 text-sm text-gray-500">Sem contribuições ainda.</div> : null}
          </div>
        </div>
      ) : null}

      {effectiveTab === 'visitas' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Visitas familiares</div>
            <Link to={`/visitas-familiares?nucleoId=${encodeURIComponent(nucleo.id)}`}>
              <Button>Plano semanal</Button>
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {visitsForNucleo
              .slice()
              .sort((a, b) => String(b.semanaRef).localeCompare(String(a.semanaRef)))
              .slice(0, 8)
              .map((v) => {
                const fam = families.find((f) => f.familyId === v.familiaId) ?? null
                return (
                  <div key={v.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{fam?.nome || 'Família'}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {v.semanaRef} • {v.estado}
                      </div>
                    </div>
                    <Badge tone={v.estado === 'realizada' ? 'green' : v.estado === 'cancelada' ? 'red' : 'yellow'}>{v.estado}</Badge>
                  </div>
                )
              })}
            {visitsForNucleo.length === 0 ? <div className="py-8 text-sm text-gray-500">Sem visitas registadas.</div> : null}
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(memberToRemove)}
        title="Remover membro do nucleo"
        onClose={cancelMemberRemoval}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={cancelMemberRemoval} disabled={memberActionBusy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmMemberRemoval} loading={memberActionBusy}>
              Confirmar remocao
            </Button>
          </div>
        }
      >
        {memberToRemove ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              Vai remover <span className="font-semibold text-gray-900">{memberToRemove.nome || 'este membro'}</span> deste nucleo.
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              O membro continua registado no sistema. Apenas deixa de estar associado a este nucleo.
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={waNotifOpen}
        title={waNotifDraft?.id ? 'Editar notificação WhatsApp' : 'Nova notificação WhatsApp'}
        onClose={() => {
          setWaNotifOpen(false)
          setWaNotifDraft(null)
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setWaNotifOpen(false)
                setWaNotifDraft(null)
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={saveWaNotif} disabled={!normalizeValue(waNotifDraft?.nome)}>
              Guardar
            </Button>
          </div>
        }
      >
        {waNotifDraft ? (
          <div className="space-y-4">
            {!waNotifDraft.id ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Usar modelo</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WHATSAPP_FUNNEL_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setWaNotifDraft({
                        id: '',
                        nome: preset.nome,
                        trigger: preset.trigger,
                        template: preset.template,
                        enabled: true,
                      })}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-600 hover:text-white"
                    >{preset.nome}</button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <div className="text-xs font-medium text-gray-600">Nome desta mensagem</div>
                <input
                  value={waNotifDraft.nome || ''}
                  onChange={(e) => setWaNotifDraft((d) => ({ ...(d || {}), nome: e.target.value }))}
                  placeholder="Ex.: Convite ao encontro"
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-xs font-medium text-gray-600">Quando enviar</div>
                <select
                  value={waNotifDraft.trigger || 'manual'}
                  onChange={(e) => setWaNotifDraft((d) => ({ ...(d || {}), trigger: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  {WHATSAPP_TRIGGER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-gray-500">
                  {(WHATSAPP_TRIGGER_OPTIONS.find((o) => o.value === (waNotifDraft.trigger || 'manual'))?.hint) || ''}
                </div>
              </label>
              <label className="block sm:col-span-2">
                <div className="text-xs font-medium text-gray-600">Mensagem</div>
                <textarea
                  value={waNotifDraft.template || ''}
                  onChange={(e) => setWaNotifDraft((d) => ({ ...(d || {}), template: e.target.value }))}
                  rows={6}
                  placeholder="Paz e bem! Convidamos para {titulo} em {data} às {hora}. Local: {local}"
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
                <div className="mt-2 text-xs text-gray-500">
                  Pode usar <code className="rounded bg-gray-100 px-1">{'{nucleo}'}</code> <code className="rounded bg-gray-100 px-1">{'{titulo}'}</code> <code className="rounded bg-gray-100 px-1">{'{data}'}</code> <code className="rounded bg-gray-100 px-1">{'{hora}'}</code> <code className="rounded bg-gray-100 px-1">{'{local}'}</code> — serão substituídos pelos dados da actividade.
                </div>
              </label>

              {waNotifDraft.template ? (
                <div className="sm:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pré-visualização</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">
                    {buildWhatsAppTemplateMessage(waNotifDraft.template, {
                      nucleo,
                      actividade: activitiesForNucleo
                        .filter((a) => String(a.estado || 'planeada') !== 'cancelada')
                        .sort((a, b) => {
                          const ta = parseFlexibleDateTime(a.data, a.horaInicio || nucleo?.horaEncontro)?.getTime() ?? 0
                          const tb = parseFlexibleDateTime(b.data, b.horaInicio || nucleo?.horaEncontro)?.getTime() ?? 0
                          return ta - tb
                        })[0] || null,
                    }) || 'Escreva uma mensagem para ver a pré-visualização.'}
                  </div>
                </div>
              ) : null}

              <label className="inline-flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={waNotifDraft.enabled !== false}
                  onChange={(e) => setWaNotifDraft((d) => ({ ...(d || {}), enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                Este funil está activo
              </label>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={waSendOpen}
        title="Envio para o grupo"
        onClose={() => {
          setWaSendOpen(false)
          setWaSendPayload(null)
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setWaSendOpen(false)
                setWaSendPayload(null)
              }}
            >
              Fechar
            </Button>
          </div>
        }
      >
        {waSendPayload ? (
          <div className="space-y-3">
            {waSendPayload.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="font-semibold">Falha ao enviar</div>
                <div className="mt-1">{waSendPayload.error}</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="font-semibold">Mensagem enviada ✓</div>
                <div className="mt-1">Enviada para {(waSendPayload.groups || []).length || 1} grupo(s).</div>
              </div>
            )}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mensagem enviada</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{waSendPayload.message || '(vazio)'}</div>
              {!waSendPayload.activityId ? (
                <div className="mt-2 text-xs text-gray-500">Sem próxima actividade — variáveis podem ficar vazias.</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Sem detalhes.</div>
        )}
      </Modal>

      <Modal
        open={editOpen}
        title="Editar Núcleo"
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save} disabled={!normalizeValue(draft?.nome)}>
              Guardar
            </Button>
          </div>
        }
      >
        {draft ? (
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
              <div className="text-xs font-medium text-gray-600">Comunidade</div>
              <input
                value={draft.comunidade}
                onChange={(e) => setDraft((d) => ({ ...d, comunidade: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-gray-600">Local</div>
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
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-xs font-medium text-gray-600">Descrição</div>
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
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
