import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../context/AppDataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { deriveSacraments } from '../lib/derive/deriveSacraments.js'

function pct(numerator, denominator) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

export function Dashboard() {
  const { members, families, activity } = useAppData()
  const { currentUser } = useAuth()

  const stats = useMemo(() => {
    const total = members.length
    let baptismo = 0
    let crisma = 0
    let casamento = 0
    for (const m of members) {
      const s = deriveSacraments(m)
      if (s.baptismo) baptismo += 1
      if (s.crisma) crisma += 1
      if (s.casamento) casamento += 1
    }
    return { total, baptismo, crisma, casamento }
  }, [members])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Bem-vindo</div>
            <div className="mt-1 text-sm text-gray-600">
              Gestão de membros e famílias, importação de listas, pré-preenchimento por OCR e geração de certificados.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/membros/novo">
              <Button variant="primary">Novo membro</Button>
            </Link>
            <Link to="/membros/importar">
              <Button>Importar CSV</Button>
            </Link>
            <Link to="/membros/ocr">
              <Button>Digitalização (OCR)</Button>
            </Link>
            {currentUser?.role === 'super_admin' || currentUser?.role === 'chefe_nucleo' ? (
              <Link to="/nucleos">
                <Button>Núcleos</Button>
              </Link>
            ) : null}
            {currentUser?.role === 'secretario' || currentUser?.role === 'super_admin' ? (
              <Link to="/certificados">
                <Button>Certificados</Button>
              </Link>
            ) : null}
            {currentUser?.role === 'chefe_nucleo' ? (
              <Link to="/solicitar-certificado">
                <Button>Solicitar certificado</Button>
              </Link>
            ) : null}
            {currentUser?.role === 'chefe_nucleo' ? (
              <Link to="/integracoes/whatsapp">
                <Button>WhatsApp (API)</Button>
              </Link>
            ) : null}
            {currentUser?.role === 'super_admin' ? (
              <Link to="/utilizadores">
                <Button>Utilizadores</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Total de membros" value={stats.total} subtitle="Guardado no seu navegador (local)" />
        <Card
          title="% com baptismo"
          value={`${pct(stats.baptismo, stats.total)}%`}
          subtitle={`${stats.baptismo} com Data de Baptismo`}
        />
        <Card
          title="% com crisma"
          value={`${pct(stats.crisma, stats.total)}%`}
          subtitle={`${stats.crisma} com Data do Crisma`}
        />
        <Card
          title="% com casamento"
          value={`${pct(stats.casamento, stats.total)}%`}
          subtitle={`${stats.casamento} com Data do Casamento`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Atividades recentes</div>
            <Badge tone="gray">{activity.length} registos</Badge>
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {activity.slice(0, 12).map((a) => (
              <div key={`${a.at}-${a.type}`} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="text-sm text-gray-900">{a.message}</div>
                  <div className="text-xs text-gray-500">{new Date(a.at).toLocaleString()}</div>
                </div>
                <Badge tone="blue">{a.type}</Badge>
              </div>
            ))}
            {activity.length === 0 ? <div className="py-8 text-sm text-gray-500">Sem atividades ainda.</div> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Famílias</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{families.length}</div>
          <div className="mt-1 text-xs text-gray-500">Agrupamento de membros por família.</div>
        </div>
      </div>
    </div>
  )
}
