import { Link } from 'react-router-dom'
import { Button } from '../ui/Button.jsx'
import { Badge } from '../ui/Badge.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import logo from '../../img/logo.png'

export function Topbar({ title, onOpenSidebar, collapsed, onToggleCollapsed }) {
  const { currentUser, roleLabel, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/70 backdrop-blur shadow-sm">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 lg:hidden"
            onClick={onOpenSidebar}
            aria-label="Abrir menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 lg:inline-flex"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src={logo} alt="Logo" className="hidden h-9 w-9 rounded-xl ring-1 ring-black/5 sm:block" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-gray-500">Paróquia</div>
            <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/membros/novo" className="hidden sm:block">
            <Button variant="primary">Novo membro</Button>
          </Link>

          {currentUser ? (
            <Link
              to="/perfil"
              className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50 sm:inline-flex"
              aria-label="Abrir perfil"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
                {(currentUser.name || currentUser.username || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden lg:block">
                <div className="max-w-[14rem] truncate font-medium text-gray-900">{currentUser.name || currentUser.username}</div>
                <div className="text-xs text-gray-500">{roleLabel(currentUser.role)}</div>
              </span>
              <Badge tone={currentUser.role === 'super_admin' ? 'purple' : 'blue'} className="lg:hidden">
                {roleLabel(currentUser.role)}
              </Badge>
            </Link>
          ) : null}

          <Button onClick={logout} className="gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 16l-4-4 4-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
            </svg>
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
