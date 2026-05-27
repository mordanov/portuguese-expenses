import { useTranslation } from 'react-i18next'
import MemberChip from '../shared/MemberChip'
import MoneyDisplay from '../shared/MoneyDisplay'
import { useMembers } from '../../api/members'

export interface AllocationMap {
  [itemIndex: number]: string[]
}

interface AllocateStepProps {
  items: Array<{ name: string; price: string }>
  allocations: AllocationMap
  onChange: (allocations: AllocationMap) => void
}

export default function AllocateStep({ items, allocations, onChange }: AllocateStepProps) {
  const { t } = useTranslation()
  const { data: membersData } = useMembers({ active_only: true })
  const members = membersData?.items ?? []

  function toggleMember(itemIdx: number, memberId: string) {
    const current = allocations[itemIdx] ?? []
    const next = current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]
    onChange({ ...allocations, [itemIdx]: next })
  }

  function selectAll(itemIdx: number) {
    onChange({ ...allocations, [itemIdx]: members.map((m) => m.id) })
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {items.map((item, idx) => {
        const selected = allocations[idx] ?? []
        const perMemberAmount = selected.length > 0
          ? (Math.round(parseFloat(item.price) * 100 / selected.length) / 100).toFixed(2)
          : '0.00'

        return (
          <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-800">{item.name}</p>
                <MoneyDisplay amount={item.price} className="text-sm text-gray-500" />
              </div>
              <button
                type="button"
                onClick={() => selectAll(idx)}
                className="text-xs text-pt-green hover:text-green-800 font-medium border border-pt-green rounded px-2 py-1"
              >
                {t('allocate.selectAll')}
              </button>
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
