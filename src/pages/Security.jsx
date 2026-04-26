import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

export function Security() {
  const { currentUser, changeMyPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const mustChangePassword = currentUser?.mustChangePassword === true
  const nextPath = location.state?.from || '/'

  const onChangePassword = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!currentPassword) {
      setError('Informe a palavra-passe atual.')
      return
    }
    if (!newPassword || newPassword.length < 4) {
      setError('A nova palavra-passe deve ter pelo menos 4 caracteres.')
      return
    }
    if (newPassword !== confirm) {
      setError('A confirmacao nao coincide.')
      return
    }

    setBusy(true)
    try {
      const result = await changeMyPassword({ currentPassword, newPassword })
      if (!result.ok) {
        setError(result.error || 'Falha ao alterar palavra-passe.')
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setNotice('Palavra-passe atualizada com sucesso.')
      if (mustChangePassword) {
        window.setTimeout(() => navigate(nextPath, { replace: true }), 500)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!currentUser) return null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Seguranca</div>
            <div className="mt-1 text-sm text-gray-600">Palavra-passe, acesso inicial e higiene basica da conta.</div>
          </div>
          <Badge tone={mustChangePassword ? 'yellow' : 'green'}>
            {mustChangePassword ? 'Troca obrigatoria' : 'Conta protegida'}
          </Badge>
        </div>
      </div>

      {mustChangePassword ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 shadow-sm">
          Esta e uma senha temporaria. Troque-a antes de continuar a usar o sistema.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form onSubmit={onChangePassword} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Alterar palavra-passe</div>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Palavra-passe atual</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </label>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Nova palavra-passe</div>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </label>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Confirmar nova palavra-passe</div>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </label>

          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div> : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Boas praticas</div>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <div>Use uma senha diferente da inicial e evite reutilizar senhas de outros sistemas.</div>
            <div>Se a secretaria lhe repor a senha, volte aqui assim que entrar.</div>
            <div>Evite partilhar credenciais entre gestores do mesmo nucleo.</div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/perfil">
              <Button>Ver perfil</Button>
            </Link>
            {!mustChangePassword ? (
              <Button onClick={() => navigate(nextPath || '/', { replace: true })}>Voltar</Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
