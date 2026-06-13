import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMembers, useCreateMember, useUpdateMember, useDeactivateMember, type Member } from '../api/members'
import { isAxiosError } from 'axios'
import { isAdmin } from '../api/auth'

const addSchema = z.object({
  name: z.string().min(2, 'nameMinLength').max(100),
})
type AddFormData = z.infer<typeof addSchema>

interface EditModalProps {
  member: Member
  onClose: () => void
}

function EditModal({ member, onClose }: EditModalProps) {
  const { t } = useTranslation()
  const { mutateAsync: updateMember } = useUpdateMember()
  const { mutateAsync: deactivateMember } = useDeactivateMember()

  const [name, setName] = useState(member.name)
  const [canPay, setCanPay] = useState(member.can_pay)
  const [isKid, setIsKid] = useState(member.is_kid)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCanPayChange(val: boolean) {
    setCanPay(val)
    if (val) setIsKid(false)
  }

  function handleIsKidChange(val: boolean) {
    setIsKid(val)
    if (val) setCanPay(false)
  }

  async function handleSave() {
    if (name.trim().length < 2) return
    setSaving(true)
    setError(null)
    try {
      await updateMember({ id: member.id, name: name.trim(), can_pay: canPay, is_kid: isKid })
      onClose()
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError(t('members.alreadyExists'))
      } else {
        setError(t('common.error'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    await deactivateMember(member.id)
    onClose()
  }

  async function handleActivate() {
    await updateMember({ id: member.id, is_active: true })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="font-semibold text-gray-800 mb-4">{t('members.editTitle')}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('members.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={canPay}
                onChange={(e) => handleCanPayChange(e.target.checked)}
                className="w-4 h-4 accent-pt-green"
              />
              <span className="text-sm text-gray-700">{t('members.canPay')}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isKid}
                onChange={(e) => handleIsKidChange(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-sm text-gray-700">{t('members.kid')}</span>
            </label>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>

        <div className="flex items-center justify-between mt-6">
          <div>
            {member.is_active ? (
              <button
                onClick={() => setConfirmDeactivate(true)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                {t('members.deactivate')}
              </button>
            ) : (
              <button
                onClick={handleActivate}
                className="text-sm text-pt-green hover:text-green-800"
              >
                {t('members.activate')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || name.trim().length < 2}
              className="px-4 py-2 bg-pt-green text-white rounded-lg text-sm hover:bg-green-800 disabled:opacity-60"
            >
              {saving ? '…' : t('members.save')}
            </button>
          </div>
        </div>
      </div>

      {confirmDeactivate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-gray-800 mb-2">{t('members.confirmDeactivate')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('members.confirmDeactivateDesc')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeactivate(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeactivate}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('members.deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MembersPage() {
  const { t } = useTranslation()
  const admin = isAdmin()
  const { data, isLoading } = useMembers()
  const { mutateAsync: createMember } = useCreateMember()
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddFormData>({
    resolver: zodResolver(addSchema),
  })

  async function onAdd(data: AddFormData) {
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

  const members = data?.items ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('members.title')}</h1>

      {admin && (
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
      )}

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${member.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className={`font-medium ${member.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                {member.name}
              </span>
              <span className="text-xs text-gray-400">
                {member.is_active ? t('members.active') : t('members.inactive')}
              </span>
            </div>
            {admin && (
              <button
                onClick={() => setEditMember(member)}
                className="text-sm text-gray-500 hover:text-pt-green transition-colors"
              >
                {t('members.edit')}
              </button>
            )}
          </div>
        ))}
        {!isLoading && members.length === 0 && (
          <p className="text-gray-500 text-center py-8">{t('members.empty')}</p>
        )}
      </div>

      {editMember && (
        <EditModal member={editMember} onClose={() => setEditMember(null)} />
      )}
    </div>
  )
}
