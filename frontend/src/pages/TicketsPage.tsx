import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTickets } from '../api/tickets'
import { useMembers } from '../api/members'
import MoneyDisplay from '../components/shared/MoneyDisplay'
import DateRangePicker from '../components/shared/DateRangePicker'
import { isAdmin } from '../api/auth'

export default function TicketsPage() {
  const { t } = useTranslation()
  const admin = isAdmin()
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [memberId, setMemberId] = useState('')

  const { data: ticketsData, isLoading } = useTickets({
    page,
    page_size: 20,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    member_id: memberId || undefined,
  })
  const { data: membersData } = useMembers()

  const tickets = ticketsData?.items ?? []
  const total = ticketsData?.total ?? 0
  const pageSize = ticketsData?.page_size ?? 20

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('tickets.title')}</h1>
        {admin && (
          <Link
            to="/tickets/new"
            className="px-4 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors font-medium"
          >
            + {t('tickets.new')}
          </Link>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          fromLabel={t('tickets.filters.dateFrom')}
          toLabel={t('tickets.filters.dateTo')}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t('tickets.filters.member')}</label>
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
        <button
          onClick={() => { setDateFrom(''); setDateTo(''); setMemberId(''); setPage(1) }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {t('tickets.filters.clear')}
        </button>
      </div>

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      {!isLoading && tickets.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🧾</div>
          <p className="text-gray-500">{t('tickets.empty')}</p>
          <Link to="/tickets/new" className="mt-4 inline-block px-4 py-2 bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors">
            {t('tickets.new')}
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map((ticket) => {
          const payer = ticket.paid_by
          return (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-pt-green transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{ticket.store_name}</p>
                  <p className="text-sm text-gray-500">{ticket.purchased_at.slice(0, 10)}</p>
                  {payer && <p className="text-xs text-gray-400 mt-1">{t('tickets.payer')}: {payer.name}</p>}
                </div>
                <MoneyDisplay amount={ticket.total_price} className="text-lg font-bold text-pt-green" />
              </div>
            </Link>
          )
        })}
      </div>

      {total > pageSize && (
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40">
            ←
          </button>
          <span className="text-sm text-gray-500 py-1">{page} / {Math.ceil(total / pageSize)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / pageSize)} className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40">
            →
          </button>
        </div>
      )}
    </div>
  )
}
