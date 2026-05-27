import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface OffsetRuleRecord {
  id: string
  type: 'absorb' | 'transfer'
  person_a_id: string
  person_b_id: string
}

interface OffsetRulesListResponse {
  items: OffsetRuleRecord[]
}

export function useOffsetRules() {
  return useQuery({
    queryKey: ['offset-rules'],
    queryFn: async () => {
      const response = await apiClient.get<OffsetRulesListResponse>('/offset-rules')
      return response.data.items
    },
  })
}

export function useCreateOffsetRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { type: 'absorb' | 'transfer'; person_a_id: string; person_b_id: string }) => {
      const response = await apiClient.post<OffsetRuleRecord>('/offset-rules', body)
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['offset-rules'] }) },
  })
}

export function useDeleteOffsetRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/offset-rules/${id}`)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['offset-rules'] }) },
  })
}
