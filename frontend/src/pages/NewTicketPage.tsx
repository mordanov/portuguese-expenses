import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import UploadStep from '../components/tickets/UploadStep'
import ReviewStep, { type ReviewData } from '../components/tickets/ReviewStep'
import AllocateStep, { type AllocationMap } from '../components/tickets/AllocateStep'
import ConfirmStep from '../components/tickets/ConfirmStep'
import type { OCRDraft } from '../api/tickets'

const STEPS = ['upload', 'review', 'allocate', 'confirm'] as const
type Step = typeof STEPS[number]

function toReviewData(draft: OCRDraft): ReviewData {
  return {
    store_name: draft.store_name,
    purchased_at: draft.purchased_at.slice(0, 10),
    paid_by_id: '',
    discount_total: draft.discount_total,
    items: draft.items,
  }
}

const EMPTY_REVIEW: ReviewData = {
  store_name: '',
  purchased_at: new Date().toISOString().slice(0, 10),
  paid_by_id: '',
  discount_total: '0.00',
  items: [{ name: '', price: '0.00', category_id: null }],
}

export default function NewTicketPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('upload')
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [allocations, setAllocations] = useState<AllocationMap>({})

  function handleUploadSuccess(draft: OCRDraft) {
    setReviewData(toReviewData(draft))
    setStep('review')
  }

  function handleManualEntry() {
    setReviewData(EMPTY_REVIEW)
    setStep('review')
  }

  function canAdvanceFromReview(): boolean {
    if (!reviewData) return false
    return Boolean(reviewData.store_name && reviewData.purchased_at && reviewData.paid_by_id)
  }

  function canAdvanceFromAllocate(): boolean {
    if (!reviewData) return false
    return reviewData.items.every((_, idx) => (allocations[idx]?.length ?? 0) > 0)
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('tickets.new')}</h1>

      <div className="flex items-center mb-8">
        {STEPS.map((s, idx) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                idx < stepIndex
                  ? 'bg-pt-green text-white'
                  : idx === stepIndex
                  ? 'bg-pt-gold text-pt-green ring-2 ring-pt-green'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <span className="text-xs">{idx + 1}</span>
              {t(`wizard.steps.${s}`)}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 ${idx < stepIndex ? 'bg-pt-green' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="mb-8">
        {step === 'upload' && <UploadStep onSuccess={handleUploadSuccess} onManual={handleManualEntry} />}
        {step === 'review' && reviewData && (
          <ReviewStep data={reviewData} onChange={setReviewData} />
        )}
        {step === 'allocate' && reviewData && (
          <AllocateStep items={reviewData.items} allocations={allocations} onChange={setAllocations} />
        )}
        {step === 'confirm' && reviewData && (
          <ConfirmStep reviewData={reviewData} allocations={allocations} />
        )}
      </div>

      {step !== 'upload' && step !== 'confirm' && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep(STEPS[stepIndex - 1]!)}
            className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            disabled={step === 'review' ? !canAdvanceFromReview() : !canAdvanceFromAllocate()}
            onClick={() => setStep(STEPS[stepIndex + 1]!)}
            className="px-5 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  )
}
