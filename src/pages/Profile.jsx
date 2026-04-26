import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

export function Profile() {
  const { currentUser, roleLabel, changeMyPassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const onChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!newPassword || newPassword.length < 4) {
      setError('A palavra-passe deve ter pelo menos 4 caracteres.')
      return
    }
    if (newPassword !== confirm) {
      setError('A confirmação não coincide.')
      return
    }

    setBusy(true)
    try {
      const res = await changeMyPassword({ currentPassword, newPassword })
      if (!res.ok) {
        setError(res.error || 'Falha ao alterar palavra-passe.')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setNotice('Palavra-passe atualizada.')
    } finally {
      setBusy(false)
    }
  }

  if (!currentUser) return null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Perfil</div>
            <div className="mt-1 text-sm text-gray-600">Dados da sua conta e segurança.</div>
          </div>
          <Badge tone={currentUser.role === 'super_admin' ? 'purple' : 'blue'}>{roleLabel(currentUser.role)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900">Conta</div>
            {currentUser.role === 'super_admin' ? (
              <Link to="/utilizadores" className="text-sm font-medium text-indigo-700 hover:underline">
                Gestão de utilizadores
              </Link>
            ) : null}
          </div>

          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <div>
              <span className="text-gray-500">Nome:</span> {currentUser.name || '—'}
            </div>
            <div>
              <span className="text-gray-500">Utilizador:</span> {currentUser.username}
            </div>
            <div>
              <span className="text-gray-500">Último acesso:</span>{' '}
              {currentUser.lastLoginAt ? new Date(currentUser.lastLoginAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>

        <form onSubmit={onChangePassword} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Alterar palavra-passe</div>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Palavra-passe atual</div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Nova palavra-passe</div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Confirmar nova palavra-passe</div>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {notice ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {notice}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

