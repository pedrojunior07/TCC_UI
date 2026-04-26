import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Badge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Modal } from '../components/ui/Modal.jsx'
import { normalizeForKey, normalizeValue } from '../lib/normalize.js'

function defaultDraft() {
  return { userId: '', username: '', name: '', role: 'secretario', password: '' }
}

export function Users() {
  const { users, currentUser, roleLabel, createUser, updateUser, setUserActive, resetUserPassword } = useAuth()
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState(defaultDraft())
  const isEdit = Boolean(draft.userId)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUserId, setResetUserId] = useState('')
  const [resetPwd, setResetPwd] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')

  const filtered = useMemo(() => {
    const q = normalizeForKey(query)
    if (!q) return users
    return users.filter((u) => normalizeForKey(`${u.username} ${u.name} ${u.role}`).includes(q))
  }, [query, users])

  const openCreate = () => {
    setError('')
    setNotice('')
    setDraft(defaultDraft())
    setEditOpen(true)
  }

  const openEdit = (u) => {
    setError('')
    setNotice('')
    setDraft({ userId: u.userId, username: u.username, name: u.name ?? '', role: u.role, password: '' })
    setEditOpen(true)
  }

  const saveUser = async () => {
    setError('')
    setNotice('')

    if (!draft.username.trim() && !isEdit) {
      setError('Informe um utilizador.')
      return
    }

    if (!draft.name.trim()) {
      setError('Informe o nome.')
      return
    }

    if (!isEdit && (!draft.password || draft.password.length < 4)) {
      setError('A palavra-passe deve ter pelo menos 4 caracteres.')
      return
    }

    const res = isEdit
      ? await updateUser({ userId: draft.userId, patch: { name: draft.name, role: draft.role } })
      : await createUser({ username: draft.username, name: draft.name, role: draft.role, password: draft.password })

    if (!res.ok) {
      setError(res.error || 'Falha ao guardar.')
      return
    }

    setEditOpen(false)
    setDraft(defaultDraft())
    setNotice(isEdit ? 'Utilizador atualizado.' : 'Utilizador criado.')
  }

  const toggleActive = async (u) => {
    setError('')
    setNotice('')
    const res = await setUserActive({ userId: u.userId, active: u.active === false })
    if (!res.ok) setError(res.error || 'Falha ao atualizar estado.')
  }

  const openReset = (u) => {
    setError('')
    setNotice('')
    setResetUserId(u.userId)
    setResetPwd('')
    setResetConfirm('')
    setResetOpen(true)
  }

  const confirmReset = async () => {
    setError('')
    setNotice('')
    if (!resetPwd || resetPwd.length < 4) {
      setError('A palavra-passe deve ter pelo menos 4 caracteres.')
      return
    }
    if (resetPwd !== resetConfirm) {
      setError('A confirmação não coincide.')
      return
    }
    const res = await resetUserPassword({ userId: resetUserId, newPassword: resetPwd })
    if (!res.ok) {
      setError(res.error || 'Falha ao repor palavra-passe.')
      return
    }
    setResetOpen(false)
    setNotice('Palavra-passe reposta.')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Utilizadores</div>
            <div className="mt-1 text-sm text-gray-600">Crie e administre contas de super admin e secretário.</div>
          </div>
          <Badge tone="purple">Super admin</Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block sm:max-w-sm">
            <div className="text-xs font-medium text-gray-600">Pesquisar</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, utilizador ou perfil..."
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <Button variant="primary" onClick={openCreate}>
              Novo utilizador
            </Button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {notice}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3">Utilizador</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.userId}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">{u.username}</div>
                      {currentUser?.userId === u.userId ? <Badge tone="blue">você</Badge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{normalizeValue(u.name) || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === 'super_admin' ? 'purple' : 'gray'}>{roleLabel(u.role)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active === false ? 'red' : 'green'}>{u.active === false ? 'inativo' : 'ativo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <Button onClick={() => openEdit(u)}>Editar</Button>
                      <Button onClick={() => openReset(u)}>Repor senha</Button>
                      <Button variant={u.active === false ? 'primary' : 'danger'} onClick={() => toggleActive(u)}>
                        {u.active === false ? 'Ativar' : 'Desativar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                    Sem utilizadores para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={editOpen}
        title={isEdit ? 'Editar utilizador' : 'Novo utilizador'}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={saveUser}>
              Guardar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="text-xs font-medium text-gray-600">Utilizador</div>
            <input
              value={draft.username}
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
              disabled={isEdit}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-gray-50 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>

          <label className="block">
            <div className="text-xs font-medium text-gray-600">Perfil</div>
            <select
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="secretario">Secretário</option>
              <option value="chefe_nucleo">Gestor do núcleo</option>
              <option value="super_admin">Super admin</option>
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <div className="text-xs font-medium text-gray-600">Nome</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        {!isEdit ? (
          <label className="mt-4 block">
            <div className="text-xs font-medium text-gray-600">Palavra-passe</div>
            <input
              type="password"
              value={draft.password}
              onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </label>
        ) : (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Para repor a palavra-passe, use “Repor senha” na lista.
          </div>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        title="Repor palavra-passe"
        onClose={() => setResetOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={confirmReset}>
              Repor
            </Button>
          </div>
        }
      >
        <label className="block">
          <div className="text-xs font-medium text-gray-600">Nova palavra-passe</div>
          <input
            type="password"
            value={resetPwd}
            onChange={(e) => setResetPwd(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="mt-4 block">
          <div className="text-xs font-medium text-gray-600">Confirmar</div>
          <input
            type="password"
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>
      </Modal>
    </div>
  )
}
