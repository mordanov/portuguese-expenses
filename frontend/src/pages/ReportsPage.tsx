import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSummaryReport, useItemizedReport, useCategoryReport } from '../api/reports'
import { useMembers } from '../api/members'
import SummaryTable from '../components/reports/SummaryTable'
import CategoryPieChart from '../components/reports/CategoryPieChart'
import MoneyDisplay from '../components/shared/MoneyDisplay'
import DateRangePicker from '../components/shared/DateRangePicker'

type Tab = 'summary' | 'itemized' | 'categories'

export default function ReportsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('summary')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [memberId, setMemberId] = useState('')

  const { data: membersData } = useMembers()
  const { data: summary } = useSummaryReport({ date_from: dateFrom, date_to: dateTo })
  const { data: itemized } = useItemizedReport({ date_from: dateFrom, date_to: dateTo, member_id: memberId })
  const { data: categories } = useCategoryReport({ date_from: dateFrom, date_to: dateTo })

  const TABS: Tab[] = ['summary', 'itemized', 'categories']

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('reports.title')}</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            fromLabel={t('reports.dateFrom')}
            toLabel={t('reports.dateTo')}
          />
          {tab === 'itemized' && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">{t('reports.itemized.selectMember')}</label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
              >
                <option value="">—</option>
                {(membersData?.items ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

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

      {tab === 'summary' && <SummaryTable rows={summary ?? []} />}

      {tab === 'itemized' && (
        <div>
          {!memberId && <p className="text-gray-500 text-center py-8">{t('reports.itemized.selectMember')}</p>}
          {memberId && (!itemized || itemized.length === 0) && (
            <p className="text-gray-500 text-center py-8">{t('reports.itemized.empty')}</p>
          )}
          {memberId && itemized && itemized.length > 0 && (
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

      {tab === 'categories' && <CategoryPieChart rows={categories ?? []} />}
    </div>
  )
}
