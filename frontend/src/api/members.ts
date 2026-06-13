import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Member {
  id: string
  name: string
  is_active: boolean
  can_pay: boolean
  is_kid: boolean
  created_at: string
}

export interface MembersResponse {
  items: Member[]
  total: number
  page: number
  page_size: number
}

export function useMembers(params?: { active_only?: boolean; can_pay_only?: boolean }) {
  return useQuery({
    queryKey: ['members', params],
    queryFn: async () => {
      const response = await apiClient.get<MembersResponse>('/members', { params })
      return response.data
    },
  })
}

export function useCreateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await apiClient.post<Member>('/members', { name })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }) },
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, is_active, can_pay, is_kid }: { id: string; name?: string; is_active?: boolean; can_pay?: boolean; is_kid?: boolean }) => {
      const response = await apiClient.put<Member>(`/members/${id}`, { name, is_active, can_pay, is_kid })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }) },
  })
}

export function useDeactivateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/members/${id}`)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['members'] }) },
  })
}
