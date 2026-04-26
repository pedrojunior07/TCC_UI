import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { FullSpinner } from '../components/ui/Spinner.jsx'
import logo from '../img/logo.png'

export function Login() {
  const { currentUser, login, bootstrap, requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const boot = await bootstrap()
      if (cancelled) return
      if (boot?.username && boot?.password) {
        setNotice(`Conta inicial criada: utilizador "${boot.username}" e palavra-passe "${boot.password}". Altere no perfil.`)
        setUsername(boot.username)
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [bootstrap])

  if (!ready) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <FullSpinner label="A preparar o sistema…" />
    </div>
  )
  if (currentUser) return <Navigate to="/" replace />

  const from = location.state?.from || '/'

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const res = await login({ username, password })
      if (!res.ok) {
        setError(res.error || 'Falha ao entrar.')
        return
      }
      navigate(from, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const missingUser = !username.trim()
  const missingPass = !password

  const onForgotPassword = async () => {
    setError('')
    setNotice('')
    if (!username.trim()) {
      setError('Informe o utilizador para pedir reposicao da senha.')
      return
    }

    setResetBusy(true)
    try {
      const result = await requestPasswordReset({ username })
      if (!result.ok) {
        setError(result.error || 'Falha ao registar o pedido.')
        return
      }
      setNotice(result.message || 'Pedido registado. Aguarde a reposicao da senha pela secretaria.')
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-12">
      {/* Bolhas de fundo subtis */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-purple-200/40 blur-3xl" />

      <div className="relative mx-auto w-full max-w-lg">
        <div className="flex flex-col items-center slide-up">
          <img src={logo} alt="Logo" className="h-20 w-20 rounded-3xl shadow-lg ring-1 ring-black/5 float-slow" />
          <div className="mt-4 text-lg font-semibold tracking-tight text-gray-900">Paróquia</div>
          <div className="text-sm text-gray-600">Sta. Teresinha do Menino Jesus · Moçambique</div>
        </div>

        <form
          onSubmit={onSubmit}
          className="slide-up mt-8 rounded-3xl border border-indigo-200 bg-white/90 p-8 shadow-xl shadow-indigo-600/5 ring-1 ring-indigo-600/10 backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-gray-900">Entrar</div>
              <div className="mt-1 text-sm text-gray-600">Bem-vindo. Inicie sessão para continuar.</div>
            </div>
            <Badge tone="blue">Acesso</Badge>
          </div>

          <div className="mt-6 space-y-3">
            <label className="block">
              <div className="mb-1 text-xs font-medium text-gray-600">Utilizador</div>
              <div className={[
                'flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 ring-1 ring-inset transition focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/20',
                error && missingUser ? 'border-red-400 ring-red-200 pulse-red' : 'border-gray-300 ring-transparent',
              ].join(' ')}>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="flex-1 border-0 bg-transparent p-0 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
                  placeholder="ex.: admin"
                />
              </div>
            </label>

            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
                <span>Palavra-passe</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={resetBusy}
                    className="text-xs font-semibold text-indigo-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {resetBusy ? 'A pedir reposicao...' : 'Esqueci a senha'}
                  </button>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    Mostrar
                  </label>
                </div>
              </div>
              <div className={[
                'flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 ring-1 ring-inset transition focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/20',
                error && missingPass ? 'border-red-400 ring-red-200 pulse-red' : 'border-gray-300 ring-transparent',
              ].join(' ')}>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="flex-1 border-0 bg-transparent p-0 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
                  placeholder="••••••••"
                />
              </div>
            </label>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 slide-up">{error}</div>
          ) : null}
          {notice ? (
            <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 slide-up">{notice}</div>
          ) : null}

          <div className="mt-6">
            <Button type="submit" variant="primary" loading={busy} className="h-12 w-full justify-center text-base">
              {busy ? 'A autenticar…' : 'Entrar'}
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Se perder a senha, informe o seu utilizador e use <span className="font-medium text-gray-900">Esqueci a senha</span>.
            A reposicao e feita pela secretaria ou pelo super admin.
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">Paróquia · Sistema de gestão</div>
      </div>
    </div>
  )
}
