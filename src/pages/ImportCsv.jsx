import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseCsv } from '../lib/csv/parseCsv.js'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { normalizeValue } from '../lib/normalize.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { useToast } from '../components/ui/useToast.js'

export function ImportCsv() {
  const { importMembers, nucleos } = useAppData()
  const { currentUser } = useAuth()
  const toast = useToast()
  const [params] = useSearchParams()
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [strategy, setStrategy] = useState('add')

  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])
  const requestedNucleoId = params.get('nucleoId') || ''
  const [nucleoId, setNucleoId] = useState(() => {
    if (requestedNucleoId && accessibleNucleos.some((nucleo) => nucleo.id === requestedNucleoId)) return requestedNucleoId
    if (currentUser?.role === 'chefe_nucleo' && accessibleNucleos.length === 1) return accessibleNucleos[0].id
    return ''
  })

  useEffect(() => {
    if (nucleoId) return
    if (requestedNucleoId && accessibleNucleos.some((nucleo) => nucleo.id === requestedNucleoId)) {
      setNucleoId(requestedNucleoId)
      return
    }
    if (currentUser?.role === 'chefe_nucleo' && accessibleNucleos.length === 1) {
      setNucleoId(accessibleNucleos[0].id)
    }
  }, [accessibleNucleos, currentUser?.role, nucleoId, requestedNucleoId])

  const effectiveRows = useMemo(() => {
    if (!preview) return []
    return preview.rows.filter((row) => normalizeValue(row?.['Nome Completo']))
  }, [preview])

  const requiresNucleo = currentUser?.role === 'chefe_nucleo'

  const onPick = async (picked) => {
    setPreview(null)
    setError('')
    setResult(null)
    if (!picked) return
    try {
      const parsed = await parseCsv(picked)
      setPreview(parsed)
    } catch (err) {
      setError(err?.message || 'Falha ao ler CSV.')
    }
  }

  const onImport = async () => {
    if (!preview || busy) return
    if (requiresNucleo && !nucleoId) {
      setError('Selecione o nucleo onde estes membros devem ficar associados.')
      return
    }

    setBusy(true)
    setError('')
    setResult(null)
    try {
      const summary = await importMembers({
        rows: preview.rows,
        strategy: strategy === 'replace' ? 'replace' : 'add',
        nucleoId,
      })
      setResult(summary)
      if (!summary?.ok && summary?.failed?.length) {
        toast.error(`Importacao concluida com ${summary.failed.length} erro(s).`)
      } else {
        toast.success('Importacao concluida.')
      }
      setPreview(null)
    } catch (err) {
      const message = err?.message || 'Falha ao importar CSV.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Importar CSV</div>
            <div className="mt-1 text-xs text-gray-500">CSV com separador ";" e linhas com colunas vazias sao aceites.</div>
          </div>
          <Badge tone="blue">Tolerante</Badge>
        </div>

        {accessibleNucleos.length > 0 ? (
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Associar ao nucleo</div>
            <select
              value={nucleoId}
              onChange={(e) => setNucleoId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">{requiresNucleo ? 'Selecionar...' : 'Nao associar agora'}</option>
              {accessibleNucleos.map((nucleo) => (
                <option key={nucleo.id} value={nucleo.id}>
                  {nucleo.nome || nucleo.id}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-gray-500">
              {requiresNucleo
                ? 'Os membros novos ou ja existentes serao associados a este nucleo.'
                : 'Opcional: se o membro ja existir na base geral, ele sera associado ao nucleo escolhido em vez de gerar conflito.'}
            </div>
          </label>
        ) : null}

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-700"
        />

        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {result ? (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
            Importacao concluida: {result.added?.length || 0} adicionados, {result.replaced?.length || 0} atualizados,{' '}
            {result.skipped?.length || 0} ignorados
            {result.failed?.length ? `, ${result.failed.length} com erro` : ''}.
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">Preview</div>
                <div className="mt-1 text-xs text-gray-500">
                  {preview.rows.length} linhas lidas; {effectiveRows.length} com "Nome Completo".
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="merge" checked={strategy === 'add'} onChange={() => setStrategy('add')} />
                  Adicionar novos
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" name="merge" checked={strategy === 'replace'} onChange={() => setStrategy('replace')} />
                  Substituir duplicados
                </label>
                <Button variant="primary" onClick={onImport} loading={busy}>
                  Importar
                </Button>
              </div>
            </div>

            {preview.warnings.length > 0 ? (
              <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
                <div className="font-semibold">Avisos</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {preview.warnings.slice(0, 6).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Colunas detetadas</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {preview.columns.map((column) => (
                <Badge key={column} tone="gray">
                  {column}
                </Badge>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {preview.columns.slice(0, 8).map((column) => (
                      <th key={column} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.rows.slice(0, 10).map((row, idx) => (
                    <tr key={idx}>
                      {preview.columns.slice(0, 8).map((column) => (
                        <td key={column} className="px-4 py-3 text-sm text-gray-700">
                          {row[column] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
