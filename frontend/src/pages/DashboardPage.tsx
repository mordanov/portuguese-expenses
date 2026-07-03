import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTickets } from '../api/tickets'
import { useBalances } from '../api/balances'
import { useMembers } from '../api/members'
import { useOffsetRules } from '../api/offsetRules'
import MoneyDisplay from '../components/shared/MoneyDisplay'
import { applyOffsets, rulesFromRecords } from '../utils/applyOffsets'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { data: ticketsData, isLoading: ticketsLoading } = useTickets({ page_size: 5 })
  const { data: balances, isLoading: balancesLoading } = useBalances()
  const { data: membersData } = useMembers()
  const { data: savedRules = [] } = useOffsetRules()

  const recentTickets = ticketsData?.items ?? []
  const totalTickets = ticketsData?.total ?? 0
  const members = membersData?.items ?? []

  const activeMembers = members.filter((m) => m.is_active)

  const rules = rulesFromRecords(savedRules)
  const computed = rules.length > 0
    ? applyOffsets(balances ?? [], rules, members)
    : (balances ?? [])

  // Build per-member owes/owed totals
  const owes = new Map<string, number>()   // debtor_id → total cents they owe
  const owed = new Map<string, number>()   // creditor_id → total cents owed to them
  for (const b of computed) {
    const cents = Math.round(parseFloat(b.amount) * 100)
    owes.set(b.debtor_id, (owes.get(b.debtor_id) ?? 0) + cents)
    owed.set(b.creditor_id, (owed.get(b.creditor_id) ?? 0) + cents)
  }

  const hasAnyBalance = computed.length > 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">{t('dashboard.totalTickets')}</p>
          <p className="text-3xl font-bold text-pt-green">{ticketsLoading ? '…' : totalTickets}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">{t('dashboard.outstandingBalance')}</p>
          {balancesLoading ? (
            <p className="text-gray-400">…</p>
          ) : !hasAnyBalance ? (
            <p className="text-pt-green font-semibold">{t('dashboard.noBalances')}</p>
          ) : (
            <p className="text-3xl font-bold text-pt-red">{computed.length}</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">{t('members.title')}</p>
          <p className="text-3xl font-bold text-gray-700">{activeMembers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">{t('dashboard.recentTickets')}</h2>
            <Link to="/tickets" className="text-sm text-pt-green hover:text-green-800">{t('dashboard.viewAll')}</Link>
          </div>
          {ticketsLoading && <p className="text-gray-500">{t('common.loading')}</p>}
          {!ticketsLoading && recentTickets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>{t('dashboard.noTickets')}</p>
              <Link to="/tickets/new" className="mt-2 inline-block text-sm text-pt-green hover:text-green-800">
                + {t('tickets.new')}
              </Link>
            </div>
          )}
          <div className="space-y-2">
            {recentTickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-pt-green transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-800 text-sm">{ticket.store_name}</p>
                  <p className="text-xs text-gray-400">{ticket.purchased_at.slice(0, 10)} · {ticket.paid_by.name}</p>
                </div>
                <MoneyDisplay amount={ticket.total_price} className="font-semibold text-pt-green text-sm" />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">{t('dashboard.outstandingBalance')}</h2>
            <Link to="/balances" className="text-sm text-pt-green hover:text-green-800">{t('dashboard.viewAll')}</Link>
          </div>
          {balancesLoading ? (
            <p className="text-gray-500">{t('common.loading')}</p>
          ) : activeMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('dashboard.noBalances')}</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('members.name')}</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('dashboard.owes')}</th>
                    <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('dashboard.owed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMembers.map((m) => {
                    const owesCents = owes.get(m.id) ?? 0
                    const owedCents = owed.get(m.id) ?? 0
                    return (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                        <td className="px-4 py-3 text-right">
                          {owesCents > 0
                            ? <span className="font-semibold text-pt-red">€{(owesCents / 100).toFixed(2)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {owedCents > 0
                            ? <span className="font-semibold text-pt-green">€{(owedCents / 100).toFixed(2)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
