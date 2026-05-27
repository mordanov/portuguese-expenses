import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../api/categories'
import { isAxiosError } from 'axios'

const categorySchema = z.object({
  name: z.string().min(1, 'nameRequired'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'colorRequired'),
})
type CategoryFormData = z.infer<typeof categorySchema>

export default function CategoriesPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useCategories()
  const { mutateAsync: createCategory } = useCreateCategory()
  const { mutateAsync: updateCategory } = useUpdateCategory()
  const { mutateAsync: deleteCategory } = useDeleteCategory()
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { color: '#808080' },
  })

  async function onAdd(data: CategoryFormData) {
    setAddError(null)
    try {
      await createCategory(data)
      reset({ color: '#808080' })
    } catch {
      setAddError(t('common.error'))
    }
  }

  async function saveEdit(id: string) {
    await updateCategory({ id, name: editName, color: editColor })
    setEditId(null)
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    try {
      await deleteCategory(id)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setDeleteError(t('categories.deleteBlocked'))
      } else {
        setDeleteError(t('common.error'))
      }
    }
  }

  const categories = data?.items ?? []

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('categories.title')}</h1>

      <form onSubmit={handleSubmit(onAdd)} className="flex gap-3 mb-6 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">{t('categories.name')}</label>
          <input
            {...register('name')}
            type="text"
            placeholder={t('categories.namePlaceholder')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
          />
          {errors.name && <p className="text-red-600 text-xs mt-1">{t('categories.nameRequired')}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('categories.color')}</label>
          <input {...register('color')} type="color" className="h-10 w-12 rounded border border-gray-300 cursor-pointer" />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
        >
          {t('categories.add')}
        </button>
      </form>
      {addError && <p className="text-red-600 text-xs mb-4">{addError}</p>}
      {deleteError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">{deleteError}</p>}

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: cat.color }} />
              {editId === cat.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pt-green"
                    autoFocus
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-10 rounded border border-gray-300 cursor-pointer"
                  />
                </div>
              ) : (
                <span className="font-medium text-gray-800">{cat.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editId === cat.id ? (
                <>
                  <button onClick={() => saveEdit(cat.id)} className="text-sm text-pt-green font-medium hover:text-green-800">{t('common.save')}</button>
                  <button onClick={() => setEditId(null)} className="text-sm text-gray-400 hover:text-gray-600">{t('common.cancel')}</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditColor(cat.color) }} className="text-sm text-gray-500 hover:text-pt-green">{t('categories.edit')}</button>
                  <button onClick={() => handleDelete(cat.id)} className="text-sm text-red-500 hover:text-red-700">{t('categories.delete')}</button>
                </>
              )}
            </div>
          </div>
        ))}
        {!isLoading && categories.length === 0 && (
          <p className="text-gray-500 text-center py-8">{t('categories.empty')}</p>
        )}
      </div>
    </div>
  )
}
