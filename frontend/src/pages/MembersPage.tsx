import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMembers, useCreateMember, useUpdateMember, useDeactivateMember } from '../api/members'
import { isAxiosError } from 'axios'

const memberSchema = z.object({
  name: z.string().min(2, 'nameMinLength').max(100),
})
type MemberFormData = z.infer<typeof memberSchema>

export default function MembersPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useMembers()
  const { mutateAsync: createMember } = useCreateMember()
  const { mutateAsync: updateMember } = useUpdateMember()
  const { mutateAsync: deactivateMember } = useDeactivateMember()
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  })

  async function onAdd(data: MemberFormData) {
    setAddError(null)
    try {
      await createMember(data.name)
      reset()
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setAddError(t('members.alreadyExists'))
      } else {
        setAddError(t('common.error'))
      }
    }
  }

  async function saveRename(id: string) {
    await updateMember({ id, name: editName })
    setEditId(null)
  }

  async function confirmDeactivateAction(id: string) {
    await deactivateMember(id)
    setConfirmDeactivate(null)
  }

  const members = data?.items ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('members.title')}</h1>

      <form onSubmit={handleSubmit(onAdd)} className="flex gap-3 mb-6">
        <div className="flex-1">
          <input
            {...register('name')}
            type="text"
            placeholder={t('members.namePlaceholder')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
          />
          {errors.name && (
            <p className="text-red-600 text-xs mt-1">{t(`members.${errors.name.message}`)}</p>
          )}
          {addError && <p className="text-red-600 text-xs mt-1">{addError}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {t('members.add')}
        </button>
      </form>

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              {editId === member.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pt-green"
                  autoFocus
                />
              ) : (
                <span className={`font-medium ${member.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                  {member.name}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {member.is_active ? t('members.active') : t('members.inactive')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {editId === member.id ? (
                <>
                  <button
                    onClick={() => saveRename(member.id)}
                    className="text-sm text-pt-green font-medium hover:text-green-800"
                  >
                    {t('members.save')}
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    {t('members.cancel')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setEditId(member.id); setEditName(member.name) }}
                    className="text-sm text-gray-500 hover:text-pt-green"
                  >
                    {t('members.rename')}
                  </button>
                  {member.is_active && (
                    <button
                      onClick={() => setConfirmDeactivate(member.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      {t('members.deactivate')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {!isLoading && members.length === 0 && (
          <p className="text-gray-500 text-center py-8">{t('members.empty')}</p>
        )}
      </div>

      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-2">{t('members.confirmDeactivate')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('members.confirmDeactivateDesc')}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeactivate(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button onClick={() => confirmDeactivateAction(confirmDeactivate)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                {t('members.deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
