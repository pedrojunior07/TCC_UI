import { Outlet, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'
import { RouteProgress } from './RouteProgress.jsx'
import { useLocalStorageState } from '../../lib/storage/useLocalStorageState.js'
import { STORAGE_KEYS } from '../../lib/storage/keys.js'

function titleFromPath(pathname) {
  if (pathname === '/') return 'Início'
  if (pathname.startsWith('/membros/importar')) return 'Importar CSV'
  if (pathname.startsWith('/membros/ocr')) return 'Digitalização (OCR)'
  if (pathname.startsWith('/membros/novo')) return 'Novo membro'
  if (pathname.startsWith('/membros/')) return 'Membro'
  if (pathname.startsWith('/membros')) return 'Membros'
  if (pathname.startsWith('/certificados')) return 'Certificados'
  if (pathname.startsWith('/solicitar-certificado')) return 'Solicitar certificado'
  if (pathname.startsWith('/integracoes/whatsapp')) return 'WhatsApp'
  if (pathname.startsWith('/nucleos/')) return 'Núcleo'
  if (pathname.startsWith('/nucleos')) return 'Núcleos'
  if (pathname.startsWith('/actividades/nova')) return 'Nova actividade'
  if (pathname.startsWith('/actividades/')) return 'Actividade'
  if (pathname.startsWith('/actividades')) return 'Actividades'
  if (pathname.startsWith('/visitas-familiares')) return 'Visitas familiares'
  if (pathname.startsWith('/contribuicoes')) return 'Contribuições'
  if (pathname.startsWith('/cargos')) return 'Cargos'
  if (pathname.startsWith('/auditoria/eliminados')) return 'Membros eliminados'
  if (pathname.startsWith('/seguranca')) return 'Seguranca'
  if (pathname.startsWith('/perfil')) return 'Perfil'
  if (pathname.startsWith('/utilizadores')) return 'Utilizadores'
  if (pathname.startsWith('/familias/')) return 'Família'
  if (pathname.startsWith('/familias')) return 'Famílias'
  return 'Paróquia'
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useLocalStorageState(STORAGE_KEYS.sidebarCollapsed, false)
  const location = useLocation()
  const title = useMemo(() => titleFromPath(location.pathname), [location.pathname])

  return (
    <div className="h-full">
      <RouteProgress />
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />
      <div className={`transition-[padding] duration-300 ease-out ${collapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        <Topbar
          title={title}
          onOpenSidebar={() => setMobileOpen(true)}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div key={location.pathname} className="page-fade">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
