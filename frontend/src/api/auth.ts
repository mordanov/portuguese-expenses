import apiClient from './client'

export interface LoginResponse {
  access_token: string
  token_type: string
  role: string
}

export async function login(username: string, password: string): Promise<void> {
  const response = await apiClient.post<LoginResponse>('/auth/login', { username, password })
  localStorage.setItem('access_token', response.data.access_token)
  localStorage.setItem('user_role', response.data.role)
}

export function logout(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_role')
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem('access_token'))
}

export function getUserRole(): string {
  return localStorage.getItem('user_role') ?? 'user'
}

export function isAdmin(): boolean {
  return getUserRole() === 'admin'
}