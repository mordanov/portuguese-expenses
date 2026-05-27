import { useTranslation } from 'react-i18next'
import { useMembers } from '../../api/members'
import { useCategories } from '../../api/categories'
import type { OCRItem } from '../../api/tickets'

export interface ReviewData {
  store_name: string
  purchased_at: string
  paid_by_id: string
  discount_total: string
  items: OCRItem[]
}

interface ReviewStepProps {
  data: ReviewData
  onChange: (data: ReviewData) => void
}

export default function ReviewStep({ data, onChange }: ReviewStepProps) {
  const { t } = useTranslation()
  const { data: membersData } = useMembers({ active_only: true })
  const { data: categoriesData } = useCategories()

  const members = membersData?.items ?? []
  const categories = categoriesData?.items ?? []

  function updateField<K extends keyof ReviewData>(key: K, value: ReviewData[K]) {
    onChange({ ...data, [key]: value })
  }

  function updateItem(index: number, field: keyof OCRItem, value: string | null) {
    const items = [...data.items]
    items[index] = { ...items[index], [field]: value }
    onChange({ ...data, items })
  }

  function addItem() {
    onChange({
      ...data,
      items: [...data.items, { name: '', price: '0.00', category_id: null }],
    })
  }

  function removeItem(index: number) {
    const items = data.items.filter((_, i) => i !== index)
    onChange({ ...data, items })
  }

  const liveTotal = data.items.reduce((sum, item) => sum + Math.round(parseFloat(item.price || '0') * 100), 0)
  const liveTotalStr = (liveTotal / 100).toFixed(2)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('review.storeName')}</label>
          <input
            type="text"
            value={data.store_name}
            onChange={(e) => updateField('store_name', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('review.date')}</label>
          <input
            type="date"
            value={data.purchased_at}
            onChange={(e) => updateField('purchased_at', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('review.payer')}</label>
          <select
            value={data.paid_by_id}
            onChange={(e) => updateField('paid_by_id', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('review.discount')}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.discount_total}
            onChange={(e) => updateField('discount_total', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">{t('review.items')}</h3>
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-pt-green hover:text-green-800 font-medium"
          >
            + {t('review.addItem')}
          </button>
        </div>
        <div className="space-y-3">
          {data.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg bg-white">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(idx, 'name', e.target.value)}
                  placeholder={t('review.name')}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pt-green mb-1"
                />
                <select
                  value={item.category_id ?? ''}
                  onChange={(e) => updateItem(idx, 'category_id', e.target.value || null)}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pt-green"
                >
                  <option value="">{t('review.noCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-24 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(e) => updateItem(idx, 'price', e.target.value)}
                  placeholder={t('review.price')}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-pt-green"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-gray-400 hover:text-red-500 text-sm shrink-0 mt-1"
                aria-label="Remove item"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end text-sm font-medium text-gray-700">
        {t('review.total')}: <span className="ml-2 text-pt-green font-bold">€{liveTotalStr}</span>
      </div>
    </div>
  )
}
