import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSummaryReport, useItemizedReport, useCategoryReport } from '../api/reports'
import { useMembers } from '../api/members'
import SummaryTable from '../components/reports/SummaryTable'
import CategoryPieChart from '../components/reports/CategoryPieChart'
import MoneyDisplay from '../components/shared/MoneyDisplay'

type Tab = 'summary' | 'itemized' | 'categories'

function currentMonthRange() {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

const DEFAULT = currentMonthRange()

export default function ReportsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('summary')

  // Staged values (what the user is editing)
  const [fromInput, setFromInput] = useState(DEFAULT.from)
  const [toInput, setToInput] = useState(DEFAULT.to)
  const [memberInput, setMemberInput] = useState('')

  // Applied values (what the queries actually use)
  const [appliedFrom, setAppliedFrom] = useState(DEFAULT.from)
  const [appliedTo, setAppliedTo] = useState(DEFAULT.to)
  const [appliedMember, setAppliedMember] = useState('')

  function apply() {
    setAppliedFrom(fromInput)
    setAppliedTo(toInput)
    setAppliedMember(memberInput)
  }

  const { data: membersData } = useMembers()
  const { data: summary, isLoading: summaryLoading } = useSummaryReport({ from_date: appliedFrom, to_date: appliedTo })
  const { data: itemized, isLoading: itemizedLoading } = useItemizedReport({ from_date: appliedFrom, to_date: appliedTo, member_id: appliedMember })
  const { data: categories, isLoading: categoriesLoading } = useCategoryReport({ from_date: appliedFrom, to_date: appliedTo })

  const TABS: Tab[] = ['summary', 'itemized', 'categories']
  const loading = summaryLoading || itemizedLoading || categoriesLoading

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('reports.title')}</h1>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.dateFrom')}</label>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('reports.dateTo')}</label>
            <input
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
            />
          </div>
          {tab === 'itemized' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('reports.itemized.selectMember')}</label>
              <select
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
              >
                <option value="">—</option>
                {(membersData?.items ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={apply}
            className="px-4 py-1.5 bg-pt-green text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
          >
            {t('balances.apply')}
          </button>
        </div>
        {appliedFrom && appliedTo && (
          <p className="text-xs text-gray-400 mt-2">
            Showing: {appliedFrom} → {appliedTo}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t_) => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t_
                ? 'bg-pt-green text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:border-pt-green hover:text-pt-green'
            }`}
          >
            {t(`reports.tabs.${t_}`)}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">{t('common.loading')}</p>}

      {!loading && tab === 'summary' && (
        (!summary || summary.length === 0)
          ? <p className="text-gray-500 text-center py-8">{t('reports.summary.empty')}</p>
          : <SummaryTable rows={summary} />
      )}

      {!loading && tab === 'itemized' && (
        <div>
          {!appliedMember && (
            <p className="text-gray-500 text-center py-8">{t('reports.itemized.selectMember')}</p>
          )}
          {appliedMember && (!itemized || itemized.length === 0) && (
            <p className="text-gray-500 text-center py-8">{t('reports.itemized.empty')}</p>
          )}
          {appliedMember && itemized && itemized.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('tickets.store')}</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('review.name')}</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('tickets.date')}</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('review.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemized.map((row, idx) => (
                    <tr key={idx} className="border-t border-gray-100 bg-white">
                      <td className="px-4 py-3 text-gray-700">{row.store_name}</td>
                      <td className="px-4 py-3">{row.item_name}</td>
                      <td className="px-4 py-3 text-gray-500">{row.purchased_at.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-right">
                        <MoneyDisplay amount={row.discounted_price} className="font-medium" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'categories' && (
        (!categories || categories.length === 0)
          ? <p className="text-gray-500 text-center py-8">{t('reports.categories.empty')}</p>
          : <CategoryPieChart rows={categories} />
      )}
    </div>
  )
}
