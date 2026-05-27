import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface BalanceRow {
  debtor_id: string
  debtor_name: string
  creditor_id: string
  creditor_name: string
  amount: string
}

export function useBalances(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['balances', params],
    queryFn: async () => {
      const response = await apiClient.get<BalanceRow[]>('/balances', { params })
      return response.data
    },
  })
}
