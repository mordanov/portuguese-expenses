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

export function useSummaryReport(params: { date_from: string; date_to: string }) {
  return useQuery({
    queryKey: ['reports', 'summary', params],
    queryFn: async () => {
      const response = await apiClient.get<SummaryRow[]>('/reports/summary', { params })
      return response.data
    },
    enabled: Boolean(params.date_from && params.date_to),
  })
}

export function useItemizedReport(params: { date_from: string; date_to: string; member_id: string }) {
  return useQuery({
    queryKey: ['reports', 'itemized', params],
    queryFn: async () => {
      const response = await apiClient.get<ItemizedRow[]>('/reports/itemized', { params })
      return response.data
    },
    enabled: Boolean(params.date_from && params.date_to && params.member_id),
  })
}

export function useCategoryReport(params: { date_from: string; date_to: string }) {
  return useQuery({
    queryKey: ['reports', 'categories', params],
    queryFn: async () => {
      const response = await apiClient.get<CategoryRow[]>('/reports/categories', { params })
      return response.data
    },
    enabled: Boolean(params.date_from && params.date_to),
  })
}
