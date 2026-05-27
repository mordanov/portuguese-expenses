import apiClient from './client'

export interface LoginResponse {
  access_token: string
  token_type: string
}

export async function login(username: string, password: string): Promise<void> {
  const response = await apiClient.post<LoginResponse>('/auth/login', { username, password })
  localStorage.setItem('access_token', response.data.access_token)
}

export function logout(): void {
  localStorage.removeItem('access_token')
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem('access_token'))
}
