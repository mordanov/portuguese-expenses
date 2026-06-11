import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface AppUser {
  id: string
  username: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
}

export interface UserListResponse {
  items: AppUser[]
  total: number
}

export interface UserCreateRequest {
  username: string
  password: string
  role: 'admin' | 'user'
}

export interface UserUpdateRequest {
  username?: string
  password?: string
  role?: 'admin' | 'user'
  is_active?: boolean
}

export function useUsers() {
  return useQuery<UserListResponse>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<UserListResponse>('/users')
      return data
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UserCreateRequest) => apiClient.post<AppUser>('/users', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UserUpdateRequest & { id: string }) =>
      apiClient.patch<AppUser>(`/users/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}