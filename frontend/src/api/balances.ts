import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface BalanceRow {
  debtor_id: string
  debtor_name: string
  creditor_id: string
  creditor_name: string
  amount: string
}

interface BalanceEntry {
  debtor: { id: string; name: string }
  creditor: { id: string; name: string }
  amount: string
}

interface BalanceResponse {
  balances: BalanceEntry[]
  as_of: string
}

export function useBalances(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['balances', params],
    queryFn: async () => {
      const response = await apiClient.get<BalanceResponse>('/balances', { params })
      return response.data.balances.map((e): BalanceRow => ({
        debtor_id: e.debtor.id,
        debtor_name: e.debtor.name,
        creditor_id: e.creditor.id,
        creditor_name: e.creditor.name,
        amount: e.amount,
      }))
    },
  })
}
