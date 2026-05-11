import { NavLink } from 'react-router-dom'
import { useMemo } from 'react'
import logo from '../../img/logo.png'
import { useAuth } from '../../context/AuthContext.jsx'
import { Badge } from '../ui/Badge.jsx'

const baseNav = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/membros', label: 'Membros', icon: 'users' },
  { to: '/membros/novo', label: 'Novo membro', icon: 'user-plus' },
  { to: '/membros/importar', label: 'Importar CSV', icon: 'upload' },
  { to: '/membros/ocr', label: 'Digitalização (OCR)', icon: 'scan' },
  { to: '/nucleos', label: 'Núcleos', icon: 'nucleo' },
  { to: '/actividades', label: 'Actividades', icon: 'calendar' },
  { to: '/visitas-familiares', label: 'Visitas familiares', icon: 'visit' },
  { to: '/contribuicoes', label: 'Contribuições', icon: 'coins' },
  { to: '/cargos', label: 'Cargos', icon: 'briefcase' },
  { to: '/certificados', label: 'Certificados', icon: 'certificate' },
  { to: '/solicitar-certificado', label: 'Solicitar certificado', icon: 'certificate' },
  { to: '/servicos-paroquiais', label: 'Serviços', icon: 'services' },
  { to: '/integracoes/whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
  { to: '/familias', label: 'Famílias', icon: 'home-users' },
]

function Icon({ name, active }) {
  const cls = ['h-5 w-5 shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'].join(' ')
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H10v7H5a1 1 0 01-1-1V11z" />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    )
  }
  if (name === 'user-plus') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 8v6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M22 11h-6" />
      </svg>
    )
  }
  if (name === 'upload') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l-5-5-5 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
      </svg>
    )
  }
  if (name === 'scan') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3H5a2 2 0 00-2 2v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 3h2a2 2 0 012 2v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 17v2a2 2 0 01-2 2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17v2a2 2 0 002 2h2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
      </svg>
    )
  }
  if (name === 'certificate') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 15l2 2 4-4" />
      </svg>
    )
  }
  if (name === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5A8.5 8.5 0 116.2 4.4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 20l-1.5 3 3-1.2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5c1.5 3.5 3.9 5.9 7.4 7.4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.6 17.9l1.7-1.7a1 1 0 011.1-.2l1.9.8a1 1 0 01.6 1c-.2 1.3-1.4 2.2-2.8 2-3.7-.6-7.5-4.4-8.1-8.1-.2-1.4.7-2.6 2-2.8a1 1 0 011 .6l.8 1.9a1 1 0 01-.2 1.1l-1.7 1.7" />
      </svg>
    )
  }
  if (name === 'home-users') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l9-7 9 7v11a1 1 0 01-1 1h-6v-6H10v6H4a1 1 0 01-1-1V10z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13a3 3 0 016 0" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v3M16 2v3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9h18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h4M8 17h6" />
      </svg>
    )
  }
  if (name === 'coins') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
      </svg>
    )
  }
  if (name === 'briefcase') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4a2 2 0 012 2v2H8V6a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l4-2h10l4 2" />
      </svg>
    )
  }
  if (name === 'visit') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a2 2 0 100-4 2 2 0 000 4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15a3 3 0 016 0" />
      </svg>
    )
  }
  if (name === 'nucleo') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l9 7-9 7-9-7 9-7z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9v11l9 2 9-2V9" />
      </svg>
    )
  }
  if (name === 'services') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v4H3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18v4H3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17h18v4H3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 5h.01M7 12h.01M7 19h.01" />
      </svg>
    )
  }
  if (name === 'church') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M10 4h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-4 7 4v10a1 1 0 01-1 1H6a1 1 0 01-1-1V10z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6h6v6" />
      </svg>
    )
  }
  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a7.9 7.9 0 00.1-1l2-1.5-2-3.5-2.4.5a8.1 8.1 0 00-.8-.8l.5-2.4-3.5-2L12 4.6a7.9 7.9 0 00-1 0L9.5 2.6 6 4.6l.5 2.4a8.1 8.1 0 00-.8.8L3.3 7.3l-2 3.5L3.3 12a7.9 7.9 0 000 1L1.3 14.5l2 3.5 2.4-.5c.25.28.52.55.8.8l-.5 2.4 3.5 2L11 19.4c.33.03.67.03 1 0l1.5 2.4 3.5-2-.5-2.4c.28-.25.55-.52.8-.8l2.4.5 2-3.5L19.4 15z"
        />
      </svg>
    )
  }
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }
  return null
}

function Item({ to, label, icon, onClick, collapsed = false }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end={to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-inset transition-colors',
          collapsed ? 'justify-center' : '',
          isActive
            ? 'bg-indigo-600 text-white shadow-sm ring-indigo-600/20'
            : 'bg-white text-gray-700 ring-transparent hover:bg-gray-50 hover:ring-gray-200',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={icon} active={isActive} />
          <span
            className={[
              'truncate transition-[opacity,max-width] duration-200',
              collapsed ? 'pointer-events-none max-w-0 opacity-0' : 'max-w-[12rem] opacity-100',
            ].join(' ')}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ mobileOpen, onClose, collapsed = false, onToggleCollapsed }) {
  const { currentUser, roleLabel } = useAuth()
  const nav = useMemo(() => {
    const isNucleoManager = currentUser?.role === 'chefe_nucleo'
    const canSeeNucleos = currentUser?.role === 'super_admin' || isNucleoManager
    const items = baseNav.filter((n) => {
      if (n.to === '/nucleos') return canSeeNucleos
      if (n.to === '/actividades') return isNucleoManager
      if (n.to === '/visitas-familiares') return isNucleoManager
      if (n.to === '/contribuicoes') return isNucleoManager
      if (n.to === '/cargos') return isNucleoManager
      if (n.to === '/certificados') return currentUser?.role === 'secretario' || currentUser?.role === 'super_admin'
      if (n.to === '/solicitar-certificado') return isNucleoManager
      if (n.to === '/servicos-paroquiais') return currentUser?.role === 'super_admin' || currentUser?.role === 'secretario' || isNucleoManager
      if (n.to === '/integracoes/whatsapp') return isNucleoManager
      return true
    })
    if (currentUser?.role === 'super_admin') {
      items.push({ to: '/utilizadores', label: 'Utilizadores', icon: 'shield' })
      items.push({ to: '/auditoria/eliminados', label: 'Eliminados', icon: 'shield' })
      items.push({ to: '/paroquia-settings', label: 'Config. Paróquia', icon: 'church' })
    }
    items.push({ to: '/perfil', label: 'Perfil', icon: 'settings' })
    items.push({ to: '/seguranca', label: 'Seguranca', icon: 'shield' })
    return items
  }, [currentUser?.role])

  return (
    <>
      <div className={['fixed inset-0 z-40 lg:hidden', mobileOpen ? '' : 'pointer-events-none'].join(' ')}>
        <div
          className={[
            'absolute inset-0 bg-gray-900/50 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={onClose}
        />
        <div
          className={[
            'absolute left-0 top-0 h-full w-72 bg-gradient-to-b from-white to-gray-50 shadow-xl transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
            <img src={logo} alt="Logo" className="h-10 w-10 rounded-2xl ring-1 ring-black/5" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">Paróquia</div>
              <div className="truncate text-xs text-gray-500">Gestão Paroquial</div>
            </div>
          </div>
          <div className="space-y-1 p-4">
            {nav.map((n) => (
              <Item key={n.to} to={n.to} label={n.label} icon={n.icon} onClick={onClose} />
            ))}
          </div>
          {currentUser ? (
            <div className="mt-auto border-t border-gray-200 p-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-inset ring-gray-200">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
                  {(currentUser.name || currentUser.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{currentUser.name || currentUser.username}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{roleLabel(currentUser.role)}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={[
          'hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:flex-col',
          'transition-[width] duration-300 ease-out',
          collapsed ? 'lg:w-20' : 'lg:w-72',
        ].join(' ')}
      >
        <div
          className={[
            'group/sidebar relative flex grow flex-col gap-y-5 overflow-y-auto overflow-x-hidden',
            'border-r border-gray-200 bg-gradient-to-b from-white to-gray-50 pb-4',
            collapsed ? 'px-3' : 'px-6',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="absolute right-2 top-3 z-10 rounded-lg bg-white p-1.5 text-gray-500 ring-1 ring-inset ring-gray-200 shadow-sm transition hover:bg-gray-50 hover:text-gray-700"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
            </svg>
          </button>

          <div className="flex h-16 shrink-0 items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-10 shrink-0 rounded-2xl ring-1 ring-black/5" />
            <div
              className={[
                'min-w-0 transition-[opacity,max-width] duration-200',
                collapsed ? 'pointer-events-none max-w-0 opacity-0' : 'max-w-[12rem] opacity-100',
              ].join(' ')}
            >
              <div className="truncate text-sm font-semibold text-gray-900">Paróquia</div>
              <div className="truncate text-xs text-gray-500">Gestão Paroquial</div>
            </div>
          </div>
          <nav className="flex flex-1 flex-col space-y-1">
            {nav.map((n) => (
              <Item key={n.to} to={n.to} label={n.label} icon={n.icon} collapsed={collapsed} />
            ))}
          </nav>

          {currentUser && !collapsed ? (
            <div className="mt-2 rounded-2xl bg-white px-3 py-3 ring-1 ring-inset ring-gray-200">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{currentUser.name || currentUser.username}</div>
                  <div className="mt-0.5 truncate text-xs text-gray-500">{currentUser.username}</div>
                </div>
                <Badge tone={currentUser.role === 'super_admin' ? 'purple' : 'blue'}>{roleLabel(currentUser.role)}</Badge>
              </div>
            </div>
          ) : null}
          {currentUser && collapsed ? (
            <div className="mt-2 flex justify-center" title={currentUser.name || currentUser.username}>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
                {(currentUser.name || currentUser.username || '?').slice(0, 1).toUpperCase()}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
