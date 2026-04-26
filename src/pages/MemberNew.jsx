import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CANONICAL_FIELDS } from '../lib/memberFields.js'
import { normalizeValue } from '../lib/normalize.js'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { MemberForm } from '../components/members/MemberForm.jsx'
import { Button } from '../components/ui/Button.jsx'
import { useToast } from '../components/ui/useToast.js'

function emptyMember() {
  const member = {}
  for (const field of CANONICAL_FIELDS) member[field] = ''
  return member
}

export function MemberNew() {
  const { addMember, nucleos } = useAppData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [draft, setDraft] = useState(() => emptyMember())
  const [nucleoId, setNucleoId] = useState(() => params.get('nucleoId') || '')

  const accessibleNucleos = useMemo(() => getAccessibleNucleos({ currentUser, nucleos }), [currentUser, nucleos])

  const valid = useMemo(() => {
    if (!normalizeValue(draft?.['Nome Completo'])) return false
    if (currentUser?.role === 'chefe_nucleo') return Boolean(nucleoId)
    return true
  }, [currentUser?.role, draft, nucleoId])

  const shouldShowNucleoSelector =
    currentUser?.role === 'chefe_nucleo' || Boolean(params.get('nucleoId')) || accessibleNucleos.length > 0

  const onSave = async () => {
    if (!valid) return
    const shouldAttachToNucleo = Boolean(nucleoId)
    const result = await addMember(draft, { nucleoId, attachIfExists: shouldAttachToNucleo })
    if (!result?.ok) {
      toast.error(result?.error || 'Falha ao guardar o membro.')
      return
    }
    toast.success(shouldAttachToNucleo ? 'Membro guardado e associado ao núcleo.' : 'Membro guardado.')
    navigate('/membros')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Adicionar Membro</div>
            <div className="mt-1 text-xs text-gray-500">Validacao minima: "Nome Completo" obrigatorio.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/membros')}>Cancelar</Button>
            <Button variant="primary" disabled={!valid} onClick={onSave}>
              Guardar
            </Button>
          </div>
        </div>
      </div>

      {shouldShowNucleoSelector ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Nucleo</div>
          <div className="mt-1 text-xs text-gray-500">
            {currentUser?.role === 'chefe_nucleo'
              ? 'O membro sera adicionado ao nucleo selecionado.'
              : 'Opcional: associe ja este membro a um nucleo.'}
          </div>
          <div className="mt-3">
            <select
              value={nucleoId}
              onChange={(e) => setNucleoId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Selecionar...</option>
              {accessibleNucleos.map((nucleo) => (
                <option key={nucleo.id} value={nucleo.id}>
                  {nucleo.nome || nucleo.id}
                </option>
              ))}
            </select>
            {accessibleNucleos.length === 0 ? (
              <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Sem nucleos acessiveis. Peca ao super admin para lhe atribuir um nucleo.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <MemberForm value={draft} onChange={setDraft} />
    </div>
  )
}
