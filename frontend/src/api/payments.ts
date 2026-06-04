import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

interface PaymentCreateRequest {
  payer_id: string
  payee_id: string
  amount: string
  note?: string
}

interface PaymentResponse {
  id: string
  payer_id: string
  payee_id: string
  amount: string
  paid_at: string
  note: string | null
}

export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: PaymentCreateRequest) => {
      const response = await apiClient.post<PaymentResponse>('/payments', body)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['balances'] })
    },
  })
}
