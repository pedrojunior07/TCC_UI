import { Link, Navigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { findMemberByKey, resolveMemberKey } from '../lib/memberKeys.js'
import { CANONICAL_FIELDS, getFieldLabel } from '../lib/memberFields.js'
import { getAccessibleNucleos } from '../lib/nucleoAccess.js'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { MemberForm } from '../components/members/MemberForm.jsx'
import { SacramentsPanel } from '../components/members/SacramentsPanel.jsx'
import { Input, Select } from '../components/ui/Form.jsx'

export function MemberDetail() {
  const { memberKey: memberKeyParam } = useParams()
  const memberKey = decodeURIComponent(memberKeyParam ?? '')

  const { members, families, familyLinks, nucleos, linkMemberToFamily, unlinkMemberFromFamily, updateMemberByKey, addLog } = useAppData()
  const { currentUser, authFetch } = useAuth()

  const member = useMemo(() => findMemberByKey(members, memberKey), [memberKey, members])
  const resolvedMemberKey = useMemo(() => resolveMemberKey(member), [member])

  const canSeeMember = useMemo(() => {
    if (currentUser?.role !== 'chefe_nucleo') return true
    const accessible = getAccessibleNucleos({ currentUser, nucleos })
    const allowed = new Set()
    for (const n of accessible) {
      const keys = Array.isArray(n.memberKeys) ? n.memberKeys : []
      for (const k of keys) allowed.add(k)
    }
    return allowed.has(resolvedMemberKey || memberKey)
  }, [currentUser, memberKey, nucleos, resolvedMemberKey])

  const linkedFamilies = useMemo(() => {
    const links = familyLinks.filter((l) => l.memberKey === resolvedMemberKey || l.memberKey === memberKey)
    const map = new Map(families.map((f) => [f.familyId, f]))
    return links.map((l) => ({ link: l, family: map.get(l.familyId) })).filter((x) => Boolean(x.family))
  }, [families, familyLinks, memberKey, resolvedMemberKey])

  const [familyId, setFamilyId] = useState('')
  const [relacao, setRelacao] = useState('')

  const familyOptions = useMemo(
    () => [
      { value: '', label: 'Selecionar…' },
      ...families
        .slice()
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        .map((f) => ({ value: f.familyId, label: f.nome || f.familyId })),
    ],
    [families],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(null)

  if (!member) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Membro não encontrado</div>
        <div className="mt-2">
          <Link to="/membros">
            <Button>Voltar à lista</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!canSeeMember) return <Navigate to="/membros" replace />

  const onLink = () => {
    if (!familyId) return
    linkMemberToFamily({ familyId, memberKey: resolvedMemberKey || memberKey, relacao })
    setRelacao('')
  }

  const openEdit = () => {
    setDraft(member)
    setEditOpen(true)
  }

  const saveEdit = () => {
    updateMemberByKey(resolvedMemberKey || memberKey, draft)
    setEditOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">{member?.['Nome Completo'] || '—'}</div>
            <div className="mt-1 text-xs text-gray-500">{member?.Comunidade || ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openEdit}>Editar</Button>
            {currentUser?.role === 'chefe_nucleo' ? (
              <Link to={`/solicitar-certificado?memberKey=${encodeURIComponent(resolvedMemberKey || memberKey)}`}>
                <Button>Solicitar certificado</Button>
              </Link>
            ) : null}
            <Link to="/membros">
              <Button>Voltar</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Dados (colunas do CSV)</div>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CANONICAL_FIELDS.map((f) => (
              <div key={f} className="rounded-xl bg-gray-50 p-3">
                <dt className="text-xs font-medium text-gray-600">{getFieldLabel(f)}</dt>
                <dd className="mt-1 break-words text-sm text-gray-900">{member?.[f] || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="space-y-4">
          <SacramentsPanel
            member={member}
            memberKey={memberKey}
            updateMemberByKey={updateMemberByKey}
            authFetch={authFetch}
            addLog={addLog}
          />

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Família</div>
            <div className="mt-3 space-y-2">
              {linkedFamilies.map(({ family, link }) => (
                <div key={family.familyId} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{family.nome || family.familyId}</div>
                    <div className="text-xs text-gray-500">{link.relacao || family.residencia || ''}</div>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => unlinkMemberFromFamily({ familyId: family.familyId, memberKey: resolvedMemberKey || memberKey })}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              {linkedFamilies.length === 0 ? <div className="text-sm text-gray-500">Sem família associada.</div> : null}
            </div>

            <div className="mt-4 space-y-3">
              <Select label="Associar a família" value={familyId} onChange={setFamilyId} options={familyOptions} />
              <Input label="Relação (opcional)" value={relacao} onChange={setRelacao} placeholder="Ex.: Pai/Mãe/Filho…" />
              <Button variant="primary" onClick={onLink} disabled={!familyId}>
                Associar
              </Button>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={editOpen}
        title="Editar membro"
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveEdit}>
              Guardar
            </Button>
          </div>
        }
      >
        {draft ? <MemberForm value={draft} onChange={setDraft} /> : null}
      </Modal>
    </div>
  )
}
