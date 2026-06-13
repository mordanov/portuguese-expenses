import { useTranslation } from 'react-i18next'
import MemberChip from '../shared/MemberChip'
import MoneyDisplay from '../shared/MoneyDisplay'
import { useMembers } from '../../api/members'
import type { OCRItem } from '../../api/tickets'

export interface AllocationMap {
  [itemIndex: number]: string[]
}

interface AllocateStepProps {
  items: OCRItem[]
  allocations: AllocationMap
  onChange: (allocations: AllocationMap) => void
}

export default function AllocateStep({ items, allocations, onChange }: AllocateStepProps) {
  const { t, i18n } = useTranslation()
  const { data: membersData } = useMembers({ active_only: true })
  const members = membersData?.items ?? []

  const adults = members.filter((m) => !m.is_kid)
  const kids = members.filter((m) => m.is_kid)

  function toggleMember(itemIdx: number, memberId: string) {
    const current = allocations[itemIdx] ?? []
    const next = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]
    onChange({ ...allocations, [itemIdx]: next })
  }

  function selectGroup(itemIdx: number, group: 'all' | 'adults' | 'kids') {
    const ids =
      group === 'all' ? members.map((m) => m.id) :
      group === 'adults' ? adults.map((m) => m.id) :
      kids.map((m) => m.id)
    onChange({ ...allocations, [itemIdx]: ids })
  }

  function getTranslation(item: OCRItem): string | null {
    const lang = i18n.language
    const val = lang === 'ru' ? item.translation_ru : lang === 'pt' ? item.translation_pt : item.translation_en
    return val && val !== item.name ? val : null
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {items.map((item, idx) => {
        const selected = allocations[idx] ?? []
        const perMemberAmount = selected.length > 0
          ? (Math.round(parseFloat(item.price) * 100 / selected.length) / 100).toFixed(2)
          : '0.00'
        const trans = getTranslation(item)

        return (
          <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-gray-800">{item.name}</p>
                {trans && <p className="text-xs text-gray-400 mt-0.5">{trans}</p>}
                <MoneyDisplay amount={item.price} className="text-sm text-gray-500 mt-0.5" />
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => selectGroup(idx, 'all')}
                  className="text-xs text-pt-green hover:text-green-800 font-medium border border-pt-green rounded px-2 py-1"
                >
                  {t('allocate.selectAll')}
                </button>
                {adults.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectGroup(idx, 'adults')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-400 rounded px-2 py-1"
                  >
                    {t('allocate.adults')}
                  </button>
                )}
                {kids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => selectGroup(idx, 'kids')}
                    className="text-xs text-orange-500 hover:text-orange-700 font-medium border border-orange-400 rounded px-2 py-1"
                  >
                    {t('allocate.kids')}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-2">{t('allocate.selectMembers')}</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {members.map((m) => (
                <MemberChip
                  key={m.id}
                  name={m.name}
                  selected={selected.includes(m.id)}
                  onClick={() => toggleMember(idx, m.id)}
                />
              ))}
            </div>

            {selected.length > 0 && (
              <p className="text-xs text-gray-500">
                {t('allocate.memberCost')}: <span className="font-semibold text-pt-green">€{perMemberAmount}</span>{' '}
                {t('allocate.perMember')} ({selected.length} members)
              </p>
            )}

            {selected.length === 0 && (
              <p className="text-xs text-red-500">{t('allocate.noMembersSelected')}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
