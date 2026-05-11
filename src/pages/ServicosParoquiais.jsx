import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { readApiError } from '../lib/api/http.js'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input, Select, Textarea } from '../components/ui/Form.jsx'
import { Modal } from '../components/ui/Modal.jsx'

const TIPO_PRECO_OPTIONS = [
  { value: 'GRATUITO',    label: 'Gratuito' },
  { value: 'FIXO',        label: 'Preço fixo' },
  { value: 'POR_HORA',    label: 'Por hora' },
  { value: 'POR_UNIDADE', label: 'Por unidade' },
]

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function tipoPrecoLabel(value) {
  return TIPO_PRECO_OPTIONS.find((o) => o.value === value)?.label || value
}

function tipoTone(value) {
  if (value === 'GRATUITO') return 'green'
  if (value === 'POR_HORA') return 'blue'
  if (value === 'POR_UNIDADE') return 'purple'
  return 'gray'
}

function fmt(value, moeda) {
  if (value == null) return '—'
  return `${Number(value).toFixed(2)} ${moeda || 'MZN'}`
}

function fmtDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })
}

function emptyServico() {
  return { nome: '', descricao: '', categoria: '', tipoPreco: 'FIXO', precoPorUnidade: '', moeda: 'MZN', unidadeLabel: '', ativo: true }
}

function emptyUso() {
  const now = new Date()
  now.setSeconds(0, 0)
  return {
    servicoId: '',
    pessoa: '',
    memberKey: '',
    dataInicio: now.toISOString().slice(0, 16),
    dataFim: '',
    quantidade: '1',
    observacoes: '',
  }
}

export function ServicosParoquiais() {
  const { authFetch } = useAuth()
  const [tab, setTab] = useState('catalogo')

  // ─── Catálogo ────────────────────────────────────────────────────────────
  const [servicos, setServicos] = useState([])
  const [loadingServicos, setLoadingServicos] = useState(false)
  const [showServicoModal, setShowServicoModal] = useState(false)
  const [editingServico, setEditingServico] = useState(null)
  const [servicoDraft, setServicoDraft] = useState(emptyServico())
  const [savingServico, setSavingServico] = useState(false)
  const [servicoError, setServicoError] = useState('')

  // ─── Usos ─────────────────────────────────────────────────────────────────
  const [usos, setUsos] = useState([])
  const [loadingUsos, setLoadingUsos] = useState(false)
  const [showUsoModal, setShowUsoModal] = useState(false)
  const [usoDraft, setUsoDraft] = useState(emptyUso())
  const [savingUso, setSavingUso] = useState(false)
  const [usoError, setUsoError] = useState('')
  const [filtroServico, setFiltroServico] = useState('')

  // ─── Estatísticas ─────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // ─── Fetch helpers ────────────────────────────────────────────────────────
  const fetchServicos = useCallback(async () => {
    setLoadingServicos(true)
    try {
      const res = await authFetch('/api/servicos-paroquiais')
      if (res.ok) setServicos(await res.json())
    } finally {
      setLoadingServicos(false)
    }
  }, [authFetch])

  const fetchUsos = useCallback(async () => {
    setLoadingUsos(true)
    try {
      const url = filtroServico ? `/api/servicos-paroquiais/usos?servicoId=${filtroServico}` : '/api/servicos-paroquiais/usos'
      const res = await authFetch(url)
      if (res.ok) setUsos(await res.json())
    } finally {
      setLoadingUsos(false)
    }
  }, [authFetch, filtroServico])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await authFetch('/api/servicos-paroquiais/estatisticas')
      if (res.ok) setStats(await res.json())
    } finally {
      setLoadingStats(false)
    }
  }, [authFetch])

  useEffect(() => { fetchServicos() }, [fetchServicos])

  useEffect(() => {
    if (tab === 'registos') fetchUsos()
    if (tab === 'estatisticas') fetchStats()
  }, [tab, fetchUsos, fetchStats])

  useEffect(() => {
    if (tab === 'registos') fetchUsos()
  }, [filtroServico])

  // ─── Catálogo actions ─────────────────────────────────────────────────────
  const openCreateServico = () => {
    setEditingServico(null)
    setServicoDraft(emptyServico())
    setServicoError('')
    setShowServicoModal(true)
  }

  const openEditServico = (s) => {
    setEditingServico(s)
    setServicoDraft({
      nome: s.nome || '', descricao: s.descricao || '', categoria: s.categoria || '',
      tipoPreco: s.tipoPreco || 'FIXO',
      precoPorUnidade: s.precoPorUnidade != null ? String(s.precoPorUnidade) : '',
      moeda: s.moeda || 'MZN', unidadeLabel: s.unidadeLabel || '', ativo: s.ativo ?? true,
    })
    setServicoError('')
    setShowServicoModal(true)
  }

  const saveServico = async () => {
    setSavingServico(true)
    setServicoError('')
    try {
      const body = {
        nome: servicoDraft.nome,
        descricao: servicoDraft.descricao || null,
        categoria: servicoDraft.categoria || null,
        tipoPreco: servicoDraft.tipoPreco,
        precoPorUnidade: servicoDraft.precoPorUnidade !== '' ? Number(servicoDraft.precoPorUnidade) : null,
        moeda: servicoDraft.moeda || 'MZN',
        unidadeLabel: servicoDraft.unidadeLabel || null,
        ativo: servicoDraft.ativo,
      }
      const method = editingServico ? 'PUT' : 'POST'
      const url = editingServico ? `/api/servicos-paroquiais/${editingServico.id}` : '/api/servicos-paroquiais'
      const res = await authFetch(url, { method, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await readApiError(res))
      setShowServicoModal(false)
      await fetchServicos()
      if (tab === 'estatisticas') fetchStats()
    } catch (err) {
      setServicoError(err.message || 'Erro ao guardar serviço.')
    } finally {
      setSavingServico(false)
    }
  }

  const deleteServico = async (id) => {
    if (!confirm('Remover este serviço?')) return
    const res = await authFetch(`/api/servicos-paroquiais/${id}`, { method: 'DELETE' })
    if (res.ok) { await fetchServicos(); if (tab === 'estatisticas') fetchStats() }
  }

  // ─── Uso actions ──────────────────────────────────────────────────────────
  const openCreateUso = () => {
    setUsoDraft(emptyUso())
    setUsoError('')
    setShowUsoModal(true)
  }

  const servicoSelecionado = useMemo(
    () => servicos.find((s) => s.id === usoDraft.servicoId),
    [servicos, usoDraft.servicoId],
  )

  const saveUso = async () => {
    setSavingUso(true)
    setUsoError('')
    try {
      const toIso = (v) => v ? new Date(v).toISOString().slice(0, 19) : null
      const body = {
        servicoId: usoDraft.servicoId,
        pessoa: usoDraft.pessoa,
        memberKey: usoDraft.memberKey || null,
        dataInicio: toIso(usoDraft.dataInicio),
        dataFim: usoDraft.dataFim ? toIso(usoDraft.dataFim) : null,
        quantidade: usoDraft.quantidade !== '' ? Number(usoDraft.quantidade) : 1,
        observacoes: usoDraft.observacoes || null,
      }
      const res = await authFetch('/api/servicos-paroquiais/usos', { method: 'POST', body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await readApiError(res))
      setShowUsoModal(false)
      await fetchUsos()
      if (tab === 'estatisticas') fetchStats()
    } catch (err) {
      setUsoError(err.message || 'Erro ao registar uso.')
    } finally {
      setSavingUso(false)
    }
  }

  const deleteUso = async (id) => {
    if (!confirm('Remover este registo?')) return
    const res = await authFetch(`/api/servicos-paroquiais/usos/${id}`, { method: 'DELETE' })
    if (res.ok) { await fetchUsos(); if (tab === 'estatisticas') fetchStats() }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Serviços Paroquiais</div>
            <div className="mt-1 text-sm text-gray-600">
              Gerencie todos os serviços da paróquia, registos de uso e estatísticas de receita.
            </div>
          </div>
          <Badge tone="indigo">{servicos.length} serviço{servicos.length !== 1 ? 's' : ''}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'catalogo', label: 'Catálogo' },
          { key: 'registos', label: 'Registos' },
          { key: 'estatisticas', label: 'Estatísticas' },
        ].map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'primary' : 'default'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* ── CATÁLOGO ── */}
      {tab === 'catalogo' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Catálogo de Serviços</div>
            <Button variant="primary" onClick={openCreateServico}>+ Novo serviço</Button>
          </div>

          {loadingServicos ? (
            <div className="mt-6 py-10 text-center text-sm text-gray-500">A carregar...</div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {servicos.map((s) => (
                <div
                  key={s.id}
                  className={[
                    'rounded-xl border p-4 flex flex-col gap-2',
                    s.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{s.nome}</div>
                      {s.categoria && (
                        <div className="text-xs text-gray-500 mt-0.5">{s.categoria}</div>
                      )}
                    </div>
                    <Badge tone={tipoTone(s.tipoPreco)}>{tipoPrecoLabel(s.tipoPreco)}</Badge>
                  </div>

                  {s.descricao && (
                    <div className="text-sm text-gray-600 line-clamp-2">{s.descricao}</div>
                  )}

                  <div className="text-sm font-medium text-gray-800">
                    {s.tipoPreco === 'GRATUITO'
                      ? 'Gratuito'
                      : s.precoPorUnidade != null
                        ? `${fmt(s.precoPorUnidade, s.moeda)}${s.tipoPreco === 'POR_HORA' ? '/hora' : s.unidadeLabel ? `/${s.unidadeLabel}` : ''}`
                        : '—'}
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    <Button onClick={() => openEditServico(s)}>Editar</Button>
                    <Button variant="danger" onClick={() => deleteServico(s.id)}>Remover</Button>
                  </div>
                </div>
              ))}
              {servicos.length === 0 && (
                <div className="col-span-full py-10 text-center text-sm text-gray-500">
                  Nenhum serviço criado ainda. Clique em "Novo serviço" para começar.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── REGISTOS ── */}
      {tab === 'registos' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Registos de Uso</div>
            <div className="flex flex-wrap gap-2">
              <Select
                label=""
                value={filtroServico}
                onChange={setFiltroServico}
                options={[{ value: '', label: 'Todos os serviços' }, ...servicos.map((s) => ({ value: s.id, label: s.nome }))]}
              />
              <Button variant="primary" onClick={openCreateUso}>+ Registar uso</Button>
            </div>
          </div>

          {loadingUsos ? (
            <div className="mt-6 py-10 text-center text-sm text-gray-500">A carregar...</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Serviço</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Pessoa</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Início</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Qtd.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Total</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Obs.</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {usos.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{u.nomeServico}</div>
                        {u.categoriaServico && (
                          <div className="text-xs text-gray-500">{u.categoriaServico}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">{u.pessoa}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(u.dataInicio)}</td>
                      <td className="px-3 py-2">{u.quantidade != null ? Number(u.quantidade).toFixed(2) : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{fmt(u.total, u.moeda)}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate text-gray-600">{u.observacoes || '—'}</td>
                      <td className="px-3 py-2">
                        <Button variant="danger" onClick={() => deleteUso(u.id)}>Remover</Button>
                      </td>
                    </tr>
                  ))}
                  {usos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">
                        Sem registos de uso.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ESTATÍSTICAS ── */}
      {tab === 'estatisticas' && (
        <div className="space-y-4">
          {loadingStats ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
              A carregar estatísticas...
            </div>
          ) : stats ? (
            <>
              {/* Sumário geral */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Receita total" value={fmt(stats.totalReceita, 'MZN')} tone="green" />
                <StatCard label="Total de usos" value={stats.totalUsos ?? 0} tone="blue" />
                <StatCard label="Serviços activos" value={servicos.filter((s) => s.ativo).length} tone="purple" />
              </div>

              {/* Por serviço */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900 mb-3">Receita por Serviço</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Serviço</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Categoria</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Usos</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Receita</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(stats.porServico || [])
                        .slice()
                        .sort((a, b) => (b.totalReceita || 0) - (a.totalReceita || 0))
                        .map((row) => (
                          <tr key={row.servicoId} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{row.nomeServico}</td>
                            <td className="px-3 py-2 text-gray-600">{row.categoria || '—'}</td>
                            <td className="px-3 py-2 text-right">{row.totalUsos}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                              {fmt(row.totalReceita, 'MZN')}
                            </td>
                          </tr>
                        ))}
                      {!(stats.porServico?.length) && (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-gray-500">Sem dados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Por categoria */}
              {stats.porCategoria?.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Receita por Categoria</div>
                  <div className="space-y-2">
                    {stats.porCategoria.map((row) => {
                      const pct = stats.totalReceita > 0
                        ? Math.round((row.totalReceita / stats.totalReceita) * 100)
                        : 0
                      return (
                        <div key={row.categoria}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="font-medium text-gray-800">{row.categoria}</span>
                            <span className="text-gray-600">{fmt(row.totalReceita, 'MZN')} ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-indigo-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Tendência mensal */}
              {stats.porMes?.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Tendência Mensal</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Período</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Receita</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {stats.porMes.slice(0, 12).map((row) => (
                          <tr key={`${row.ano}-${row.mes}`} className="hover:bg-gray-50">
                            <td className="px-3 py-2">{MESES_PT[row.mes - 1]} {row.ano}</td>
                            <td className="px-3 py-2 text-right font-semibold">{fmt(row.totalReceita, 'MZN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
              Sem dados de estatísticas.
            </div>
          )}
        </div>
      )}

      {/* ── MODAL SERVIÇO ── */}
      {showServicoModal && (
        <Modal
          open={showServicoModal}
          title={editingServico ? 'Editar serviço' : 'Novo serviço'}
          onClose={() => setShowServicoModal(false)}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-full">
              <Input
                label="Nome do serviço"
                value={servicoDraft.nome}
                onChange={(v) => setServicoDraft((p) => ({ ...p, nome: v }))}
              />
            </div>
            <Input
              label="Categoria"
              placeholder="Ex.: Estacionamento, Alimentação..."
              value={servicoDraft.categoria}
              onChange={(v) => setServicoDraft((p) => ({ ...p, categoria: v }))}
            />
            <Select
              label="Tipo de preço"
              value={servicoDraft.tipoPreco}
              onChange={(v) => setServicoDraft((p) => ({ ...p, tipoPreco: v }))}
              options={TIPO_PRECO_OPTIONS}
            />
            {servicoDraft.tipoPreco !== 'GRATUITO' && (
              <>
                <Input
                  label={`Preço${servicoDraft.tipoPreco === 'POR_HORA' ? ' por hora' : servicoDraft.tipoPreco === 'POR_UNIDADE' ? ' por unidade' : ''}`}
                  type="number"
                  value={servicoDraft.precoPorUnidade}
                  onChange={(v) => setServicoDraft((p) => ({ ...p, precoPorUnidade: v }))}
                  placeholder="0.00"
                />
                <Input
                  label="Moeda"
                  value={servicoDraft.moeda}
                  onChange={(v) => setServicoDraft((p) => ({ ...p, moeda: v }))}
                />
                {servicoDraft.tipoPreco === 'POR_UNIDADE' && (
                  <Input
                    label="Designação da unidade"
                    placeholder="Ex.: viagem, refeição..."
                    value={servicoDraft.unidadeLabel}
                    onChange={(v) => setServicoDraft((p) => ({ ...p, unidadeLabel: v }))}
                  />
                )}
              </>
            )}
            <div className="col-span-full">
              <Textarea
                label="Descrição"
                value={servicoDraft.descricao}
                onChange={(v) => setServicoDraft((p) => ({ ...p, descricao: v }))}
                rows={2}
              />
            </div>
            <div className="col-span-full flex items-center gap-2">
              <input
                id="ativo-check"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                checked={servicoDraft.ativo}
                onChange={(e) => setServicoDraft((p) => ({ ...p, ativo: e.target.checked }))}
              />
              <label htmlFor="ativo-check" className="text-sm text-gray-700">Serviço activo</label>
            </div>
          </div>
          {servicoError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {servicoError}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setShowServicoModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveServico} disabled={savingServico}>
              {savingServico ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </Modal>
      )}

      {/* ── MODAL USO ── */}
      {showUsoModal && (
        <Modal open={showUsoModal} title="Registar uso de serviço" onClose={() => setShowUsoModal(false)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-full">
              <Select
                label="Serviço"
                value={usoDraft.servicoId}
                onChange={(v) => setUsoDraft((p) => ({ ...p, servicoId: v }))}
                options={[{ value: '', label: 'Seleccionar...' }, ...servicos.filter((s) => s.ativo).map((s) => ({ value: s.id, label: s.nome }))]}
              />
            </div>
            <div className="col-span-full">
              <Input
                label="Pessoa / Cliente"
                value={usoDraft.pessoa}
                onChange={(v) => setUsoDraft((p) => ({ ...p, pessoa: v }))}
              />
            </div>
            <Input
              label="Início"
              type="datetime-local"
              value={usoDraft.dataInicio}
              onChange={(v) => setUsoDraft((p) => ({ ...p, dataInicio: v }))}
            />
            {servicoSelecionado?.tipoPreco === 'POR_HORA' ? (
              <Input
                label="Fim"
                type="datetime-local"
                value={usoDraft.dataFim}
                onChange={(v) => setUsoDraft((p) => ({ ...p, dataFim: v }))}
              />
            ) : (
              <Input
                label={servicoSelecionado?.tipoPreco === 'POR_UNIDADE'
                  ? `Quantidade${servicoSelecionado?.unidadeLabel ? ` (${servicoSelecionado.unidadeLabel})` : ''}`
                  : 'Quantidade'}
                type="number"
                value={usoDraft.quantidade}
                onChange={(v) => setUsoDraft((p) => ({ ...p, quantidade: v }))}
              />
            )}
            {servicoSelecionado && (
              <div className="col-span-full rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                <span className="font-medium">{servicoSelecionado.nome}</span>
                {' — '}
                {servicoSelecionado.tipoPreco === 'GRATUITO'
                  ? 'Gratuito'
                  : servicoSelecionado.precoPorUnidade != null
                    ? `${fmt(servicoSelecionado.precoPorUnidade, servicoSelecionado.moeda)}${servicoSelecionado.tipoPreco === 'POR_HORA' ? '/hora' : ''}`
                    : 'Preço não definido'}
              </div>
            )}
            <div className="col-span-full">
              <Textarea
                label="Observações"
                value={usoDraft.observacoes}
                onChange={(v) => setUsoDraft((p) => ({ ...p, observacoes: v }))}
                rows={2}
              />
            </div>
          </div>
          {usoError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {usoError}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setShowUsoModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveUso} disabled={savingUso}>
              {savingUso ? 'A registar...' : 'Registar'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }) {
  const toneClasses = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  }
  return (
    <div className={['rounded-2xl border p-5', toneClasses[tone] || 'bg-white border-gray-200'].join(' ')}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  )
}
