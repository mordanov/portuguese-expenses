import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface SummaryRow {
  member_id: string
  member_name: string
  total: string
}

export interface ItemizedRow {
  ticket_id: string
  store_name: string
  purchased_at: string
  item_name: string
  discounted_price: string
}

export interface CategoryRow {
  category_id: string | null
  category_name: string
  total: string
  percentage: string
}

export interface PaymentReportRow {
  id: string
  payer_id: string
  payer_name: string
  payee_id: string
  payee_name: string
  amount: string
  paid_at: string
  note: string | null
}

export function useSummaryReport(params: { from_date: string; to_date: string }) {
  return useQuery({
    queryKey: ['reports', 'summary', params],
    queryFn: async () => {
      const response = await apiClient.get<{ members: { member: { id: string; name: string }; total: string }[] }>(
        '/reports/summary',
        { params },
      )
      return response.data.members.map((m): SummaryRow => ({
        member_id: m.member.id,
        member_name: m.member.name,
        total: m.total,
      }))
    },
    enabled: Boolean(params.from_date && params.to_date),
  })
}

export function useItemizedReport(params: { from_date: string; to_date: string; member_id: string }) {
  return useQuery({
    queryKey: ['reports', 'itemized', params],
    queryFn: async () => {
      const response = await apiClient.get<{
        tickets: {
          ticket: { id: string; store_name: string; purchased_at: string }
          items: { name: string; discounted_price: string }[]
        }[]
      }>('/reports/itemized', { params })
      const rows: ItemizedRow[] = []
      for (const t of response.data.tickets) {
        for (const item of t.items) {
          rows.push({
            ticket_id: t.ticket.id,
            store_name: t.ticket.store_name,
            purchased_at: t.ticket.purchased_at,
            item_name: item.name,
            discounted_price: item.discounted_price,
          })
        }
      }
      return rows
    },
    enabled: Boolean(params.from_date && params.to_date && params.member_id),
  })
}

export function usePaymentsReport(params: { from_date: string; to_date: string }) {
  return useQuery({
    queryKey: ['reports', 'payments', params],
    queryFn: async () => {
      const response = await apiClient.get<{
        payments: PaymentReportRow[]
        total: string
      }>('/reports/payments', { params })
      return { payments: response.data.payments, total: response.data.total }
    },
    enabled: Boolean(params.from_date && params.to_date),
  })
}

export function useCategoryReport(params: { from_date: string; to_date: string }) {
  return useQuery({
    queryKey: ['reports', 'categories', params],
    queryFn: async () => {
      const response = await apiClient.get<{
        categories: { category: { id: string; name: string; color: string }; total: string; percentage: string }[]
        uncategorized: string
      }>('/reports/categories', { params })
      const rows: CategoryRow[] = response.data.categories.map((c) => ({
        category_id: c.category.id,
        category_name: c.category.name,
        total: c.total,
        percentage: c.percentage,
      }))
      if (parseFloat(response.data.uncategorized) > 0) {
        const totalCents = rows.reduce((s, r) => s + Math.round(parseFloat(r.total) * 100), 0)
        const uncatCents = Math.round(parseFloat(response.data.uncategorized) * 100)
        const grandCents = totalCents + uncatCents
        rows.push({
          category_id: null,
          category_name: 'Uncategorized',
          total: response.data.uncategorized,
          percentage: grandCents > 0 ? ((uncatCents / grandCents) * 100).toFixed(1) : '0.0',
        })
      }
      return rows
    },
    enabled: Boolean(params.from_date && params.to_date),
  })
}
