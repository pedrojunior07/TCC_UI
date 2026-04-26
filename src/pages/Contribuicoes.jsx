import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { parseFlexibleDate, toIsoDate } from '../lib/dates.js'
import { fileToDataUrl } from '../lib/files.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'

function emptyDraft() {
  return {
    id: '',
    nucleoId: '',
    actividadeId: '',
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

function sumBy(list, keyFn, valueFn) {
  const map = new Map()
  for (const item of list) {
    const k = keyFn(item)
    map.set(k, (map.get(k) || 0) + valueFn(item))
  }
  return map
}

export function Contribuicoes() {
  const { nucleos, actividades, contribuicoes, upsertContribuicao, deleteContribuicao } = useAppData()
  const { currentUser } = useAuth()
  const [params] = useSearchParams()
  const preNucleoId = params.get('nucleoId') || 'all'

  const [query, setQuery] = useState('')
  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])
  const accessibleNucleoIds = useMemo(() => new Set(accessibleNucleos.map((n) => n.id)), [accessibleNucleos])

  const [nucleoId, setNucleoId] = useState(() => {
    if (preNucleoId === 'all') return 'all'
    if (accessibleNucleoIds.has(preNucleoId)) return preNucleoId
    return 'all'
  })
  const [tipo, setTipo] = useState('all')
  const [metodo, setMetodo] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [error, setError] = useState('')

  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptId, setReceiptId] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeForKey(query)
    const dFrom = parseFlexibleDate(from)
    const dTo = parseFlexibleDate(to)
    const toEnd = dTo ? new Date(dTo.getFullYear(), dTo.getMonth(), dTo.getDate(), 23, 59, 59, 999) : null

    return contribuicoes.filter((c) => {
      if (!accessibleNucleoIds.has(c.nucleoId)) return false
      if (nucleoId !== 'all' && c.nucleoId !== nucleoId) return false
      if (tipo !== 'all' && (c.tipo || 'cota') !== tipo) return false
      if (metodo !== 'all' && (c.metodo || 'numerario') !== metodo) return false

      if (dFrom || toEnd) {
        const d = parseFlexibleDate(c.data)
        if (!d) return false
        if (dFrom && d < dFrom) return false
        if (toEnd && d > toEnd) return false
      }

      if (!q) return true
      const n = accessibleNucleos.find((x) => x.id === c.nucleoId)
      const hay = normalizeForKey(`${c.pagador ?? ''} ${c.tipo ?? ''} ${c.metodo ?? ''} ${c.descricao ?? ''} ${n?.nome ?? ''}`)
      return hay.includes(q)
    })
  }, [accessibleNucleoIds, accessibleNucleos, contribuicoes, from, metodo, nucleoId, query, tipo, to])

  const totals = useMemo(() => {
    const total = filtered.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
    const byTipo = sumBy(filtered, (c) => c.tipo || 'cota', (c) => Number(c.valor) || 0)
    const byMetodo = sumBy(filtered, (c) => c.metodo || 'numerario', (c) => Number(c.valor) || 0)
    return { total, byTipo, byMetodo }
  }, [filtered])

  const csvHref = useMemo(() => {
    const header = ['id', 'nucleoId', 'tipo', 'valor', 'moeda', 'data', 'pagador', 'metodo', 'quitado', 'comprovado', 'descricao']
    const rows = filtered.map((c) => [
      c.id,
      c.nucleoId,
      c.tipo,
      c.valor,
      c.moeda,
      c.data,
      c.pagador,
      c.metodo,
      c.quitado ? 'sim' : 'nao',
      c.comprovado ? 'sim' : 'nao',
      (c.descricao || '').replace(/\r?\n/g, ' '),
    ])
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [header.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
  }, [filtered])

  const openCreate = () => {
    setError('')
    setDraft({ ...emptyDraft(), nucleoId: nucleoId !== 'all' ? nucleoId : '', actividadeId: '' })
    setOpen(true)
  }

  const openEdit = (c) => {
    setError('')
    setDraft({ ...emptyDraft(), ...c, valor: String(c.valor ?? '') })
    setOpen(true)
  }

  const onUpload = async (file) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setDraft((d) => ({
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

  const save = async () => {
    setError('')
    if (!draft.nucleoId) return setError('Selecione um núcleo.')
    if (!normalizeValue(draft.valor)) return setError('Informe o valor.')
    if (!normalizeValue(draft.data)) return setError('Informe a data.')
    if (!normalizeValue(draft.pagador)) return setError('Informe o pagador.')

    const id = await upsertContribuicao({
      ...draft,
      valor: Number(draft.valor ?? 0),
    })
    if (!id) return
    setOpen(false)
    setReceiptId(id)
    setReceiptOpen(true)
  }

  const toggle = (c, patch) => {
    upsertContribuicao({ ...c, ...patch, id: c.id })
  }

  const receipt = useMemo(() => contribuicoes.find((c) => c.id === receiptId) ?? null, [contribuicoes, receiptId])

  const actividadesForDraftNucleo = useMemo(() => {
    if (!draft.nucleoId) return []
    return actividades.filter((a) => a.nucleoId === draft.nucleoId).slice().sort((a, b) => String(b.data).localeCompare(String(a.data)))
  }, [actividades, draft.nucleoId])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Contribuições</div>
            <div className="mt-1 text-sm text-gray-600">Registos, comprovativos e relatórios por período e núcleo.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={csvHref}
              download="contribuicoes.csv"
              className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Exportar CSV
            </a>
            <Button variant="primary" onClick={openCreate}>
              Registar contribuição
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Pesquisar</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pagador, tipo, método, descrição..."
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block sm:col-span-2">
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
            <div className="text-xs font-medium text-gray-600">Tipo</div>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="all">Todos</option>
              <option value="cota">Cota</option>
              <option value="contribuicao">Contribuição</option>
              <option value="doacao">Doação</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Método</div>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="all">Todos</option>
              <option value="numerario">Numerário</option>
              <option value="mpesa">M-Pesa</option>
              <option value="emola">e-Mola</option>
              <option value="transferencia">Transferência</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">De</div>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="2026-01-01"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Até</div>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="2026-01-31"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="text-sm font-semibold text-gray-900">Total</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{totals.total.toFixed(2)} MZN</div>
          <div className="mt-1 text-xs text-gray-500">{filtered.length} registos no filtro</div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="text-sm font-semibold text-gray-900">Por tipo</div>
          <div className="mt-3 space-y-1 text-sm text-gray-700">
            {Array.from(totals.byTipo.entries()).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="capitalize">{k}</span>
                <span className="font-medium">{v.toFixed(2)}</span>
              </div>
            ))}
            {totals.byTipo.size === 0 ? <div className="text-sm text-gray-500">Sem dados.</div> : null}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="text-sm font-semibold text-gray-900">Por método</div>
          <div className="mt-3 space-y-1 text-sm text-gray-700">
            {Array.from(totals.byMetodo.entries()).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="capitalize">{k}</span>
                <span className="font-medium">{v.toFixed(2)}</span>
              </div>
            ))}
            {totals.byMetodo.size === 0 ? <div className="text-sm text-gray-500">Sem dados.</div> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3">Pagador</th>
                <th className="px-4 py-3">Núcleo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const n = accessibleNucleos.find((x) => x.id === c.nucleoId) ?? null
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.pagador || '—'}</div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {c.metodo}
                        {c.actividadeId ? ' • ligada a actividade' : ''}
                        {c.comprovativo ? ' • com comprovativo' : ''}
                  </div>
                </td>
                    <td className="px-4 py-3 text-gray-700">{n?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.data || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{c.tipo}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {Number(c.valor || 0).toFixed(2)} {c.moeda || 'MZN'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => toggle(c, { quitado: !c.quitado })}>
                          <Badge tone={c.quitado ? 'green' : 'yellow'}>{c.quitado ? 'quitado' : 'pendente'}</Badge>
                        </button>
                        <button type="button" onClick={() => toggle(c, { comprovado: !c.comprovado })}>
                          <Badge tone={c.comprovado ? 'blue' : 'gray'}>{c.comprovado ? 'comprovado' : 'sem comprovação'}</Badge>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          onClick={() => {
                            setReceiptId(c.id)
                            setReceiptOpen(true)
                          }}
                        >
                          Recibo
                        </Button>
                        <Button onClick={() => openEdit(c)}>Editar</Button>
                        <Button variant="danger" onClick={() => deleteContribuicao(c.id)}>
                          Remover
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sem registos para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        title={draft.id ? 'Editar contribuição' : 'Registar contribuição'}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save}>
              Guardar
            </Button>
          </div>
        }
      >
        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Núcleo</div>
            <select
              value={draft.nucleoId}
              onChange={(e) => setDraft((d) => ({ ...d, nucleoId: e.target.value, actividadeId: '' }))}
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
            <div className="text-xs font-medium text-gray-600">Atividade (opcional)</div>
            <select
              value={draft.actividadeId || ''}
              onChange={(e) => setDraft((d) => ({ ...d, actividadeId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Sem ligação</option>
              {actividadesForDraftNucleo.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.data ? `${a.data} • ` : '') + (a.titulo || 'Atividade')}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Tipo</div>
            <select
              value={draft.tipo}
              onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))}
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
              value={draft.metodo}
              onChange={(e) => setDraft((d) => ({ ...d, metodo: e.target.value }))}
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
              value={draft.valor}
              onChange={(e) => setDraft((d) => ({ ...d, valor: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Moeda</div>
            <input
              value={draft.moeda}
              onChange={(e) => setDraft((d) => ({ ...d, moeda: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Data</div>
            <input
              value={draft.data}
              onChange={(e) => setDraft((d) => ({ ...d, data: e.target.value }))}
              placeholder="2026-01-07"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Pagador</div>
            <input
              value={draft.pagador}
              onChange={(e) => setDraft((d) => ({ ...d, pagador: e.target.value }))}
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

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.quitado}
              onChange={(e) => setDraft((d) => ({ ...d, quitado: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
            Quitado
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.comprovado}
              onChange={(e) => setDraft((d) => ({ ...d, comprovado: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
            />
            Comprovado
          </label>

          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-gray-600">Comprovativo (upload)</div>
            <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
              <div className="min-w-0">
                <div className="font-medium">{draft.comprovativo?.nomeFicheiro || 'Selecionar ficheiro'}</div>
                <div className="mt-0.5 truncate text-xs text-gray-500">
                  {draft.comprovativo ? 'Guardado em localStorage (simulado).' : 'PDF, imagem, etc.'}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-semibold ring-1 ring-inset ring-gray-200">
                Upload
              </span>
              <input type="file" className="hidden" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
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
                <span className="text-gray-500">Núcleo:</span> {accessibleNucleos.find((n) => n.id === receipt.nucleoId)?.nome || '—'}
              </div>
              <div>
                <span className="text-gray-500">Data:</span> {receipt.data || '—'}
              </div>
              <div>
                <span className="text-gray-500">Pagador:</span> {receipt.pagador || '—'}
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {Number(receipt.valor || 0).toFixed(2)} {receipt.moeda || 'MZN'}
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
