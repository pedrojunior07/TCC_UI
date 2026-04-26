import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { Input, Textarea } from '../components/ui/Form.jsx'
import { Badge } from '../components/ui/Badge.jsx'

export function Families() {
  const { families, familyLinks, createFamily, deleteFamily } = useAppData()
  const [open, setOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [residencia, setResidencia] = useState('')
  const [nomeDoPai, setNomeDoPai] = useState('')
  const [nomeDaMae, setNomeDaMae] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const counts = useMemo(() => {
    const map = new Map()
    for (const l of familyLinks) map.set(l.familyId, (map.get(l.familyId) ?? 0) + 1)
    return map
  }, [familyLinks])

  const onCreate = async () => {
    const result = await createFamily({ nome, residencia, observacoes, nomeDoPai, nomeDaMae })
    if (!result?.ok) return
    setOpen(false)
    setNome('')
    setResidencia('')
    setNomeDoPai('')
    setNomeDaMae('')
    setObservacoes('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Famílias</div>
            <div className="mt-1 text-xs text-gray-500">Associação membro↔família é guardada externamente.</div>
          </div>
          <Button variant="primary" onClick={() => setOpen(true)}>
            Criar família
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Residência</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Membros</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {families.map((f) => (
              <tr key={f.familyId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.nome || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{f.residencia || '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone="blue">{counts.get(f.familyId) ?? 0}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <Link to={`/familias/${encodeURIComponent(f.familyId)}`}>
                      <Button>Ver</Button>
                    </Link>
                    <Button variant="danger" onClick={() => deleteFamily(f.familyId)}>
                      Remover
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {families.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                  Sem famílias ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title="Criar família"
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={onCreate} disabled={!nome.trim()}>
              Criar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Família Manjate" />
          <Input label="Residência" value={residencia} onChange={setResidencia} placeholder="Ex.: Tsalala" />
          <Input label="Nome do Pai (opcional)" value={nomeDoPai} onChange={setNomeDoPai} />
          <Input label="Nome da Mãe (opcional)" value={nomeDaMae} onChange={setNomeDaMae} />
          <div className="sm:col-span-2">
            <Textarea label="Observações" value={observacoes} onChange={setObservacoes} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
