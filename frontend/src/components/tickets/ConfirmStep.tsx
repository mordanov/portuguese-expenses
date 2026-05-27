import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCreateTicket } from '../../api/tickets'
import { useMembers } from '../../api/members'
import MoneyDisplay from '../shared/MoneyDisplay'
import type { ReviewData } from './ReviewStep'
import type { AllocationMap } from './AllocateStep'

interface ConfirmStepProps {
  reviewData: ReviewData
  allocations: AllocationMap
}

export default function ConfirmStep({ reviewData, allocations }: ConfirmStepProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: membersData } = useMembers({ active_only: true })
  const members = membersData?.items ?? []
  const { mutateAsync: createTicket, isPending, error } = useCreateTicket()

  const payerName = members.find((m) => m.id === reviewData.paid_by_id)?.name ?? '—'

  const perMemberCostsCents: Record<string, number> = {}
  reviewData.items.forEach((item, idx) => {
    const selected = allocations[idx] ?? []
    if (selected.length === 0) return
    const priceCents = Math.round(parseFloat(item.price) * 100)
    const shareCents = Math.round(priceCents / selected.length)
    selected.forEach((memberId) => {
      perMemberCostsCents[memberId] = (perMemberCostsCents[memberId] ?? 0) + shareCents
    })
  })

  async function handleConfirm() {
    const totalCents = reviewData.items.reduce(
      (sum, item) => sum + Math.round(parseFloat(item.price || '0') * 100),
      0,
    )
    const payload = {
      store_name: reviewData.store_name,
      purchased_at: reviewData.purchased_at,
      paid_by_id: reviewData.paid_by_id,
      total_price: (totalCents / 100).toFixed(2),
      discount_total: reviewData.discount_total,
      items: reviewData.items.map((item, idx) => ({
        name: item.name,
        price: item.price,
        category_id: item.category_id,
        member_ids: allocations[idx] ?? [],
      })),
    }
    await createTicket(payload)
    navigate('/tickets')
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">{t('confirm.summary')}</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">{t('confirm.store')}</span>
          <span className="font-medium">{reviewData.store_name}</span>
          <span className="text-gray-500">{t('confirm.date')}</span>
          <span className="font-medium">{reviewData.purchased_at}</span>
          <span className="text-gray-500">{t('confirm.payer')}</span>
          <span className="font-medium">{payerName}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">{t('confirm.items')}</h3>
        <div className="space-y-2">
          {reviewData.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">{item.name}</span>
              <MoneyDisplay amount={item.price} className="font-medium" />
            </div>
          ))}
          {parseFloat(reviewData.discount_total || '0') > 0 && (
            <div className="flex justify-between text-sm text-green-600 border-t pt-2 mt-2">
              <span>{t('review.discount')}</span>
              <span>-<MoneyDisplay amount={reviewData.discount_total} /></span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-3">{t('confirm.memberCosts')}</h3>
        <div className="space-y-2">
          {Object.entries(perMemberCostsCents).map(([memberId, cents]) => {
            const name = members.find((m) => m.id === memberId)?.name ?? memberId
            return (
              <div key={memberId} className="flex justify-between text-sm">
                <span className="text-gray-700">{name}</span>
                <MoneyDisplay amount={(cents / 100).toFixed(2)} className="font-medium" />
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {t('common.error')}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="w-full bg-pt-green text-white font-semibold py-3 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-60"
      >
        {isPending ? t('confirm.saving') : t('confirm.save')}
      </button>
    </div>
  )
}
