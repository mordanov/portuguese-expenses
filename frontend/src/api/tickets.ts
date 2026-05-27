import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface OCRItem {
  name: string
  price: string
  category_id: string | null
}

export interface OCRDraft {
  store_name: string
  purchased_at: string
  items: OCRItem[]
  discount_total: string
  total_price: string
}

export interface TicketItem {
  id: string
  name: string
  price: string
  discounted_price: string
  category_id: string | null
  member_ids: string[]
}

export interface Ticket {
  id: string
  store_name: string
  purchased_at: string
  paid_by: { id: string; name: string }
  discount_total: string
  total_price: string
  items: TicketItem[]
  created_at: string
}

export interface TicketsResponse {
  items: Ticket[]
  total: number
  page: number
  page_size: number
}

export interface TicketCreateRequest {
  store_name: string
  purchased_at: string
  paid_by_id: string
  discount_total: string
  items: Array<{
    name: string
    price: string
    category_id: string | null
    member_ids: string[]
  }>
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async (file: File): Promise<OCRDraft> => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiClient.post<OCRDraft>('/tickets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },
  })
}

export function useTickets(params?: { page?: number; page_size?: number; member_id?: string; category_id?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => {
      const response = await apiClient.get<TicketsResponse>('/tickets', { params })
      return response.data
    },
  })
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: async () => {
      const response = await apiClient.get<Ticket>(`/tickets/${id}`)
      return response.data
    },
    enabled: Boolean(id),
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: TicketCreateRequest) => {
      const response = await apiClient.post<Ticket>('/tickets', data)
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }) },
  })
}

export function useUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TicketCreateRequest> }) => {
      const response = await apiClient.put<Ticket>(`/tickets/${id}`, data)
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }) },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tickets/${id}`)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets'] }) },
  })
}
