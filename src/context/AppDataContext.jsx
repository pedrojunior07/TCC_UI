import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '../lib/storage/keys.js'
import { useLocalStorageState } from '../lib/storage/useLocalStorageState.js'
import { makeMemberKey } from '../lib/derive/makeMemberKey.js'
import { findMemberByKey, getMemberBackendKey, matchesMemberKey, resolveMemberKey } from '../lib/memberKeys.js'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { normalizeWhatsappGroups } from '../lib/whatsappGroups.js'
import { useAuth } from './AuthContext.jsx'
import { readApiError } from '../lib/api/http.js'

const AppDataContext = createContext(null)

function nowIso() {
  return new Date().toISOString()
}

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/^role_/, '')
    .replace(/[\s-]+/g, '_')
}

function toApiMember(member, options = {}) {
  return {
    ordOriginal: normalizeValue(member?.['Ord.']),
    nomeCompleto: normalizeValue(member?.['Nome Completo']),
    comunidade: normalizeValue(member?.Comunidade),
    dataBaptismo: normalizeValue(member?.['Data de Baptismo']),
    dataNascimento: normalizeValue(member?.['Data de Nascimento']),
    naturalidade: normalizeValue(member?.Naturalidade),
    nomePai: normalizeValue(member?.['Nome do Pai']),
    naturalidadePai: normalizeValue(member?.['Naturalidade do Pai']),
    estadoCivil: normalizeValue(member?.['Estado Civil']),
    profissao: normalizeValue(member?.Profissao),
    nomeMae: normalizeValue(member?.['Nome da Mae']),
    avosPaternos: normalizeValue(member?.['Avos Paternos']),
    avosMaternos: normalizeValue(member?.['Avos Maternos']),
    nomePadrinho: normalizeValue(member?.['Nome do Padrinho']),
    estadoCivilPadrinho: normalizeValue(member?.['Estado Civil.1']),
    profissaoPadrinho: normalizeValue(member?.['Profissao.1']),
    residenciaPadrinho: normalizeValue(member?.Residencia),
    nomeMadrinha: normalizeValue(member?.['Nome da Madrinha']),
    estadoCivilMadrinha: normalizeValue(member?.['Estado Civil da Madrinha']),
    profissaoMadrinha: normalizeValue(member?.['Profisssao da Madrinha']),
    residenciaMadrinha: normalizeValue(member?.['Residencia da Madrinha']),
    dataCrisma: normalizeValue(member?.['Data do Crisma']),
    dataCasamento: normalizeValue(member?.['Data do Casamento']),
    numeroAssento: normalizeValue(member?.['Numero do Assento']),
    observacoes: normalizeValue(member?.Observacoes),
    nucleoId: normalizeValue(options?.nucleoId),
    attachIfExists: Boolean(options?.attachIfExists),
  }
}

function fromApiMember(member) {
  return {
    __memberKey: normalizeValue(member?.memberKey),
    __memberId: normalizeValue(member?.memberId),
    'Ord.': normalizeValue(member?.ordOriginal),
    'Nome Completo': normalizeValue(member?.nomeCompleto),
    Comunidade: normalizeValue(member?.comunidade),
    'Data de Baptismo': normalizeValue(member?.dataBaptismo),
    'Data de Nascimento': normalizeValue(member?.dataNascimento),
    Naturalidade: normalizeValue(member?.naturalidade),
    'Nome do Pai': normalizeValue(member?.nomePai),
    'Naturalidade do Pai': normalizeValue(member?.naturalidadePai),
    'Estado Civil': normalizeValue(member?.estadoCivil),
    Profissao: normalizeValue(member?.profissao),
    'Nome da Mae': normalizeValue(member?.nomeMae),
    'Avos Paternos': normalizeValue(member?.avosPaternos),
    'Avos Maternos': normalizeValue(member?.avosMaternos),
    'Nome do Padrinho': normalizeValue(member?.nomePadrinho),
    'Estado Civil.1': normalizeValue(member?.estadoCivilPadrinho),
    'Profissao.1': normalizeValue(member?.profissaoPadrinho),
    Residencia: normalizeValue(member?.residenciaPadrinho),
    'Nome da Madrinha': normalizeValue(member?.nomeMadrinha),
    'Estado Civil da Madrinha': normalizeValue(member?.estadoCivilMadrinha),
    'Profisssao da Madrinha': normalizeValue(member?.profissaoMadrinha),
    'Residencia da Madrinha': normalizeValue(member?.residenciaMadrinha),
    'Data do Crisma': normalizeValue(member?.dataCrisma),
    'Data do Casamento': normalizeValue(member?.dataCasamento),
    'Numero do Assento': normalizeValue(member?.numeroAssento),
    Observacoes: normalizeValue(member?.observacoes),
  }
}

function makeMemberLooseKey(member) {
  const nome = normalizeForKey(member?.['Nome Completo'])
  const nascimento = normalizeForKey(member?.['Data de Nascimento'])
  return [nome, nascimento].join('|')
}

function upsertMemberInList(list, member) {
  const key = resolveMemberKey(member)
  if (!key) return list
  const index = list.findIndex((entry) => matchesMemberKey(entry, key))
  if (index < 0) return [member, ...list]
  const next = list.slice()
  next[index] = member
  return next
}

function upsertById(list, item, idKey = 'id') {
  const id = String(item?.[idKey] || '')
  if (!id) return list
  const index = list.findIndex((entry) => String(entry?.[idKey] || '') === id)
  if (index < 0) return [item, ...list]
  const next = list.slice()
  next[index] = item
  return next
}

function fromApiNucleo(nucleo) {
  const whatsappGroups = normalizeWhatsappGroups(nucleo?.whatsappGroups)
  return {
    id: normalizeValue(nucleo?.id),
    nome: normalizeValue(nucleo?.nome),
    comunidade: normalizeValue(nucleo?.comunidade),
    descricao: normalizeValue(nucleo?.descricao),
    diaEncontro: normalizeValue(nucleo?.diaEncontro) || 'Quarta-feira',
    horaEncontro: normalizeValue(nucleo?.horaEncontro) || '19:00',
    localEncontro: normalizeValue(nucleo?.localEncontro),
    ativo: nucleo?.ativo !== false,
    memberKeys: Array.isArray(nucleo?.memberKeys) ? nucleo.memberKeys.map((key) => String(key || '').trim()).filter(Boolean) : [],
    chefeUserIds: Array.isArray(nucleo?.chefeUserIds) ? nucleo.chefeUserIds.map((key) => String(key || '').trim()).filter(Boolean) : [],
    whatsappGroups,
    whatsappGroup: whatsappGroups[0] || null,
    createdAt: nucleo?.createdAt || '',
    updatedAt: nucleo?.updatedAt || '',
  }
}

function toApiNucleo(draft) {
  const whatsappGroups = normalizeWhatsappGroups(
    Array.isArray(draft?.whatsappGroups) && draft.whatsappGroups.length > 0 ? draft.whatsappGroups : [draft?.whatsappGroup],
  )
  return {
    nome: normalizeValue(draft?.nome),
    comunidade: normalizeValue(draft?.comunidade),
    descricao: normalizeValue(draft?.descricao),
    diaEncontro: normalizeValue(draft?.diaEncontro) || 'Quarta-feira',
    horaEncontro: normalizeValue(draft?.horaEncontro) || '19:00',
    localEncontro: normalizeValue(draft?.localEncontro),
    ativo: draft?.ativo !== false,
    memberKeys: Array.isArray(draft?.memberKeys) ? Array.from(new Set(draft.memberKeys.map((key) => String(key || '').trim()).filter(Boolean))) : [],
    chefeUserIds: Array.isArray(draft?.chefeUserIds) ? Array.from(new Set(draft.chefeUserIds.map((key) => String(key || '').trim()).filter(Boolean))) : [],
    whatsappGroups,
    whatsappGroup: whatsappGroups[0] || null,
  }
}

function fromApiActivity(activity) {
  return {
    id: normalizeValue(activity?.id),
    nucleoId: normalizeValue(activity?.nucleoId),
    titulo: normalizeValue(activity?.titulo) || 'Encontro Semanal',
    data: normalizeValue(activity?.data),
    horaInicio: normalizeValue(activity?.horaInicio),
    horaFim: normalizeValue(activity?.horaFim),
    local: normalizeValue(activity?.local),
    agenda: normalizeValue(activity?.agenda),
    estado: normalizeValue(activity?.estado) || 'planeada',
    participantesEstimados: activity?.participantesEstimados ?? null,
    participantesPresentes: activity?.participantesPresentes ?? null,
    notas: normalizeValue(activity?.notas),
    createdAt: activity?.createdAt || '',
    updatedAt: activity?.updatedAt || '',
  }
}

function toApiActivity(draft) {
  return {
    nucleoId: String(draft?.nucleoId ?? ''),
    titulo: normalizeValue(draft?.titulo) || 'Encontro Semanal',
    data: normalizeValue(draft?.data),
    horaInicio: normalizeValue(draft?.horaInicio),
    horaFim: normalizeValue(draft?.horaFim),
    local: normalizeValue(draft?.local),
    agenda: normalizeValue(draft?.agenda),
    estado: draft?.estado || 'planeada',
    participantesEstimados: draft?.participantesEstimados == null || draft?.participantesEstimados === '' ? null : Number(draft.participantesEstimados),
    participantesPresentes: draft?.participantesPresentes == null || draft?.participantesPresentes === '' ? null : Number(draft.participantesPresentes),
    notas: normalizeValue(draft?.notas),
  }
}

function fromApiCargo(cargo) {
  return {
    id: normalizeValue(cargo?.id),
    nucleoId: normalizeValue(cargo?.nucleoId),
    cargo: normalizeValue(cargo?.cargo),
    responsavelNome: normalizeValue(cargo?.responsavelNome),
    responsavelContacto: normalizeValue(cargo?.responsavelContacto),
    inicioMandato: normalizeValue(cargo?.inicioMandato),
    fimMandato: normalizeValue(cargo?.fimMandato),
    estado: normalizeValue(cargo?.estado) || 'ativo',
    createdAt: cargo?.createdAt || '',
    updatedAt: cargo?.updatedAt || '',
  }
}

function toApiCargo(draft) {
  return {
    nucleoId: String(draft?.nucleoId ?? ''),
    cargo: normalizeValue(draft?.cargo),
    responsavelNome: normalizeValue(draft?.responsavelNome),
    responsavelContacto: normalizeValue(draft?.responsavelContacto),
    inicioMandato: normalizeValue(draft?.inicioMandato),
    fimMandato: normalizeValue(draft?.fimMandato),
    estado: draft?.estado || 'ativo',
  }
}

function fromApiContribuicao(contribuicao) {
  return {
    id: normalizeValue(contribuicao?.id),
    nucleoId: normalizeValue(contribuicao?.nucleoId),
    actividadeId: normalizeValue(contribuicao?.actividadeId),
    tipo: normalizeValue(contribuicao?.tipo) || 'cota',
    valor: Number(contribuicao?.valor ?? 0) || 0,
    moeda: normalizeValue(contribuicao?.moeda) || 'MZN',
    data: normalizeValue(contribuicao?.data),
    pagador: normalizeValue(contribuicao?.pagador),
    metodo: normalizeValue(contribuicao?.metodo) || 'numerario',
    descricao: normalizeValue(contribuicao?.descricao),
    quitado: Boolean(contribuicao?.quitado ?? true),
    comprovado: Boolean(contribuicao?.comprovado ?? false),
    comprovativo: contribuicao?.comprovativo
      ? {
          nomeFicheiro: normalizeValue(contribuicao.comprovativo.nomeFicheiro),
          mime: normalizeValue(contribuicao.comprovativo.mime),
          tamanho: contribuicao.comprovativo.tamanho ?? null,
          urlLocal: normalizeValue(contribuicao.comprovativo.urlLocal),
          dataUpload: contribuicao.comprovativo.dataUpload || '',
        }
      : null,
    createdAt: contribuicao?.createdAt || '',
    updatedAt: contribuicao?.updatedAt || '',
  }
}

function toApiContribuicao(draft) {
  return {
    nucleoId: String(draft?.nucleoId ?? ''),
    actividadeId: draft?.actividadeId ? String(draft.actividadeId) : '',
    tipo: draft?.tipo || 'cota',
    valor: Number(draft?.valor ?? 0) || 0,
    moeda: normalizeValue(draft?.moeda) || 'MZN',
    data: normalizeValue(draft?.data),
    pagador: normalizeValue(draft?.pagador),
    metodo: draft?.metodo || 'numerario',
    descricao: normalizeValue(draft?.descricao),
    quitado: Boolean(draft?.quitado ?? true),
    comprovado: Boolean(draft?.comprovado ?? false),
    comprovativo: draft?.comprovativo
      ? {
          nomeFicheiro: normalizeValue(draft.comprovativo.nomeFicheiro),
          mime: normalizeValue(draft.comprovativo.mime),
          tamanho: draft.comprovativo.tamanho ?? null,
          urlLocal: normalizeValue(draft.comprovativo.urlLocal),
          dataUpload: draft.comprovativo.dataUpload || '',
        }
      : null,
  }
}

function fromApiImage(image) {
  return {
    id: normalizeValue(image?.id),
    actividadeId: normalizeValue(image?.actividadeId),
    descricao: normalizeValue(image?.descricao),
    ficheiro: image?.ficheiro
      ? {
          nomeFicheiro: normalizeValue(image.ficheiro.nomeFicheiro),
          mime: normalizeValue(image.ficheiro.mime),
          tamanho: image.ficheiro.tamanho ?? null,
          urlLocal: normalizeValue(image.ficheiro.urlLocal),
          dataUpload: image.ficheiro.dataUpload || '',
        }
      : null,
    dataUpload: image?.ficheiro?.dataUpload || '',
  }
}

function toApiImage(draft) {
  return {
    actividadeId: String(draft?.actividadeId ?? ''),
    descricao: normalizeValue(draft?.descricao),
    ficheiro: draft?.ficheiro
      ? {
          nomeFicheiro: normalizeValue(draft.ficheiro.nomeFicheiro),
          mime: normalizeValue(draft.ficheiro.mime),
          tamanho: draft.ficheiro.tamanho ?? null,
          urlLocal: normalizeValue(draft.ficheiro.urlLocal),
          dataUpload: draft.ficheiro.dataUpload || '',
        }
      : null,
  }
}

function fromApiVisita(visita) {
  return {
    id: normalizeValue(visita?.id),
    semanaRef: normalizeValue(visita?.semanaRef),
    familiaId: normalizeValue(visita?.familiaId),
    nucleoId: normalizeValue(visita?.nucleoId),
    estado: normalizeValue(visita?.estado) || 'planeada',
    observacoes: normalizeValue(visita?.observacoes),
    createdAt: visita?.createdAt || '',
    updatedAt: visita?.updatedAt || '',
  }
}

function toApiVisita(draft) {
  return {
    semanaRef: String(draft?.semanaRef ?? ''),
    familiaId: String(draft?.familiaId ?? ''),
    nucleoId: String(draft?.nucleoId ?? ''),
    estado: draft?.estado || 'planeada',
    observacoes: normalizeValue(draft?.observacoes),
  }
}

function fromApiCertificateRequest(request) {
  return {
    id: normalizeValue(request?.id),
    tipo: normalizeValue(request?.tipo) || 'batismo',
    estado: normalizeValue(request?.estado) || 'pendente',
    memberKey: normalizeValue(request?.memberKey),
    nucleoId: normalizeValue(request?.nucleoId),
    observacoes: normalizeValue(request?.observacoes),
    requestedByUserId: normalizeValue(request?.requestedByUserId),
    processedByUserId: normalizeValue(request?.processedByUserId),
    motivoRecusa: normalizeValue(request?.motivoRecusa),
    createdAt: request?.createdAt || '',
    updatedAt: request?.updatedAt || '',
  }
}

function toApiCertificateRequest(draft) {
  return {
    tipo: String(draft?.tipo || 'batismo'),
    estado: String(draft?.estado || 'pendente'),
    memberKey: String(draft?.memberKey || ''),
    nucleoId: String(draft?.nucleoId || ''),
    observacoes: normalizeValue(draft?.observacoes),
  }
}

export function AppDataProvider({ children }) {
  const { currentUser, authFetch } = useAuth()

  const [members, setMembers] = useState([])
  const [families, setFamilies] = useState([])
  const [familyLinks, setFamilyLinks] = useState([])
  const [activity, setActivity] = useLocalStorageState(STORAGE_KEYS.activity, [])
  const [nucleos, setNucleos] = useState([])
  const [actividades, setActividades] = useState([])
  const [cargos, setCargos] = useState([])
  const [contribuicoes, setContribuicoes] = useState([])
  const [imagensActividades, setImagensActividades] = useState([])
  const [visitasFamiliares, setVisitasFamiliares] = useState([])
  const [certificateRequests, setCertificateRequests] = useState([])
  const [whatsappConfig, setWhatsappConfig] = useLocalStorageState(STORAGE_KEYS.whatsappConfig, {
    enabled: false,
    apiBaseUrl: '',
    token: '',
    senderId: '',
    updatedAt: '',
  })
  const [whatsappNotificacoes, setWhatsappNotificacoes] = useLocalStorageState(STORAGE_KEYS.whatsappNotificacoes, [])

  const addLog = useCallback(
    (type, message, meta = {}) => {
      setActivity((prev) => [{ at: nowIso(), type, message, meta }, ...prev].slice(0, 50))
    },
    [setActivity],
  )

  const resetDomainState = useCallback(() => {
    setMembers([])
    setFamilies([])
    setFamilyLinks([])
    setNucleos([])
    setActividades([])
    setCargos([])
    setContribuicoes([])
    setImagensActividades([])
    setVisitasFamiliares([])
    setCertificateRequests([])
  }, [])

  const loadMembers = useCallback(async () => {
    if (!currentUser) {
      setMembers([])
      return
    }

    let page = 0
    const size = 200
    const next = []

    while (true) {
      const response = await authFetch(`/api/members?page=${page}&size=${size}&sortBy=nomeCompleto&sortDir=ASC`)
      if (!response.ok) {
        setMembers([])
        return
      }

      const data = await response.json()
      const content = Array.isArray(data?.content) ? data.content : []
      next.push(...content.map(fromApiMember))
      if (data?.last === true || content.length === 0) break
      page += 1
    }

    setMembers(next)
  }, [authFetch, currentUser])

  const loadDomainData = useCallback(async () => {
    if (!currentUser) {
      resetDomainState()
      return
    }

    const requests = [
      { path: '/api/families', setter: setFamilies, map: (items) => items },
      { path: '/api/family-links', setter: setFamilyLinks, map: (items) => items },
      { path: '/api/nucleos', setter: setNucleos, map: (items) => items.map(fromApiNucleo) },
      { path: '/api/activities', setter: setActividades, map: (items) => items.map(fromApiActivity) },
      { path: '/api/cargos', setter: setCargos, map: (items) => items.map(fromApiCargo) },
      { path: '/api/contribuicoes', setter: setContribuicoes, map: (items) => items.map(fromApiContribuicao) },
      { path: '/api/activity-images', setter: setImagensActividades, map: (items) => items.map(fromApiImage) },
      { path: '/api/visitas-familiares', setter: setVisitasFamiliares, map: (items) => items.map(fromApiVisita) },
      { path: '/api/certificate-requests', setter: setCertificateRequests, map: (items) => items.map(fromApiCertificateRequest) },
    ]

    const results = await Promise.all(
      requests.map(async ({ path, setter, map }) => {
        const response = await authFetch(path)
        if (!response.ok) return { setter, data: [] }
        const data = await response.json()
        return { setter, data: map(Array.isArray(data) ? data : []) }
      }),
    )

    for (const result of results) {
      result.setter(result.data)
    }
  }, [authFetch, currentUser, resetDomainState])

  useEffect(() => {
    if (!currentUser) {
      resetDomainState()
      return
    }

    loadMembers()
    loadDomainData()
  }, [currentUser, loadDomainData, loadMembers, resetDomainState])

  const addMember = useCallback(
    async (member, options = {}) => {
      const response = await authFetch('/api/members', {
        method: 'POST',
        body: JSON.stringify(toApiMember(member, options)),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('membro_add_error', 'Falha ao adicionar membro.', { error })
        return { ok: false, error }
      }

      const created = fromApiMember(await response.json())
      setMembers((prev) => upsertMemberInList(prev, created))
      addLog('membro_add', `Adicionado: ${normalizeValue(created?.['Nome Completo']) || '(sem nome)'}`)
      return { ok: true, member: created, memberKey: resolveMemberKey(created) }
    },
    [addLog, authFetch],
  )

  const updateMemberByKey = useCallback(
    async (oldKey, updated) => {
      const existing = findMemberByKey(members, oldKey)
      const apiKey = getMemberBackendKey(existing) || normalizeValue(oldKey)
      if (!apiKey) return { ok: false, error: 'Membro nao encontrado.' }

      const response = await authFetch(`/api/members/${encodeURIComponent(apiKey)}`, {
        method: 'PUT',
        body: JSON.stringify(toApiMember(updated)),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('membro_update_error', 'Falha ao atualizar membro.', { error, oldKey })
        return { ok: false, error }
      }

      const saved = fromApiMember(await response.json())
      const oldResolvedKey = resolveMemberKey(existing)
      const oldLegacyKey = existing ? makeMemberKey(existing) : normalizeValue(oldKey)
      const newKey = resolveMemberKey(saved)

      setMembers((prev) => upsertMemberInList(prev, saved))

      if (oldResolvedKey !== newKey || oldLegacyKey !== newKey) {
        setFamilyLinks((prev) =>
          prev.map((link) =>
            link.memberKey === oldResolvedKey || link.memberKey === oldLegacyKey ? { ...link, memberKey: newKey } : link,
          ),
        )
        setNucleos((prev) =>
          prev.map((nucleo) => {
            if (!Array.isArray(nucleo.memberKeys)) return nucleo
            const hasMember = nucleo.memberKeys.includes(oldResolvedKey) || nucleo.memberKeys.includes(oldLegacyKey)
            if (!hasMember) return nucleo
            const memberKeys = Array.from(
              new Set(
                nucleo.memberKeys.map((key) => (key === oldResolvedKey || key === oldLegacyKey ? newKey : key)),
              ),
            )
            return { ...nucleo, memberKeys }
          }),
        )
        setCertificateRequests((prev) =>
          prev.map((request) =>
            request.memberKey === oldResolvedKey || request.memberKey === oldLegacyKey ? { ...request, memberKey: newKey } : request,
          ),
        )
      }

      addLog('membro_update', `Atualizado: ${normalizeValue(saved?.['Nome Completo']) || '(sem nome)'}`, { oldKey, newKey })
      return { ok: true }
    },
    [addLog, authFetch, members],
  )

  const removeMemberByKey = useCallback(
    async (memberKey) => {
      const existing = findMemberByKey(members, memberKey)
      const apiKey = getMemberBackendKey(existing) || normalizeValue(memberKey)
      if (!apiKey) return { ok: false, error: 'Membro nao encontrado.' }

      const response = await authFetch(`/api/members/${encodeURIComponent(apiKey)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('membro_remove_error', 'Falha ao remover membro.', { error, memberKey })
        return { ok: false, error }
      }

      const legacyKey = existing ? makeMemberKey(existing) : normalizeValue(memberKey)
      setMembers((prev) => prev.filter((member) => !matchesMemberKey(member, memberKey)))
      setFamilyLinks((prev) => prev.filter((link) => link.memberKey !== apiKey && link.memberKey !== legacyKey))
      setNucleos((prev) =>
        prev.map((nucleo) => ({
          ...nucleo,
          memberKeys: Array.isArray(nucleo.memberKeys)
            ? nucleo.memberKeys.filter((key) => key !== apiKey && key !== legacyKey)
            : [],
        })),
      )
      addLog('membro_remove', 'Membro removido.', { memberKey })
      return { ok: true }
    },
    [addLog, authFetch, members],
  )

  const importMembers = useCallback(
    async ({ rows, strategy, nucleoId = '' }) => {
      const incoming = rows.filter((member) => normalizeValue(member?.['Nome Completo']))
      const incomingByKey = new Map(incoming.map((member) => [makeMemberKey(member), member]))
      const existingByKey = new Map(members.map((member) => [makeMemberKey(member), member]))
      const existingStrongKeyByLooseKey = new Map(
        members.map((member) => [makeMemberLooseKey(member), makeMemberKey(member)]).filter(([key]) => key !== '|'),
      )
      const added = []
      const replaced = []
      const skipped = []
      const failed = []

      for (const [key, member] of incomingByKey.entries()) {
        const matchedKey = existingByKey.has(key) ? key : existingStrongKeyByLooseKey.get(makeMemberLooseKey(member))
        if (!matchedKey) {
          const result = await addMember(member, { nucleoId, attachIfExists: Boolean(nucleoId) })
          if (result?.ok) {
            added.push(key)
            existingByKey.set(makeMemberKey(result.member || member), result.member || member)
            const looseKey = makeMemberLooseKey(result.member || member)
            if (looseKey !== '|') existingStrongKeyByLooseKey.set(looseKey, makeMemberKey(result.member || member))
          } else if (String(result?.error || '').includes('409') || String(result?.error || '').toLowerCase().includes('ja existe')) {
            skipped.push(key)
          } else {
            failed.push({ key, error: result?.error || 'Falha ao importar membro.' })
          }
          continue
        }

        if (strategy === 'replace') {
          const result = await updateMemberByKey(matchedKey, member)
          if (result?.ok) replaced.push(key)
        } else {
          skipped.push(key)
        }
      }

      addLog('import', `Importacao CSV: +${added.length}, ~${replaced.length}, =${skipped.length}`, {
        added: added.length,
        replaced: replaced.length,
        skipped: skipped.length,
        failed: failed.length,
      })
      return { ok: failed.length === 0, added, replaced, skipped, failed }
    },
    [addLog, addMember, members, updateMemberByKey],
  )

  const createFamily = useCallback(
    async ({ nome, residencia = '', observacoes = '', nomeDoPai = '', nomeDaMae = '' }) => {
      const response = await authFetch('/api/families', {
        method: 'POST',
        body: JSON.stringify({
          nome: normalizeValue(nome),
          residencia: normalizeValue(residencia),
          observacoes: normalizeValue(observacoes),
          nomeDoPai: normalizeValue(nomeDoPai),
          nomeDaMae: normalizeValue(nomeDaMae),
        }),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('familia_add_error', 'Falha ao criar familia.', { error })
        return { ok: false, error }
      }

      const family = await response.json()
      setFamilies((prev) => [family, ...prev])
      addLog('familia_add', `Familia criada: ${family.nome || '(sem nome)'}`, { familyId: family.familyId })
      return { ok: true, familyId: family.familyId }
    },
    [addLog, authFetch],
  )

  const deleteFamily = useCallback(
    async (familyId) => {
      const response = await authFetch(`/api/families/${encodeURIComponent(familyId)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('familia_remove_error', 'Falha ao remover familia.', { error, familyId })
        return { ok: false, error }
      }

      setFamilies((prev) => prev.filter((family) => family.familyId !== familyId))
      setFamilyLinks((prev) => prev.filter((link) => link.familyId !== familyId))
      addLog('familia_remove', 'Familia removida.', { familyId })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const linkMemberToFamily = useCallback(
    async ({ familyId, memberKey, relacao = '' }) => {
      const response = await authFetch('/api/family-links', {
        method: 'POST',
        body: JSON.stringify({
          familyId: String(familyId || ''),
          memberKey: String(memberKey || ''),
          relacao: normalizeValue(relacao),
        }),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('familia_link_error', 'Falha ao associar membro a familia.', { error, familyId, memberKey })
        return { ok: false, error }
      }

      const link = await response.json()
      setFamilyLinks((prev) => upsertById(prev, link, 'id'))
      addLog('familia_link', 'Membro associado a uma familia.', { familyId, memberKey })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const unlinkMemberFromFamily = useCallback(
    async ({ familyId, memberKey }) => {
      const response = await authFetch(
        `/api/family-links?familyId=${encodeURIComponent(familyId)}&memberKey=${encodeURIComponent(memberKey)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('familia_unlink_error', 'Falha ao desassociar membro da familia.', { error, familyId, memberKey })
        return { ok: false, error }
      }

      setFamilyLinks((prev) => prev.filter((link) => !(link.familyId === familyId && link.memberKey === memberKey)))
      addLog('familia_unlink', 'Membro desassociado de uma familia.', { familyId, memberKey })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const upsertNucleo = useCallback(
    async (draft) => {
      const payload = toApiNucleo(draft)
      const isUpdate = Boolean(normalizeValue(draft?.id))
      const response = await authFetch(isUpdate ? `/api/nucleos/${encodeURIComponent(draft.id)}` : '/api/nucleos', {
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('nucleo_save_error', 'Falha ao guardar nucleo.', { error, id: draft?.id || '' })
        return { ok: false, error }
      }

      const saved = fromApiNucleo(await response.json())
      setNucleos((prev) => upsertById(prev, saved))
      addLog(isUpdate ? 'nucleo_update' : 'nucleo_add', `${saved.nome || 'Nucleo'}: ${isUpdate ? 'atualizado' : 'criado'}.`, { id: saved.id })
      return { ok: true, id: saved.id }
    },
    [addLog, authFetch],
  )

  const deleteNucleo = useCallback(
    async (id) => {
      const response = await authFetch(`/api/nucleos/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('nucleo_remove_error', 'Falha ao remover nucleo.', { error, id })
        return { ok: false, error }
      }

      setNucleos((prev) => prev.filter((nucleo) => nucleo.id !== id))
      setActividades((prev) => prev.filter((activity) => activity.nucleoId !== id))
      setCargos((prev) => prev.filter((cargo) => cargo.nucleoId !== id))
      setContribuicoes((prev) => prev.filter((contribuicao) => contribuicao.nucleoId !== id))
      setVisitasFamiliares((prev) => prev.filter((visita) => visita.nucleoId !== id))
      addLog('nucleo_remove', 'Nucleo removido.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const upsertActividade = useCallback(
    async (draft) => {
      const isUpdate = Boolean(normalizeValue(draft?.id))
      const response = await authFetch(isUpdate ? `/api/activities/${encodeURIComponent(draft.id)}` : '/api/activities', {
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(toApiActivity(draft)),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('actividade_save_error', 'Falha ao guardar actividade.', { error, id: draft?.id || '' })
        return null
      }

      const saved = fromApiActivity(await response.json())
      setActividades((prev) => upsertById(prev, saved))
      addLog(isUpdate ? 'actividade_update' : 'actividade_add', `${saved.titulo}: ${isUpdate ? 'atualizada' : 'criada'}.`, {
        id: saved.id,
        nucleoId: saved.nucleoId,
      })
      return saved.id
    },
    [addLog, authFetch],
  )

  const deleteActividade = useCallback(
    async (id) => {
      const response = await authFetch(`/api/activities/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('actividade_remove_error', 'Falha ao remover actividade.', { error, id })
        return { ok: false, error }
      }

      setActividades((prev) => prev.filter((activity) => activity.id !== id))
      setImagensActividades((prev) => prev.filter((image) => image.actividadeId !== id))
      setContribuicoes((prev) => prev.filter((contribuicao) => contribuicao.actividadeId !== id))
      addLog('actividade_remove', 'Actividade removida.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const upsertCargo = useCallback(
    async (draft) => {
      const isUpdate = Boolean(normalizeValue(draft?.id))
      const response = await authFetch(isUpdate ? `/api/cargos/${encodeURIComponent(draft.id)}` : '/api/cargos', {
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(toApiCargo(draft)),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('cargo_save_error', 'Falha ao guardar cargo.', { error, id: draft?.id || '' })
        return null
      }

      const saved = fromApiCargo(await response.json())
      setCargos((prev) => upsertById(prev, saved))
      addLog(isUpdate ? 'cargo_update' : 'cargo_add', 'Cargo guardado.', { id: saved.id, nucleoId: saved.nucleoId })
      return saved.id
    },
    [addLog, authFetch],
  )

  const deleteCargo = useCallback(
    async (id) => {
      const response = await authFetch(`/api/cargos/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('cargo_remove_error', 'Falha ao remover cargo.', { error, id })
        return { ok: false, error }
      }

      setCargos((prev) => prev.filter((cargo) => cargo.id !== id))
      addLog('cargo_remove', 'Cargo removido.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const upsertContribuicao = useCallback(
    async (draft) => {
      const isUpdate = Boolean(normalizeValue(draft?.id))
      const response = await authFetch(isUpdate ? `/api/contribuicoes/${encodeURIComponent(draft.id)}` : '/api/contribuicoes', {
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(toApiContribuicao(draft)),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('contrib_save_error', 'Falha ao guardar contribuicao.', { error, id: draft?.id || '' })
        return null
      }

      const saved = fromApiContribuicao(await response.json())
      setContribuicoes((prev) => upsertById(prev, saved))
      addLog(isUpdate ? 'contrib_update' : 'contrib_add', 'Contribuicao guardada.', {
        id: saved.id,
        nucleoId: saved.nucleoId,
        actividadeId: saved.actividadeId,
      })
      return saved.id
    },
    [addLog, authFetch],
  )

  const deleteContribuicao = useCallback(
    async (id) => {
      const response = await authFetch(`/api/contribuicoes/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('contrib_remove_error', 'Falha ao remover contribuicao.', { error, id })
        return { ok: false, error }
      }

      setContribuicoes((prev) => prev.filter((contribuicao) => contribuicao.id !== id))
      addLog('contrib_remove', 'Contribuicao removida.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const addImagemActividade = useCallback(
    async (draft) => {
      const response = await authFetch('/api/activity-images', {
        method: 'POST',
        body: JSON.stringify(toApiImage(draft)),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('galeria_add_error', 'Falha ao adicionar imagem.', { error, actividadeId: draft?.actividadeId || '' })
        return null
      }

      const saved = fromApiImage(await response.json())
      setImagensActividades((prev) => [saved, ...prev])
      addLog('galeria_add', 'Imagem adicionada.', { id: saved.id, actividadeId: saved.actividadeId })
      return saved.id
    },
    [addLog, authFetch],
  )

  const deleteImagemActividade = useCallback(
    async (id) => {
      const response = await authFetch(`/api/activity-images/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('galeria_remove_error', 'Falha ao remover imagem.', { error, id })
        return { ok: false, error }
      }

      setImagensActividades((prev) => prev.filter((image) => image.id !== id))
      addLog('galeria_remove', 'Imagem removida.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const upsertVisitaFamiliar = useCallback(
    async (draft) => {
      const isUpdate = Boolean(normalizeValue(draft?.id))
      const response = await authFetch(
        isUpdate ? `/api/visitas-familiares/${encodeURIComponent(draft.id)}` : '/api/visitas-familiares',
        {
          method: isUpdate ? 'PUT' : 'POST',
          body: JSON.stringify(toApiVisita(draft)),
        },
      )
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('visita_save_error', 'Falha ao guardar visita familiar.', { error, id: draft?.id || '' })
        return { ok: false, error }
      }

      const saved = fromApiVisita(await response.json())
      setVisitasFamiliares((prev) => upsertById(prev, saved))
      addLog(isUpdate ? 'visita_update' : 'visita_add', 'Visita familiar guardada.', {
        id: saved.id,
        nucleoId: saved.nucleoId,
        semanaRef: saved.semanaRef,
      })
      return { ok: true, id: saved.id }
    },
    [addLog, authFetch],
  )

  const deleteVisitaFamiliar = useCallback(
    async (id) => {
      const response = await authFetch(`/api/visitas-familiares/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('visita_remove_error', 'Falha ao remover visita familiar.', { error, id })
        return { ok: false, error }
      }

      setVisitasFamiliares((prev) => prev.filter((visita) => visita.id !== id))
      addLog('visita_remove', 'Visita familiar removida.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const upsertCertificateRequest = useCallback(
    async (draft) => {
      const isUpdate = Boolean(normalizeValue(draft?.id))
      const response = await authFetch(
        isUpdate ? `/api/certificate-requests/${encodeURIComponent(draft.id)}` : '/api/certificate-requests',
        {
          method: isUpdate ? 'PUT' : 'POST',
          body: JSON.stringify(toApiCertificateRequest(draft)),
        },
      )
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('certreq_save_error', 'Falha ao guardar pedido de certificado.', { error, id: draft?.id || '' })
        return null
      }

      const saved = fromApiCertificateRequest(await response.json())
      setCertificateRequests((prev) => upsertById(prev, saved))
      addLog(isUpdate ? 'certreq_update' : 'certreq_add', 'Pedido de certificado guardado.', {
        id: saved.id,
        tipo: saved.tipo,
        estado: saved.estado,
        nucleoId: saved.nucleoId,
        memberKey: saved.memberKey,
      })
      return saved.id
    },
    [addLog, authFetch],
  )

  const setCertificateRequestStatus = useCallback(
    async ({ id, estado, processedByUserId = '', observacoes = '', motivoRecusa = '' }) => {
      const response = await authFetch(`/api/certificate-requests/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          estado: String(estado || ''),
          observacoes: normalizeValue(observacoes),
          motivoRecusa: normalizeValue(motivoRecusa),
        }),
      })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('certreq_status_error', 'Falha ao atualizar estado do pedido.', { error, id, estado })
        return { ok: false, error }
      }

      const saved = fromApiCertificateRequest(await response.json())
      const patched = { ...saved, processedByUserId: saved.processedByUserId || String(processedByUserId || '') }
      setCertificateRequests((prev) => upsertById(prev, patched))
      addLog('certreq_status', 'Estado do pedido atualizado.', { id, estado })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const deleteCertificateRequest = useCallback(
    async (id) => {
      const response = await authFetch(`/api/certificate-requests/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await readApiError(response)
        addLog('certreq_remove_error', 'Falha ao remover pedido de certificado.', { error, id })
        return { ok: false, error }
      }

      setCertificateRequests((prev) => prev.filter((request) => request.id !== id))
      addLog('certreq_remove', 'Pedido de certificado removido.', { id })
      return { ok: true }
    },
    [addLog, authFetch],
  )

  const saveWhatsAppConfig = useCallback(
    (patch) => {
      setWhatsappConfig((prev) => ({ ...prev, ...patch, updatedAt: nowIso() }))
      addLog('whatsapp_cfg', 'Configuracao de WhatsApp guardada.', {})
    },
    [addLog, setWhatsappConfig],
  )

  const upsertWhatsAppNotificacao = useCallback(
    (draft) => {
      const id = draft?.id || `wanotif_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
      const next = {
        id,
        nucleoId: String(draft?.nucleoId || ''),
        nome: normalizeValue(draft?.nome) || 'Notificacao',
        trigger: String(draft?.trigger || 'manual'),
        template: normalizeValue(draft?.template),
        enabled: Boolean(draft?.enabled ?? true),
        updatedAt: nowIso(),
      }
      setWhatsappNotificacoes((prev) => upsertById(prev, next))
      addLog(draft?.id ? 'wanotif_update' : 'wanotif_add', 'Notificacao WhatsApp guardada.', { id, nucleoId: next.nucleoId })
      return id
    },
    [addLog, setWhatsappNotificacoes],
  )

  const deleteWhatsAppNotificacao = useCallback(
    (id) => {
      setWhatsappNotificacoes((prev) => prev.filter((item) => item.id !== id))
      addLog('wanotif_remove', 'Notificacao WhatsApp removida.', { id })
    },
    [addLog, setWhatsappNotificacoes],
  )

  const value = useMemo(
    () => ({
      members,
      families,
      familyLinks,
      activity,
      nucleos,
      actividades,
      cargos,
      contribuicoes,
      imagensActividades,
      visitasFamiliares,
      certificateRequests,
      whatsappConfig,
      whatsappNotificacoes,
      addMember,
      updateMemberByKey,
      removeMemberByKey,
      importMembers,
      createFamily,
      deleteFamily,
      linkMemberToFamily,
      unlinkMemberFromFamily,
      upsertNucleo,
      deleteNucleo,
      upsertActividade,
      deleteActividade,
      upsertCargo,
      deleteCargo,
      upsertContribuicao,
      deleteContribuicao,
      addImagemActividade,
      deleteImagemActividade,
      upsertVisitaFamiliar,
      deleteVisitaFamiliar,
      upsertCertificateRequest,
      setCertificateRequestStatus,
      deleteCertificateRequest,
      saveWhatsAppConfig,
      upsertWhatsAppNotificacao,
      deleteWhatsAppNotificacao,
      addLog,
      reloadAppData: loadDomainData,
      reloadMembers: loadMembers,
    }),
    [
      activity,
      addImagemActividade,
      addLog,
      addMember,
      cargos,
      certificateRequests,
      contribuicoes,
      createFamily,
      deleteActividade,
      deleteCargo,
      deleteCertificateRequest,
      deleteContribuicao,
      deleteFamily,
      deleteImagemActividade,
      deleteNucleo,
      deleteVisitaFamiliar,
      deleteWhatsAppNotificacao,
      families,
      familyLinks,
      imagensActividades,
      importMembers,
      linkMemberToFamily,
      loadDomainData,
      loadMembers,
      members,
      nucleos,
      removeMemberByKey,
      saveWhatsAppConfig,
      setCertificateRequestStatus,
      unlinkMemberFromFamily,
      upsertActividade,
      upsertCargo,
      upsertCertificateRequest,
      upsertContribuicao,
      upsertNucleo,
      upsertVisitaFamiliar,
      upsertWhatsAppNotificacao,
      updateMemberByKey,
      visitasFamiliares,
      whatsappConfig,
      whatsappNotificacoes,
      actividades,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider.')
  return ctx
}
