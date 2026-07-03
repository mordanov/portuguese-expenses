import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUsers, useCreateUser, useUpdateUser, type AppUser } from '../api/users'
import { isAxiosError } from 'axios'

type ModalMode = { type: 'add' } | { type: 'edit'; user: AppUser }

export default function UsersPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useUsers()
  const { mutateAsync: createUser } = useCreateUser()
  const { mutateAsync: updateUser } = useUpdateUser()

  const [modal, setModal] = useState<ModalMode | null>(null)
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [confirmBlock, setConfirmBlock] = useState<AppUser | null>(null)


  function openAdd() {
    setFormUsername('')
    setFormPassword('')
    setFormRole('user')
    setFormError(null)
    setModal({ type: 'add' })
  }

  function openEdit(user: AppUser) {
    setFormUsername(user.username)
    setFormPassword('')
    setFormRole(user.role)
    setFormError(null)
    setModal({ type: 'edit', user })
  }

  function closeModal() {
    setModal(null)
    setFormError(null)
  }

  async function handleSave() {
    if (!formUsername.trim()) {
      setFormError(t('users.usernameRequired'))
      return
    }
    if (modal?.type === 'add' && !formPassword) {
      setFormError(t('users.passwordRequired'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      if (modal?.type === 'add') {
        await createUser({ username: formUsername.trim(), password: formPassword, role: formRole })
      } else if (modal?.type === 'edit') {
        await updateUser({
          id: modal.user.id,
          username: formUsername.trim(),
          password: formPassword || undefined,
          role: formRole,
        })
      }
      closeModal()
    } catch (err) {
      if (isAxiosError(err)) {
        if (err.response?.status === 409) {
          setFormError(t('users.usernameConflict'))
        } else if (err.response?.status === 400) {
          setFormError(err.response.data?.detail ?? t('common.error'))
        } else {
          setFormError(t('common.error'))
        }
      } else {
        setFormError(t('common.error'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleBlock(user: AppUser) {
    try {
      await updateUser({ id: user.id, is_active: !user.is_active })
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        alert(err.response.data?.detail ?? t('common.error'))
      }
    }
    setConfirmBlock(null)
  }

  const users = data?.items ?? []

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('users.title')}</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors font-medium"
        >
          + {t('users.add')}
        </button>
      </div>

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div>
                <p className={`font-medium ${user.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                  {user.username}
                </p>
                <p className="text-xs text-gray-400">
                  {user.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
                  {' · '}
                  {user.is_active ? t('users.active') : t('users.blocked')}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {t('users.lastLogin')}: {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleString()
                    : t('users.neverLoggedIn')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEdit(user)}
                className="text-sm text-gray-500 hover:text-pt-green"
              >
                {t('users.edit')}
              </button>
              {user.is_active ? (
                <button
                  onClick={() => setConfirmBlock(user)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  {t('users.block')}
                </button>
              ) : (
                <button
                  onClick={() => toggleBlock(user)}
                  className="text-sm text-green-600 hover:text-green-800"
                >
                  {t('users.unblock')}
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && users.length === 0 && (
          <p className="text-gray-500 text-center py-8">{t('users.empty')}</p>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-4">
              {modal.type === 'add' ? t('users.addTitle') : t('users.editTitle')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('users.username')}</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder={t('users.usernamePlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('users.password')}</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={modal.type === 'edit' ? t('users.passwordPlaceholder') : undefined}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('users.role')}</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as 'admin' | 'user')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                >
                  <option value="admin">{t('users.roleAdmin')}</option>
                  <option value="user">{t('users.roleUser')}</option>
                </select>
              </div>
            </div>

            {formError && <p className="text-red-600 text-xs mt-3">{formError}</p>}

            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                {t('users.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60 text-sm"
              >
                {saving ? t('common.loading') : t('users.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block confirmation modal */}
      {confirmBlock && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-2">{t('users.confirmBlock')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('users.confirmBlockDesc')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmBlock(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => toggleBlock(confirmBlock)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                {t('users.block')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
