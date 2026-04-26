import { Link, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppDataContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'
import { resolveMemberKey } from '../lib/memberKeys.js'

function scoreSuggestion(member, family) {
  const familyRes = normalizeForKey(family?.residencia)
  const memberRes = normalizeForKey(member?.Residencia)
  const scoreRes =
    familyRes && memberRes ? (memberRes === familyRes ? 3 : memberRes.includes(familyRes) || familyRes.includes(memberRes) ? 2 : 0) : 0

  const familyPai = normalizeForKey(family?.nomeDoPai)
  const memberPai = normalizeForKey(member?.['Nome do Pai'])
  const scorePai = familyPai && memberPai && familyPai === memberPai ? 2 : 0

  const familyMae = normalizeForKey(family?.nomeDaMae)
  const memberMae = normalizeForKey(member?.['Nome da Mae'])
  const scoreMae = familyMae && memberMae && familyMae === memberMae ? 2 : 0

  return scoreRes + scorePai + scoreMae
}

export function FamilyDetail() {
  const { familyId: familyIdParam } = useParams()
  const familyId = decodeURIComponent(familyIdParam ?? '')

  const { families, members, familyLinks, linkMemberToFamily, unlinkMemberFromFamily } = useAppData()
  const family = useMemo(() => families.find((f) => f.familyId === familyId), [families, familyId])

  const linked = useMemo(() => {
    const links = familyLinks.filter((l) => l.familyId === familyId)
    const membersByKey = new Map(members.map((m) => [resolveMemberKey(m), m]))
    return links
      .map((l) => ({ link: l, member: membersByKey.get(l.memberKey) }))
      .filter((x) => Boolean(x.member))
  }, [familyId, familyLinks, members])

  const linkedKeys = useMemo(() => new Set(linked.map((x) => x.link.memberKey)), [linked])
  const [search, setSearch] = useState('')

  const suggestions = useMemo(() => {
    const q = normalizeForKey(search)
    const scored = []
    for (const m of members) {
      const key = resolveMemberKey(m)
      if (linkedKeys.has(key)) continue
      const s = scoreSuggestion(m, family)
      if (q) {
        const hay = normalizeForKey(`${m?.['Nome Completo'] ?? ''} ${m?.Residencia ?? ''} ${m?.Comunidade ?? ''}`)
        if (!hay.includes(q)) continue
      } else if (s <= 0) {
        continue
      }
      scored.push({ key, member: m, score: s })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 15)
  }, [family, linkedKeys, members, search])

  if (!family) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-900">Família não encontrada</div>
        <div className="mt-2">
          <Link to="/familias">
            <Button>Voltar</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">{family.nome || family.familyId}</div>
            <div className="mt-1 text-xs text-gray-500">{family.residencia || ''}</div>
          </div>
          <Link to="/familias">
            <Button>Voltar</Button>
          </Link>
        </div>
        {family.observacoes ? <div className="mt-4 text-sm text-gray-700">{family.observacoes}</div> : null}
        {family.nomeDoPai || family.nomeDaMae ? (
          <div className="mt-3 text-xs text-gray-500">
            {family.nomeDoPai ? `Pai: ${family.nomeDoPai}` : null}
            {family.nomeDoPai && family.nomeDaMae ? ' · ' : null}
            {family.nomeDaMae ? `Mãe: ${family.nomeDaMae}` : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Membros associados</div>
            <Badge tone="blue">{linked.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {linked.map(({ member, link }) => (
              <div key={link.memberKey} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{member?.['Nome Completo'] || '—'}</div>
                  <div className="text-xs text-gray-500">{link.relacao || member?.Residencia || ''}</div>
                </div>
                <Button variant="danger" onClick={() => unlinkMemberFromFamily({ familyId, memberKey: link.memberKey })}>
                  Remover
                </Button>
              </div>
            ))}
            {linked.length === 0 ? <div className="text-sm text-gray-500">Sem membros associados.</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Sugestões</div>
          <div className="mt-1 text-xs text-gray-500">Match por residência (campo "Residencia").</div>
          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Pesquisar (opcional)</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, residência, comunidade…"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <div className="mt-4 space-y-2">
            {suggestions.map(({ key, member, score }) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{member?.['Nome Completo'] || '—'}</div>
                  <div className="text-xs text-gray-500">
                    {normalizeValue(member?.Residencia) || '—'} · score {score}
                  </div>
                </div>
                <Button variant="primary" onClick={() => linkMemberToFamily({ familyId, memberKey: key })}>
                  Associar
                </Button>
              </div>
            ))}
            {suggestions.length === 0 ? <div className="text-sm text-gray-500">Sem sugestões.</div> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
