import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Category {
  id: string
  name: string
  color: string
  created_at: string
}

export interface CategoriesResponse {
  items: Category[]
  total: number
  page: number
  page_size: number
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<CategoriesResponse>('/categories')
      return response.data
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const response = await apiClient.post<Category>('/categories', { name, color })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }) },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const response = await apiClient.put<Category>(`/categories/${id}`, { name, color })
      return response.data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }) },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categories/${id}`)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }) },
  })
}
