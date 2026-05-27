import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTicket, useDeleteTicket } from '../api/tickets'
import { useMembers } from '../api/members'
import { useCategories } from '../api/categories'
import MoneyDisplay from '../components/shared/MoneyDisplay'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: ticket, isLoading } = useTicket(id ?? '')
  const { data: membersData } = useMembers()
  const { data: categoriesData } = useCategories()
  const { mutateAsync: deleteTicket } = useDeleteTicket()

  if (isLoading) return <p className="text-gray-500">{t('common.loading')}</p>
  if (!ticket) return <p className="text-gray-500">{t('common.error')}</p>

  const members = membersData?.items ?? []
  const categories = categoriesData?.items ?? []
  const payer = members.find((m) => m.id === ticket.paid_by_id)

  async function handleDelete() {
    if (!window.confirm(t('tickets.confirmDeleteDesc'))) return
    await deleteTicket(ticket!.id)
    navigate('/tickets')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{ticket.store_name}</h1>
          <p className="text-gray-500 text-sm">{ticket.purchased_at.slice(0, 10)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            {t('tickets.delete')}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">{t('tickets.payer')}</span>
          <span className="font-medium">{payer?.name ?? '—'}</span>
          <span className="text-gray-500">{t('tickets.total')}</span>
          <MoneyDisplay amount={ticket.total_price} className="font-bold text-pt-green" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('review.name')}</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('review.category')}</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('review.price')}</th>
            </tr>
          </thead>
          <tbody>
            {ticket.items.map((item) => {
              const cat = categories.find((c) => c.id === item.category_id)
              return (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">
                    {cat ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t('review.noCategory')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={item.discounted_price} className="font-medium" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
