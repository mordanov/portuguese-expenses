import apiClient from './client'

export interface LoginResponse {
  access_token: string
  token_type: string
  role: string
  project_id: string | null
}

export async function login(username: string, password: string, projectId?: string): Promise<LoginResponse> {
  const body: Record<string, string> = { username, password }
  if (projectId) body.project_id = projectId
  const response = await apiClient.post<LoginResponse>('/auth/login', body)
  localStorage.setItem('access_token', response.data.access_token)
  localStorage.setItem('user_role', response.data.role)
  if (response.data.project_id) {
    localStorage.setItem('active_project_id', response.data.project_id)
  }
  return response.data
}

export function logout(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_role')
  localStorage.removeItem('active_project_id')
  localStorage.removeItem('active_project')
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