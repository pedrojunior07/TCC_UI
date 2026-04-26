import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { deriveSacraments } from '../lib/derive/deriveSacraments.js'
import { findMemberByKey, resolveMemberKey } from '../lib/memberKeys.js'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { readApiError } from '../lib/api/http.js'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input, Select, Textarea } from '../components/ui/Form.jsx'
import { buildCertificatePrefillFromMember } from '../lib/certificates/certificateHtml.js'

function safeStr(value) {
  return String(value ?? '')
}

function parseAssentoRef(value) {
  const raw = String(value || '').trim()
  const m = raw.match(/^(\d+)\s*\/\s*(\d{4})$/)
  if (!m) return null
  return { folha: m[1], ano: m[2] }
}

function parseFilenameFromContentDisposition(value) {
  const input = String(value || '')
  const utf8Match = input.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      // ignore
    }
  }
  const basicMatch = input.match(/filename="?([^";]+)"?/i)
  if (basicMatch?.[1]) return basicMatch[1]
  return ''
}

const CERT_TYPES = [
  { value: 'batismo',   label: 'Certidão de Baptismo' },
  { value: 'crisma',   label: 'Certidão de Crisma' },
  { value: 'casamento', label: 'Certidão de Casamento' },
]

const SEX_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Feminino', label: 'Feminino' },
]

function estadoTone(estado) {
  if (estado === 'emitido') return 'green'
  if (estado === 'aprovado') return 'blue'
  if (estado === 'recusado') return 'red'
  return 'yellow'
}

function sacramentStatusFor({ member, certType }) {
  if (!member) return { tone: 'gray', label: 'Sem membro selecionado' }
  const s = deriveSacraments(member)
  if (certType === 'casamento') {
    return s.casamento ? { tone: 'green', label: 'Casado (com registo)' } : { tone: 'red', label: 'Não casado (sem registo)' }
  }
  if (certType === 'crisma') {
    return s.crisma ? { tone: 'green', label: 'Crismado (com registo)' } : { tone: 'red', label: 'Não crismado (sem registo)' }
  }
  return s.baptismo ? { tone: 'green', label: 'Baptizado (com registo)' } : { tone: 'red', label: 'Não baptizado (sem registo)' }
}

export function Certificates() {
  const { currentUser, authFetch } = useAuth()
  const {
    members,
    nucleos,
    certificateRequests,
    setCertificateRequestStatus,
    deleteCertificateRequest,
    addLog,
  } = useAppData()

  const [tab, setTab] = useState('gerar')

  const [certType, setCertType] = useState('batismo')
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [draft, setDraft] = useState(() => buildCertificatePrefillFromMember({ type: 'batismo', member: null }))
  const [downloadBusy, setDownloadBusy] = useState('')
  const [downloadNotice, setDownloadNotice] = useState('')

  const selectedMember = useMemo(() => {
    if (!selectedKey) return null
    return findMemberByKey(members, selectedKey)
  }, [members, selectedKey])

  const sacramentStatus = useMemo(
    () => sacramentStatusFor({ member: selectedMember, certType }),
    [certType, selectedMember],
  )

  const memberResults = useMemo(() => {
    const q = normalizeForKey(query)
    const slice = members.slice()
    if (!q) return slice.slice(0, 10).map((m) => ({ key: resolveMemberKey(m), member: m }))
    const out = []
    for (const m of slice) {
      const key = resolveMemberKey(m)
      const hay = normalizeForKey(`${m?.['Nome Completo'] ?? ''} ${m?.Comunidade ?? ''} ${m?.['Data de Nascimento'] ?? ''}`)
      if (!hay.includes(q)) continue
      out.push({ key, member: m })
      if (out.length >= 10) break
    }
    return out
  }, [members, query])

  const requests = useMemo(() => {
    return certificateRequests
      .slice()
      .sort((a, b) => safeStr(b.updatedAt || b.createdAt).localeCompare(safeStr(a.updatedAt || a.createdAt)))
  }, [certificateRequests])

  const nucleoById = useMemo(() => new Map(nucleos.map((n) => [n.id, n])), [nucleos])

  const onResetDraft = (nextType) => {
    setCertType(nextType)
    setDraft(buildCertificatePrefillFromMember({ type: nextType, member: selectedMember }))
  }

  const onPrefill = () => {
    setDraft(buildCertificatePrefillFromMember({ type: certType, member: selectedMember }))
  }

  const onDownloadFromBackend = async (format, overrides = {}) => {
    if (downloadBusy) return
    setDownloadBusy(format)
    setDownloadNotice('')
    try {
      const reqType = overrides.type || certType
      const reqData = overrides.data || draft
      const reqMemberKey = overrides.memberKey ?? (selectedKey || '')
      const reqRequestId = overrides.requestId ?? ''

      const response = await authFetch('/api/certificates/generate', {
        method: 'POST',
        body: JSON.stringify({
          type: reqType,
          format,
          data: reqData,
          memberKey: reqMemberKey,
          requestId: reqRequestId,
        }),
      })
      if (!response.ok) throw new Error(await readApiError(response))

      const blob = await response.blob()
      const fallbackName = `certidao_${reqType}_${normalizeForKey(selectedMember?.['Nome Completo'] || '') || 'membro'}${format === 'pdf' ? '.pdf' : '.doc'}`
      const filename =
        parseFilenameFromContentDisposition(response.headers.get('content-disposition')) || fallbackName

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)

      addLog?.(`cert_${format}`, `Certidão descarregada (${format.toUpperCase()}) via backend.`, {
        tipo: reqType,
        memberKey: reqMemberKey,
      })
    } catch (err) {
      addLog?.(`cert_${format}_error`, `Falha ao gerar ${format.toUpperCase()} no backend.`, { tipo: certType })
      setDownloadNotice(err?.message || `Falha ao gerar ${format.toUpperCase()} no backend.`)
    } finally {
      setDownloadBusy('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Certificados</div>
            <div className="mt-1 text-sm text-gray-600">Gerar certidões e processar solicitações da secretaria.</div>
          </div>
          <Badge tone="blue">Baptismo • Crisma • Casamento</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'gerar' ? 'primary' : 'default'} onClick={() => setTab('gerar')}>
          Gerar certidão
        </Button>
        <Button variant={tab === 'solicitacoes' ? 'primary' : 'default'} onClick={() => setTab('solicitacoes')}>
          Solicitações
        </Button>
      </div>

      {tab === 'gerar' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Rascunho</div>
                <div className="mt-1 text-sm text-gray-600">Escolha o tipo, selecione um membro e preencha os campos.</div>
              </div>
              <Badge tone="gray">modelo A4</Badge>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Tipo"
                value={certType}
                onChange={(v) => onResetDraft(v)}
                options={CERT_TYPES}
              />
              <Button className="mt-6" onClick={onPrefill} disabled={!selectedMember}>
                Preencher do membro
              </Button>
            </div>

              <div className="mt-4">
                <div className="text-xs font-medium text-gray-600">Membro (opcional)</div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar por nome, comunidade ou data..."
                  className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
                <div className="mt-2 space-y-1">
                  {memberResults.map(({ key, member }, idx) => {
                    const active = key === selectedKey
                    return (
                      <button
                        key={`${key}:${idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedKey(key)
                          setDraft(buildCertificatePrefillFromMember({ type: certType, member }))
                        }}
                        className={[
                          'w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset',
                          active
                            ? 'bg-indigo-50 text-indigo-900 ring-indigo-200'
                            : 'bg-white text-gray-900 ring-gray-200 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {normalizeValue(member?.['Nome Completo']) || '(sem nome)'}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-gray-500">
                            {normalizeValue(member?.Comunidade) || 'Sem comunidade'} •{' '}
                            {normalizeValue(member?.['Data de Nascimento']) || 'Sem data'}
                          </div>
                        </div>
                        {active ? <Badge tone="blue">selecionado</Badge> : null}
                      </div>
                    </button>
                  )
                })}
              </div>

                {selectedMember ? (
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-gray-600">
                    Selecionado:{' '}
                    <Link
                      to={`/membros/${encodeURIComponent(selectedKey)}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {normalizeValue(selectedMember?.['Nome Completo']) || selectedKey}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={sacramentStatus.tone}>{sacramentStatus.label}</Badge>
                    {certType === 'batismo' && !deriveSacraments(selectedMember).baptismo ? (
                      <Badge tone="gray">Data de Baptismo em falta</Badge>
                    ) : null}
                    {certType === 'crisma' && !deriveSacraments(selectedMember).crisma ? (
                      <Badge tone="gray">Data do Crisma em falta</Badge>
                    ) : null}
                    {certType === 'casamento' && !deriveSacraments(selectedMember).casamento ? (
                      <Badge tone="gray">Data do Casamento em falta</Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => onDownloadFromBackend('pdf')} disabled={Boolean(downloadBusy)}>
                {downloadBusy === 'pdf' ? 'A gerar PDF...' : 'Gerar PDF (Backend)'}
              </Button>
              <Button onClick={() => onDownloadFromBackend('word')} disabled={Boolean(downloadBusy)}>
                {downloadBusy === 'word' ? 'A gerar Word...' : 'Gerar Word (Backend)'}
              </Button>
              <Button
                onClick={() => {
                  setSelectedKey('')
                  setQuery('')
                  setDraft(buildCertificatePrefillFromMember({ type: certType, member: null }))
                }}
              >
                Limpar
              </Button>
            </div>
            {downloadNotice ? (
              <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                {downloadNotice}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Campos</div>
            <div className="mt-1 text-sm text-gray-600">Preencha os campos dinâmicos do modelo.</div>

            {certType === 'crisma' ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Folha" value={draft.folha || ''} onChange={(v) => setDraft((p) => ({ ...p, folha: v }))} />
                <Input
                  label="Nº do assento"
                  value={draft.numero_assento || ''}
                  onChange={(v) =>
                    setDraft((p) => {
                      const next = { ...p, numero_assento: v }
                      const parsed = parseAssentoRef(v)
                      if (parsed) {
                        next.folha = parsed.folha
                        if (!next.ano_registo) next.ano_registo = parsed.ano
                      }
                      return next
                    })
                  }
                />
                <Input label="Paróquia" value={draft.paroquia || ''} onChange={(v) => setDraft((p) => ({ ...p, paroquia: v }))} />
                <Input label="Ano do registo" value={draft.ano_registo || ''} onChange={(v) => setDraft((p) => ({ ...p, ano_registo: v }))} />
                <Input
                  label="Data do Crisma"
                  value={draft.data_crisma || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, data_crisma: v }))}
                  placeholder="Ex.: 15 de Outubro de 2018"
                />
                <Select label="Sexo" value={draft.sexo || ''} onChange={(v) => setDraft((p) => ({ ...p, sexo: v }))} options={SEX_OPTIONS} />
                <Input label="Nome do(a) crismado(a)" value={draft.nome_crismado || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_crismado: v }))} />
                <Input label="Bispo / Administrador" value={draft.nome_bispo || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_bispo: v }))} />
                <Input label="Local de nascimento" value={draft.local_nascimento || ''} onChange={(v) => setDraft((p) => ({ ...p, local_nascimento: v }))} />
                <Input label="Distrito" value={draft.distrito || ''} onChange={(v) => setDraft((p) => ({ ...p, distrito: v }))} />
                <Input label="Dia de nascimento" value={draft.dia_nascimento || ''} onChange={(v) => setDraft((p) => ({ ...p, dia_nascimento: v }))} />
                <Input label="Mês de nascimento" value={draft.mes_nascimento || ''} onChange={(v) => setDraft((p) => ({ ...p, mes_nascimento: v }))} />
                <Input label="Ano de nascimento" value={draft.ano_nascimento || ''} onChange={(v) => setDraft((p) => ({ ...p, ano_nascimento: v }))} />
                <Input label="Pai" value={draft.nome_pai || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_pai: v }))} />
                <Input label="Profissão do pai" value={draft.profissao_pai || ''} onChange={(v) => setDraft((p) => ({ ...p, profissao_pai: v }))} />
                <Input label="Mãe" value={draft.nome_mae || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_mae: v }))} />
                <Input label="Profissão da mãe" value={draft.profissao_mae || ''} onChange={(v) => setDraft((p) => ({ ...p, profissao_mae: v }))} />
                <Input label="Padrinho (crisma)" value={draft.nome_padrinho || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_padrinho: v }))} />
                <Input label="Estado (padrinho)" value={draft.estado_padrinho || ''} onChange={(v) => setDraft((p) => ({ ...p, estado_padrinho: v }))} />
                <Input label="Madrinha (crisma)" value={draft.nome_madrinha || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_madrinha: v }))} />
                <Input label="Estado (madrinha)" value={draft.estado_madrinha || ''} onChange={(v) => setDraft((p) => ({ ...p, estado_madrinha: v }))} />
                <Input
                  label="Data do Baptismo (ref.)"
                  value={draft.data_baptismo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, data_baptismo: v }))}
                  placeholder="Ex.: 01 de Junho de 2005"
                />
                <Input
                  label="Paróquia do Baptismo"
                  value={draft.paroquia_baptismo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, paroquia_baptismo: v }))}
                />
                <Textarea label="À margem / anotações" value={draft.anotacoes || ''} onChange={(v) => setDraft((p) => ({ ...p, anotacoes: v }))} rows={2} />
                <Input label="Local de emissão" value={draft.local_emissao || ''} onChange={(v) => setDraft((p) => ({ ...p, local_emissao: v }))} />
                <Input label="Dia" value={draft.dia || ''} onChange={(v) => setDraft((p) => ({ ...p, dia: v }))} />
                <Input label="Mês" value={draft.mes || ''} onChange={(v) => setDraft((p) => ({ ...p, mes: v }))} />
                <Input label="Ano" value={draft.ano || ''} onChange={(v) => setDraft((p) => ({ ...p, ano: v }))} />
                <Input label="Assinante" value={draft.assinante || ''} onChange={(v) => setDraft((p) => ({ ...p, assinante: v }))} />
                <Input label="Cargo do assinante" value={draft.cargo_assinante || ''} onChange={(v) => setDraft((p) => ({ ...p, cargo_assinante: v }))} />
              </div>
            ) : certType === 'batismo' ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Folha" value={draft.folha || ''} onChange={(v) => setDraft((p) => ({ ...p, folha: v }))} />
                <Input
                  label="Nº do assento"
                  value={draft.numero_assento || ''}
                  onChange={(v) =>
                    setDraft((p) => {
                      const next = { ...p, numero_assento: v }
                      const parsed = parseAssentoRef(v)
                      if (parsed) {
                        next.folha = parsed.folha
                        if (!next.ano_registo) next.ano_registo = parsed.ano
                      }
                      return next
                    })
                  }
                />
                <Input
                  label="Paróquia"
                  value={draft.paroquia || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, paroquia: v }))}
                />
                <Input
                  label="Ano do registo"
                  value={draft.ano_registo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, ano_registo: v }))}
                />
                <Input
                  label="Data do baptismo"
                  value={draft.data_baptismo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, data_baptismo: v }))}
                  placeholder="Ex.: 01 de Junho de 2013"
                />
                <Select
                  label="Sexo"
                  value={draft.sexo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, sexo: v }))}
                  options={SEX_OPTIONS}
                />
                <Input
                  label="Nome do(a) baptizado(a)"
                  value={draft.nome_baptizado || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_baptizado: v }))}
                />
                <Input
                  label="Local de nascimento"
                  value={draft.local_nascimento || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, local_nascimento: v }))}
                />
                <Input
                  label="Distrito"
                  value={draft.distrito || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, distrito: v }))}
                />
                <Input
                  label="Dia de nascimento"
                  value={draft.dia_nascimento || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, dia_nascimento: v }))}
                />
                <Input
                  label="Mês de nascimento"
                  value={draft.mes_nascimento || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, mes_nascimento: v }))}
                />
                <Input
                  label="Ano de nascimento"
                  value={draft.ano_nascimento || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, ano_nascimento: v }))}
                />
                <Input label="Pai" value={draft.nome_pai || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_pai: v }))} />
                <Input
                  label="Profissão do pai"
                  value={draft.profissao_pai || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, profissao_pai: v }))}
                />
                <Input
                  label="Naturalidade do pai"
                  value={draft.naturalidade_pai || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, naturalidade_pai: v }))}
                />
                <Input label="Mãe" value={draft.nome_mae || ''} onChange={(v) => setDraft((p) => ({ ...p, nome_mae: v }))} />
                <Input
                  label="Profissão da mãe"
                  value={draft.profissao_mae || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, profissao_mae: v }))}
                />
                <Input
                  label="Naturalidade da mãe"
                  value={draft.naturalidade_mae || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, naturalidade_mae: v }))}
                />
                <Input
                  label="Avó/Avô paterno"
                  value={draft.avo_paterno || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, avo_paterno: v }))}
                />
                <Input
                  label="Avó/Avô materno"
                  value={draft.avo_materno || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, avo_materno: v }))}
                />
                <Input
                  label="Padrinho"
                  value={draft.nome_padrinho || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_padrinho: v }))}
                />
                <Input
                  label="Estado (padrinho)"
                  value={draft.estado_padrinho || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, estado_padrinho: v }))}
                />
                <Input
                  label="Profissão (padrinho)"
                  value={draft.profissao_padrinho || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, profissao_padrinho: v }))}
                />
                <Input
                  label="Madrinha"
                  value={draft.nome_madrinha || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_madrinha: v }))}
                />
                <Input
                  label="Estado (madrinha)"
                  value={draft.estado_madrinha || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, estado_madrinha: v }))}
                />
                <Input
                  label="Profissão (madrinha)"
                  value={draft.profissao_madrinha || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, profissao_madrinha: v }))}
                />
                <Textarea
                  label="À margem / anotações"
                  value={draft.anotacoes || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, anotacoes: v }))}
                  rows={2}
                />
                <Input
                  label="Local de emissão"
                  value={draft.local_emissao || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, local_emissao: v }))}
                />
                <Input label="Dia" value={draft.dia || ''} onChange={(v) => setDraft((p) => ({ ...p, dia: v }))} />
                <Input label="Mês" value={draft.mes || ''} onChange={(v) => setDraft((p) => ({ ...p, mes: v }))} />
                <Input label="Ano" value={draft.ano || ''} onChange={(v) => setDraft((p) => ({ ...p, ano: v }))} />
                <Input
                  label="Assinante"
                  value={draft.assinante || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, assinante: v }))}
                />
                <Input
                  label="Cargo do assinante"
                  value={draft.cargo_assinante || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, cargo_assinante: v }))}
                />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Folha" value={draft.folha || ''} onChange={(v) => setDraft((p) => ({ ...p, folha: v }))} />
                <Input
                  label="Nº do registo"
                  value={draft.numero_registo || ''}
                  onChange={(v) =>
                    setDraft((p) => {
                      const next = { ...p, numero_registo: v }
                      const parsed = parseAssentoRef(v)
                      if (parsed) {
                        next.folha = parsed.folha
                        if (!next.ano) next.ano = parsed.ano
                      }
                      return next
                    })
                  }
                />
                <Input
                  label="Paróquia"
                  value={draft.paroquia || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, paroquia: v }))}
                />
                <Input label="Ano" value={draft.ano || ''} onChange={(v) => setDraft((p) => ({ ...p, ano: v }))} />
                <Input label="Dia" value={draft.dia || ''} onChange={(v) => setDraft((p) => ({ ...p, dia: v }))} />
                <Input label="Mês" value={draft.mes || ''} onChange={(v) => setDraft((p) => ({ ...p, mes: v }))} />
                <Input
                  label="Nome do noivo"
                  value={draft.nome_noivo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_noivo: v }))}
                />
                <Input
                  label="Pai do noivo"
                  value={draft.pai_noivo || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, pai_noivo: v }))}
                />
                <Input
                  label="Nome da noiva"
                  value={draft.nome_noiva || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_noiva: v }))}
                />
                <Input
                  label="Pai da noiva"
                  value={draft.pai_noiva || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, pai_noiva: v }))}
                />
                <Input
                  label="Oficiante"
                  value={draft.nome_oficiante || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_oficiante: v }))}
                />
                <Input
                  label="Testemunha 1"
                  value={draft.nome_testemunha_1 || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_testemunha_1: v }))}
                />
                <Input
                  label="Testemunha 2"
                  value={draft.nome_testemunha_2 || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, nome_testemunha_2: v }))}
                />
                <Input
                  label="Local de emissão"
                  value={draft.local_emissao || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, local_emissao: v }))}
                />
                <Input
                  label="Assinante"
                  value={draft.assinante || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, assinante: v }))}
                />
                <Input
                  label="Cargo do assinante"
                  value={draft.cargo_assinante || ''}
                  onChange={(v) => setDraft((p) => ({ ...p, cargo_assinante: v }))}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Solicitações</div>
            <Badge tone="gray">{requests.length}</Badge>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Membro</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Núcleo</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Estado</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {requests.map((r) => {
                  const member = findMemberByKey(members, r.memberKey)
                  const nucleo = nucleoById.get(r.nucleoId) ?? null
                  const label = CERT_TYPES.find((t) => t.value === (r.tipo || '').toLowerCase())?.label || r.tipo
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2">
                        {member ? (
                          <Link
                            to={`/membros/${encodeURIComponent(r.memberKey)}`}
                            className="font-medium text-indigo-700 hover:underline"
                          >
                            {normalizeValue(member?.['Nome Completo']) || r.memberKey}
                          </Link>
                        ) : (
                          <span className="text-gray-600">{r.memberKey || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{normalizeValue(nucleo?.nome) || r.nucleoId || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge tone={estadoTone(r.estado)}>{r.estado}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="primary"
                            onClick={() => {
                              const supportedTypes = ['batismo', 'crisma', 'casamento']
                              if (!supportedTypes.includes(r.tipo)) return
                              const m = member
                              const prefill = buildCertificatePrefillFromMember({ type: r.tipo, member: m })
                              setCertType(r.tipo)
                              setSelectedKey(r.memberKey || '')
                              setQuery('')
                              setDraft(prefill)
                              setTab('gerar')
                              onDownloadFromBackend('pdf', {
                                type: r.tipo,
                                data: prefill,
                                memberKey: r.memberKey || '',
                                requestId: r.id,
                              })
                            }}
                            disabled={!['batismo', 'crisma', 'casamento'].includes(r.tipo)}
                          >
                            Gerar
                          </Button>
                          {r.estado === 'pendente' ? (
                            <>
                              <Button
                                onClick={() =>
                                  setCertificateRequestStatus?.({
                                    id: r.id,
                                    estado: 'aprovado',
                                    processedByUserId: currentUser?.userId || '',
                                  })
                                }
                              >
                                Aprovar
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() =>
                                  setCertificateRequestStatus?.({
                                    id: r.id,
                                    estado: 'recusado',
                                    processedByUserId: currentUser?.userId || '',
                                  })
                                }
                              >
                                Recusar
                              </Button>
                            </>
                          ) : null}
                          <Button variant="danger" onClick={() => deleteCertificateRequest?.(r.id)}>
                            Apagar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-500">
                      Sem solicitações.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}`n    </div>
  )
}






