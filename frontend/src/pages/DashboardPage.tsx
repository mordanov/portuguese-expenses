import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTickets } from '../api/tickets'
import { useBalances } from '../api/balances'
import { useMembers } from '../api/members'
import MoneyDisplay from '../components/shared/MoneyDisplay'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { data: ticketsData, isLoading: ticketsLoading } = useTickets({ page_size: 5 })
  const { data: balances, isLoading: balancesLoading } = useBalances()
  const { data: membersData } = useMembers()

  const recentTickets = ticketsData?.items ?? []
  const totalTickets = ticketsData?.total ?? 0
  const outstandingBalances = balances ?? []
  const members = membersData?.items ?? []

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
          ) : outstandingBalances.length === 0 ? (
            <p className="text-pt-green font-semibold">{t('dashboard.noBalances')}</p>
          ) : (
            <p className="text-3xl font-bold text-pt-red">{outstandingBalances.length}</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">{t('members.title')}</p>
          <p className="text-3xl font-bold text-gray-700">
            {members.filter((m) => m.is_active).length}
          </p>
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
            {recentTickets.map((ticket) => {
              return (
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
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">{t('dashboard.outstandingBalance')}</h2>
            <Link to="/balances" className="text-sm text-pt-green hover:text-green-800">{t('dashboard.viewAll')}</Link>
          </div>
          {balancesLoading && <p className="text-gray-500">{t('common.loading')}</p>}
          {!balancesLoading && outstandingBalances.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-3xl mb-2">✅</div>
              <p>{t('dashboard.noBalances')}</p>
            </div>
          )}
          <div className="space-y-2">
            {outstandingBalances.slice(0, 5).map((b, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{b.debtor_name}</span>{' '}
                  <span className="text-gray-400">{t('balances.owes')}</span>{' '}
                  <span className="font-medium">{b.creditor_name}</span>
                </p>
                <MoneyDisplay amount={b.amount} className="font-semibold text-pt-red text-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
