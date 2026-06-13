import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTicket, useUpdateTicket, useDeleteTicket, useUpdateItem, useReplaceAllocations, useAddItem, type TicketItem } from '../api/tickets'
import { useMembers } from '../api/members'
import { useCategories } from '../api/categories'
import MoneyDisplay from '../components/shared/MoneyDisplay'
import { isAdmin } from '../api/auth'

function itemTranslation(item: TicketItem, lang: string): string | null {
  if (lang === 'ru') return item.translation_ru
  if (lang === 'pt') return item.translation_pt
  return item.translation_en
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const admin = isAdmin()

  const { data: ticket, isLoading } = useTicket(id ?? '')
  const { data: membersData } = useMembers({ active_only: true })
  const { data: categoriesData } = useCategories()
  const { mutateAsync: updateTicket, isPending: savingHeader } = useUpdateTicket()
  const { mutateAsync: updateItem } = useUpdateItem(id ?? '')
  const { mutateAsync: replaceAllocations } = useReplaceAllocations(id ?? '')
  const { mutateAsync: addItem, isPending: addingItem } = useAddItem(id ?? '')
  const { mutateAsync: deleteTicket } = useDeleteTicket()

  const [editing, setEditing] = useState(false)

  // Header edit state
  const [storeName, setStoreName] = useState('')
  const [purchasedAt, setPurchasedAt] = useState('')
  const [paidById, setPaidById] = useState('')
  const [discountTotal, setDiscountTotal] = useState('')

  // Per-item edit state: itemId → { name, price, categoryId, memberIds }
  type ItemEdit = { name: string; price: string; categoryId: string; memberIds: string[] }
  const [itemEdits, setItemEdits] = useState<Record<string, ItemEdit>>({})

  // New item form (visible in both view and edit mode)
  const [newItem, setNewItem] = useState<ItemEdit | null>(null)

  function startNewItem() {
    setNewItem({ name: '', price: '0.00', categoryId: '', memberIds: [] })
  }

  async function saveNewItem() {
    if (!newItem || newItem.memberIds.length === 0) return
    await addItem({
      name: newItem.name,
      price: newItem.price,
      categoryId: newItem.categoryId || null,
      memberIds: newItem.memberIds,
    })
    setNewItem(null)
  }

  function enterEdit() {
    if (!ticket) return
    setStoreName(ticket.store_name)
    setPurchasedAt(ticket.purchased_at.slice(0, 10))
    setPaidById(ticket.paid_by.id)
    setDiscountTotal(ticket.discount_total)
    const edits: Record<string, ItemEdit> = {}
    for (const item of ticket.items) {
      edits[item.id] = {
        name: item.name,
        price: item.price,
        categoryId: item.category?.id ?? '',
        memberIds: item.allocated_members.map((m) => m.id),
      }
    }
    setItemEdits(edits)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function saveAll() {
    if (!ticket) return
    await updateTicket({
      id: ticket.id,
      data: {
        store_name: storeName,
        purchased_at: purchasedAt,
        paid_by_id: paidById,
        total_price: Object.values(itemEdits)
          .reduce((sum, e) => sum + Math.round(parseFloat(e.price || '0') * 100), 0) / 100
          + '' ,
        discount_total: discountTotal,
      },
    })
    await Promise.all(
      ticket.items.map((item) => {
        const e = itemEdits[item.id]
        if (!e) return Promise.resolve()
        return Promise.all([
          updateItem({
            itemId: item.id,
            name: e.name,
            price: e.price,
            categoryId: e.categoryId || null,
          }),
          e.memberIds.length > 0
            ? replaceAllocations({ itemId: item.id, memberIds: e.memberIds })
            : Promise.resolve(),
        ])
      })
    )
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm(t('tickets.confirmDeleteDesc'))) return
    await deleteTicket(ticket!.id)
    navigate('/tickets')
  }

  function toggleMember(itemId: string, memberId: string) {
    setItemEdits((prev) => {
      const cur = prev[itemId]
      if (!cur) return prev
      const has = cur.memberIds.includes(memberId)
      return {
        ...prev,
        [itemId]: {
          ...cur,
          memberIds: has ? cur.memberIds.filter((m) => m !== memberId) : [...cur.memberIds, memberId],
        },
      }
    })
  }

  if (isLoading) return <p className="text-gray-500">{t('common.loading')}</p>
  if (!ticket) return <p className="text-gray-500">{t('common.error')}</p>

  const members = membersData?.items ?? []
  const categories = categoriesData?.items ?? []

  const totalCents = ticket.items.reduce(
    (sum, item) => sum + Math.round(parseFloat(item.price) * 100),
    0,
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {editing ? (
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-pt-green"
              />
            ) : (
              ticket.store_name
            )}
          </h1>
          {!editing && <p className="text-gray-500 text-sm">{ticket.purchased_at.slice(0, 10)}</p>}
        </div>
        {admin && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={saveAll}
                  disabled={savingHeader}
                  className="px-3 py-1.5 text-sm bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
                >
                  {savingHeader ? t('confirm.saving') : t('common.save')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={enterEdit}
                  className="px-3 py-1.5 text-sm border border-pt-green text-pt-green rounded-lg hover:bg-green-50 transition-colors"
                >
                  {t('tickets.edit')}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {t('tickets.delete')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ticket header fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-4">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          {editing ? (
            <>
              <span className="text-gray-500 self-center">{t('review.date')}</span>
              <input
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pt-green"
              />
              <span className="text-gray-500 self-center">{t('tickets.payer')}</span>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pt-green"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <span className="text-gray-500 self-center">{t('review.discount')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pt-green"
              />
              {ticket.raw_image_url && (
                <>
                  <span className="text-gray-500 self-center">{t('tickets.receipt')}</span>
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}${ticket.raw_image_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pt-green hover:underline text-sm font-medium"
                  >
                    {t('tickets.viewReceipt')}
                  </a>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-gray-500">{t('tickets.payer')}</span>
              <span className="font-medium">{ticket.paid_by.name}</span>
              <span className="text-gray-500">{t('tickets.total')}</span>
              <MoneyDisplay amount={(totalCents / 100).toFixed(2)} className="font-bold text-pt-green" />
              {parseFloat(ticket.discount_total) > 0 && (
                <>
                  <span className="text-gray-500">{t('review.discount')}</span>
                  <MoneyDisplay amount={ticket.discount_total} className="text-green-600" />
                </>
              )}
              {ticket.raw_image_url && (
                <>
                  <span className="text-gray-500">{t('tickets.receipt')}</span>
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}${ticket.raw_image_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pt-green hover:underline text-sm font-medium"
                  >
                    {t('tickets.viewReceipt')}
                  </a>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {editing ? (
          <div className="divide-y divide-gray-100">
            {ticket.items.map((item) => {
              const e = itemEdits[item.id]
              if (!e) return null
              const trans = itemTranslation(item, i18n.language)
              return (
                <div key={item.id} className="p-4 space-y-3">
                  {/* Name + price row */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                    <input
                      value={e.name}
                      onChange={(ev) => setItemEdits((p) => ({ ...p, [item.id]: { ...e, name: ev.target.value } }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                      placeholder={t('review.name')}
                    />
                    {trans && trans !== item.name && (
                      <p className="text-xs text-gray-400 mt-0.5 px-1">{trans}</p>
                    )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={e.price}
                      onChange={(ev) => setItemEdits((p) => ({ ...p, [item.id]: { ...e, price: ev.target.value } }))}
                      className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-pt-green"
                      placeholder={t('review.price')}
                    />
                  </div>
                  {/* Category */}
                  <select
                    value={e.categoryId}
                    onChange={(ev) => setItemEdits((p) => ({ ...p, [item.id]: { ...e, categoryId: ev.target.value } }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                  >
                    <option value="">{t('review.noCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {/* Member allocation chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const selected = e.memberIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMember(item.id, m.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            selected
                              ? 'bg-pt-green text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {m.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('review.name')}</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('review.category')}</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('allocate.selectMembers')}</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('review.price')}</th>
              </tr>
            </thead>
            <tbody>
              {ticket.items.map((item) => {
                const trans = itemTranslation(item, i18n.language)
                return (
                <tr key={item.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <span>{item.name}</span>
                    {trans && trans !== item.name && (
                      <span className="block text-xs text-gray-400 mt-0.5">{trans}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.category.color }} />
                        {item.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t('review.noCategory')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {item.allocated_members.map((m) => (
                        <span key={m.id} className="px-2 py-0.5 bg-pt-green/10 text-pt-green rounded-full text-xs">{m.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MoneyDisplay amount={item.discounted_price} className="font-medium" />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add new item */}
      {newItem ? (
        <div className="bg-white border border-pt-green rounded-xl p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{t('review.addItem')}</h3>
          <div className="flex gap-2">
            <input
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
              placeholder={t('review.name')}
              autoFocus
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-pt-green"
              placeholder={t('review.price')}
            />
          </div>
          <select
            value={newItem.categoryId}
            onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
          >
            <option value="">{t('review.noCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">{t('allocate.selectMembers')}</p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const selected = newItem.memberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setNewItem({
                      ...newItem,
                      memberIds: selected
                        ? newItem.memberIds.filter((id) => id !== m.id)
                        : [...newItem.memberIds, m.id],
                    })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selected ? 'bg-pt-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
            {newItem.memberIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">{t('allocate.noMembersSelected')}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewItem(null)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={saveNewItem}
              disabled={addingItem || !newItem.name || newItem.memberIds.length === 0}
              className="px-3 py-1.5 text-sm bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
            >
              {addingItem ? t('confirm.saving') : t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startNewItem}
          className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-pt-green hover:text-pt-green transition-colors"
        >
          + {t('review.addItem')}
        </button>
      )}
    </div>
  )
}
