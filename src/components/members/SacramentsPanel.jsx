import { useState } from 'react'
import { Badge } from '../ui/Badge.jsx'
import { Button } from '../ui/Button.jsx'
import { Modal } from '../ui/Modal.jsx'
import { Input, Select } from '../ui/Form.jsx'
import { buildCertificatePrefillFromMember } from '../../lib/certificates/certificateHtml.js'
import { readApiError } from '../../lib/api/http.js'

const SACRAMENTS = [
  {
    key: 'baptismo',
    label: 'Baptismo',
    certType: 'batismo',
    dateField: 'Data de Baptismo',
    accent: 'green',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6m0 0c-3 0-5 2.2-5 5a5 5 0 0010 0c0-2.8-2-5-5-5zM9 21h6" />
    ),
  },
  {
    key: 'crisma',
    label: 'Crisma',
    certType: 'crisma',
    dateField: 'Data do Crisma',
    accent: 'blue',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 5 5.6.5-4.3 3.7 1.3 5.5L12 14l-5 2.7 1.3-5.5L4 7.5 9.6 7 12 2z" />
      </>
    ),
  },
  {
    key: 'casamento',
    label: 'Casamento',
    certType: 'casamento',
    dateField: 'Data do Casamento',
    accent: 'purple',
    icon: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14a4 4 0 108 0M8 14V8a4 4 0 018 0v6" />
        <circle cx="8" cy="18" r="2" />
        <circle cx="16" cy="18" r="2" />
      </>
    ),
  },
]

function StatusDot({ active }) {
  return <span className={`inline-flex h-2 w-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
}

function SacramentIcon({ children, accent, active }) {
  const tones = {
    green: active ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600',
    blue: active ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600',
    purple: active ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600',
  }
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${tones[accent]}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">{children}</svg>
    </div>
  )
}

function buildCasamentoPayload(member) {
  const base = buildCertificatePrefillFromMember({ type: 'casamento', member })
  const papel = member?._casamento_papel || 'noivo'
  const memberName = member?.['Nome Completo'] || ''
  const conjuge = member?._casamento_conjuge || ''
  const conjugePai = member?._casamento_conjuge_pai || ''
  const conjugeMae = member?._casamento_conjuge_mae || ''
  const conjugeNoivo = papel === 'noiva'
  return {
    ...base,
    folha: member?._casamento_numero_assento ? String(member._casamento_numero_assento).split('/')[0] : base.folha,
    numero_registo: member?._casamento_numero_assento || base.numero_registo,
    nome_noivo: conjugeNoivo ? conjuge : memberName,
    nome_noiva: conjugeNoivo ? memberName : conjuge,
    pai_noivo: conjugeNoivo ? conjugePai : member?.['Nome do Pai'] || '',
    mae_noivo: conjugeNoivo ? conjugeMae : member?.['Nome da Mae'] || '',
    pai_noiva: conjugeNoivo ? member?.['Nome do Pai'] || '' : conjugePai,
    mae_noiva: conjugeNoivo ? member?.['Nome da Mae'] || '' : conjugeMae,
    nome_oficiante: member?._casamento_oficiante || base.nome_oficiante,
    nome_testemunha_1: member?._casamento_testemunha_1 || base.nome_testemunha_1,
    nome_testemunha_2: member?._casamento_testemunha_2 || base.nome_testemunha_2,
  }
}

function buildBaptismoPayload(member) {
  return buildCertificatePrefillFromMember({ type: 'batismo', member })
}

function buildCrismaPayload(member) {
  const base = buildCertificatePrefillFromMember({ type: 'crisma', member })
  return {
    ...base,
    numero_assento: member?._crisma_numero_assento || base.numero_assento,
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function SacramentsPanel({ member, memberKey, updateMemberByKey, authFetch, addLog }) {
  const [openKey, setOpenKey] = useState('')
  const [draft, setDraft] = useState({})
  const [busyCert, setBusyCert] = useState('')
  const [error, setError] = useState('')

  const open = (key) => {
    setOpenKey(key)
    setError('')
    if (key === 'baptismo') {
      setDraft({
        data: member?.['Data de Baptismo'] || '',
        numero_assento: member?.['Numero do Assento'] || '',
        nome_padrinho: member?.['Nome do Padrinho'] || '',
        nome_madrinha: member?.['Nome da Madrinha'] || '',
      })
    } else if (key === 'crisma') {
      setDraft({
        data: member?.['Data do Crisma'] || '',
        numero_assento: member?._crisma_numero_assento || '',
      })
    } else if (key === 'casamento') {
      setDraft({
        data: member?.['Data do Casamento'] || '',
        numero_assento: member?._casamento_numero_assento || '',
        papel: member?._casamento_papel || 'noivo',
        conjuge: member?._casamento_conjuge || '',
        conjuge_pai: member?._casamento_conjuge_pai || '',
        conjuge_mae: member?._casamento_conjuge_mae || '',
        oficiante: member?._casamento_oficiante || '',
        testemunha_1: member?._casamento_testemunha_1 || '',
        testemunha_2: member?._casamento_testemunha_2 || '',
      })
    }
  }

  const close = () => { setOpenKey(''); setDraft({}); setError('') }

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    const next = { ...member }
    if (openKey === 'baptismo') {
      next['Data de Baptismo'] = draft.data || ''
      next['Numero do Assento'] = draft.numero_assento || next['Numero do Assento'] || ''
      if (draft.nome_padrinho) next['Nome do Padrinho'] = draft.nome_padrinho
      if (draft.nome_madrinha) next['Nome da Madrinha'] = draft.nome_madrinha
    } else if (openKey === 'crisma') {
      next['Data do Crisma'] = draft.data || ''
      next._crisma_numero_assento = draft.numero_assento || ''
    } else if (openKey === 'casamento') {
      next['Data do Casamento'] = draft.data || ''
      next._casamento_numero_assento = draft.numero_assento || ''
      next._casamento_papel = draft.papel || 'noivo'
      next._casamento_conjuge = draft.conjuge || ''
      next._casamento_conjuge_pai = draft.conjuge_pai || ''
      next._casamento_conjuge_mae = draft.conjuge_mae || ''
      next._casamento_oficiante = draft.oficiante || ''
      next._casamento_testemunha_1 = draft.testemunha_1 || ''
      next._casamento_testemunha_2 = draft.testemunha_2 || ''
    }
    updateMemberByKey(memberKey, next)
    addLog?.(`sacr_${openKey}`, `Sacramento ${openKey} actualizado.`, { memberKey })
    close()
  }

  const generate = async (sacr) => {
    if (!authFetch) {
      setError('Geração indisponível neste contexto.')
      return
    }
    setBusyCert(sacr.key)
    setError('')
    try {
      const data =
        sacr.certType === 'casamento' ? buildCasamentoPayload(member) :
        sacr.certType === 'batismo' ? buildBaptismoPayload(member) :
        buildCrismaPayload(member)
      const response = await authFetch('/api/certificates/generate', {
        method: 'POST',
        body: JSON.stringify({ type: sacr.certType, format: 'pdf', data, memberKey }),
      })
      if (!response.ok) throw new Error(await readApiError(response))
      const blob = await response.blob()
      const slug = String(member?.['Nome Completo'] || 'membro').toLowerCase().replace(/[^a-z0-9]+/g, '_')
      downloadBlob(blob, `certidao_${sacr.certType}_${slug}.pdf`)
      addLog?.(`cert_${sacr.certType}_pdf`, 'Certidão gerada via painel de sacramentos.', { memberKey })
    } catch (err) {
      setError(err?.message || 'Falha ao gerar certificado.')
    } finally {
      setBusyCert('')
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">Sacramentos</div>
          <div className="mt-0.5 text-xs text-gray-500">Registar, actualizar e gerar a certidão correspondente.</div>
        </div>
        <Badge tone="blue">3 sacramentos</Badge>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 slide-up">{error}</div>
      ) : null}

      <div className="mt-4 space-y-3">
        {SACRAMENTS.map((s) => {
          const date = member?.[s.dateField] || ''
          const active = Boolean(date)
          const numero = s.key === 'baptismo' ? member?.['Numero do Assento'] :
                         s.key === 'crisma' ? member?._crisma_numero_assento :
                         member?._casamento_numero_assento
          return (
            <div key={s.key} className={`group flex items-center gap-3 rounded-2xl border p-3 ring-1 ring-inset transition hover:shadow-sm ${active ? 'border-gray-200 bg-white ring-gray-200' : 'border-gray-200 bg-gray-50/60 ring-gray-200'}`}>
              <SacramentIcon accent={s.accent} active={active}>{s.icon}</SacramentIcon>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <StatusDot active={active} />
                  {s.label}
                  {active ? <Badge tone={s.accent}>registado</Badge> : <Badge tone="gray">por registar</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-gray-500">
                  {active ? (
                    <>Data: <span className="text-gray-700">{date}</span>{numero ? <> · Assento: <span className="text-gray-700">{numero}</span></> : null}</>
                  ) : 'Sem registo. Clique em "Registar" para adicionar.'}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button onClick={() => open(s.key)}>{active ? 'Editar' : 'Registar'}</Button>
                <Button
                  variant="primary"
                  disabled={!active || busyCert === s.key}
                  loading={busyCert === s.key}
                  onClick={() => generate(s)}
                >
                  Gerar
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAIS */}
      <Modal
        open={openKey === 'baptismo'}
        title="Registar Baptismo"
        onClose={close}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Data do baptismo" value={draft.data || ''} onChange={(v) => set('data', v)} placeholder="YYYY-MM-DD" />
          <Input label="Número do assento (ex: 147/2014)" value={draft.numero_assento || ''} onChange={(v) => set('numero_assento', v)} />
          <Input label="Nome do padrinho" value={draft.nome_padrinho || ''} onChange={(v) => set('nome_padrinho', v)} />
          <Input label="Nome da madrinha" value={draft.nome_madrinha || ''} onChange={(v) => set('nome_madrinha', v)} />
        </div>
      </Modal>

      <Modal
        open={openKey === 'crisma'}
        title="Registar Crisma"
        onClose={close}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Data do crisma" value={draft.data || ''} onChange={(v) => set('data', v)} placeholder="YYYY-MM-DD" />
          <Input label="Número do assento" value={draft.numero_assento || ''} onChange={(v) => set('numero_assento', v)} />
        </div>
      </Modal>

      <Modal
        open={openKey === 'casamento'}
        title="Registar Casamento"
        onClose={close}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Guardar</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Data do casamento" value={draft.data || ''} onChange={(v) => set('data', v)} placeholder="YYYY-MM-DD" />
          <Input label="Número do assento (ex: 22/2024)" value={draft.numero_assento || ''} onChange={(v) => set('numero_assento', v)} />
          <Select
            label="Papel deste membro"
            value={draft.papel || 'noivo'}
            onChange={(v) => set('papel', v)}
            options={[
              { value: 'noivo', label: 'Noivo' },
              { value: 'noiva', label: 'Noiva' },
            ]}
          />
          <Input label="Nome do cônjuge" value={draft.conjuge || ''} onChange={(v) => set('conjuge', v)} />
          <Input label="Pai do cônjuge" value={draft.conjuge_pai || ''} onChange={(v) => set('conjuge_pai', v)} />
          <Input label="Mãe do cônjuge" value={draft.conjuge_mae || ''} onChange={(v) => set('conjuge_mae', v)} />
          <Input label="Oficiante" value={draft.oficiante || ''} onChange={(v) => set('oficiante', v)} />
          <Input label="Testemunha 1" value={draft.testemunha_1 || ''} onChange={(v) => set('testemunha_1', v)} />
          <Input label="Testemunha 2" value={draft.testemunha_2 || ''} onChange={(v) => set('testemunha_2', v)} />
        </div>
      </Modal>
    </section>
  )
}
