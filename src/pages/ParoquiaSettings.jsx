import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Input } from '../components/ui/Form.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { readApiError } from '../lib/api/http.js'

export function ParoquiaSettings() {
  const { authFetch } = useAuth()

  const [config, setConfig]   = useState(null)
  const [draft,  setDraft]    = useState({})
  const [busy,   setBusy]     = useState(false)
  const [notice, setNotice]   = useState(null) // { type: 'success'|'error', text }

  // Carregar ao montar
  useEffect(() => {
    authFetch('/api/paroquia-config')
      .then((r) => r.json())
      .then((data) => {
        setConfig(data)
        setDraft(data)
      })
      .catch(() => setNotice({ type: 'error', text: 'Erro ao carregar configurações.' }))
  }, [authFetch])

  const handleSave = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await authFetch('/api/paroquia-config', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      const updated = await res.json()
      setConfig(updated)
      setDraft(updated)
      setNotice({ type: 'success', text: 'Configurações guardadas com sucesso.' })
    } catch (err) {
      setNotice({ type: 'error', text: err?.message || 'Erro ao guardar configurações.' })
    } finally {
      setBusy(false)
    }
  }

  const field = (key) => String(draft?.[key] ?? '')
  const set   = (key) => (v) => setDraft((p) => ({ ...p, [key]: v }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Configurações da Paróquia</div>
            <div className="mt-1 text-sm text-gray-600">
              Dados institucionais que aparecem automaticamente nos certificados sacramentais.
            </div>
          </div>
          <Badge tone="purple">Super Admin</Badge>
        </div>
      </div>

      {notice && (
        <div
          className={[
            'rounded-xl border px-4 py-3 text-sm',
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800',
          ].join(' ')}
        >
          {notice.text}
        </div>
      )}

      {!config ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
          A carregar...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Identificação */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-gray-900">Identificação</div>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Nome da Paróquia"
                value={field('nomeParoquia')}
                onChange={set('nomeParoquia')}
                placeholder="Ex.: Igreja Paroquial de Santa Teresinha"
              />
              <Input
                label="Diocese"
                value={field('diocese')}
                onChange={set('diocese')}
                placeholder="Ex.: Diocese de Maputo"
              />
              <Input
                label="Arquidiocese"
                value={field('arquidiocese')}
                onChange={set('arquidiocese')}
                placeholder="Ex.: Arquidiocese de Maputo"
              />
            </div>
          </div>

          {/* Padre responsável */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-gray-900">Padre Responsável</div>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Nome do Padre"
                value={field('nomePadre')}
                onChange={set('nomePadre')}
                placeholder="Ex.: João da Silva"
              />
              <Input
                label="Cargo"
                value={field('cargoPadre')}
                onChange={set('cargoPadre')}
                placeholder="Ex.: Pároco"
              />
            </div>
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              O nome e cargo do padre aparecem automaticamente em todos os certificados como oficiante e assinante.
            </div>
          </div>

          {/* Localização */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-gray-900">Localização</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Cidade"
                value={field('cidade')}
                onChange={set('cidade')}
                placeholder="Ex.: Matola"
              />
              <Input
                label="Província"
                value={field('provincia')}
                onChange={set('provincia')}
                placeholder="Ex.: Maputo"
              />
              <Input
                label="País"
                value={field('pais')}
                onChange={set('pais')}
                placeholder="Ex.: Moçambique"
              />
              <Input
                label="Morada"
                value={field('morada')}
                onChange={set('morada')}
                placeholder="Endereço completo"
              />
            </div>
          </div>

          {/* Contactos */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-gray-900">Contactos</div>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Telefone"
                value={field('telefone')}
                onChange={set('telefone')}
                placeholder="Ex.: +258 21 000 000"
              />
              <Input
                label="E-mail"
                value={field('email')}
                onChange={set('email')}
                placeholder="Ex.: paroquia@diocese.mz"
              />
            </div>
          </div>

          {/* Certificados */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 text-sm font-semibold text-gray-900">Dados para Certificados</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Local de Emissão"
                value={field('localEmissaoCertificados')}
                onChange={set('localEmissaoCertificados')}
                placeholder="Ex.: Matola"
              />
              <Input
                label="Método de Autenticação"
                value={field('autenticacaoCertificados')}
                onChange={set('autenticacaoCertificados')}
                placeholder="Ex.: selo, carimbo"
              />
            </div>
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Estes valores são usados como predefinição nos certificados. O secretário pode substituí-los ao gerar cada documento individualmente.
            </div>
          </div>

        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={() => { setDraft(config); setNotice(null) }} disabled={busy}>
          Cancelar alterações
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={busy || !config}>
          {busy ? 'A guardar...' : 'Guardar configurações'}
        </Button>
      </div>
    </div>
  )
}
