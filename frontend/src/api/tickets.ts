import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface OCRItem {
  name: string
  price: string
  category_id: string | null
  translation_en?: string | null
  translation_ru?: string | null
  translation_pt?: string | null
  suggested_category_id?: string | null
}

export interface OCRDraft {
  store_name: string
  purchased_at: string
  items: OCRItem[]
  discount_total: string
  total_price: string
  raw_image_url?: string | null
}

export interface TicketItem {
  id: string
  name: string
  price: string
  discounted_price: string
  position: number
  translation_en: string | null
  translation_ru: string | null
  translation_pt: string | null
  category: { id: string; name: string; color: string } | null
  allocated_members: { id: string; name: string; cost: string }[]
}

export interface Ticket {
  id: string
  store_name: string
  purchased_at: string
  paid_by: { id: string; name: string }
  discount_total: string
  total_price: string
  raw_image_url: string | null
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
  total_price: string
  discount_total: string
  raw_image_url?: string | null
  items: Array<{
    name: string
    price: string
    category_id: string | null
    member_ids: string[]
    translation_en?: string | null
    translation_ru?: string | null
    translation_pt?: string | null
  }>
}

export interface ItemTranslation {
  en: string
  ru: string
  pt: string
}

export function useTranslateNames(names: string[]) {
  return useQuery({
    queryKey: ['translate-names', names],
    queryFn: async () => {
      if (names.length === 0) return [] as ItemTranslation[]
      const response = await apiClient.post<ItemTranslation[]>('/tickets/translate-names', { names })
      return response.data
    },
    enabled: names.length > 0,
    staleTime: Infinity,
  })
}

export async function uploadReceiptFile(file: File): Promise<OCRDraft> {
  const formData = new FormData()
  formData.append('files', file)
  const response = await apiClient.post<OCRDraft>('/tickets/upload', formData, {
    headers: { 'Content-Type': undefined },
  })
  return response.data
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: (file: File) => uploadReceiptFile(file),
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

export function useAddItem(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (item: { name: string; price: string; categoryId: string | null; memberIds: string[] }) => {
      const response = await apiClient.post<TicketItem>(`/tickets/${ticketId}/items`, {
        name: item.name,
        price: item.price,
        category_id: item.categoryId,
        member_ids: item.memberIds,
      })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] }) },
  })
}

export function useUpdateItem(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, name, price, categoryId }: { itemId: string; name?: string; price?: string; categoryId?: string | null }) => {
      const response = await apiClient.put<TicketItem>(`/items/${itemId}`, {
        name,
        price,
        category_id: categoryId,
      })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] }) },
  })
}

export function useReplaceAllocations(ticketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, memberIds }: { itemId: string; memberIds: string[] }) => {
      const response = await apiClient.put(`/items/${itemId}/allocations`, { member_ids: memberIds })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tickets', ticketId] }) },
  })
}
