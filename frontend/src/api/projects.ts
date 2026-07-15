import apiClient from './client'

export interface ProjectPublic {
  id: string
  name: string
  bg_color: string
  text_color: string
  accent_color: string
  status: 'open' | 'closed'
}

export interface Project {
  id: string
  name: string
  default_language: string
  bg_color: string
  text_color: string
  accent_color: string
  status: 'open' | 'closed'
  created_at: string
}

export interface ProjectCreate {
  name: string
  default_language: string
  bg_color: string
  text_color: string
  accent_color: string
}

export interface ProjectUpdate {
  name?: string
  default_language?: string
  bg_color?: string
  text_color?: string
  accent_color?: string
}

export interface ColorSuggestResponse {
  bg_color: string
  text_color: string
  accent_color: string
}

export interface ProjectMember {
  id: string
  name: string
  is_active: boolean
  joined_at: string
}

export async function getPublicProjects(): Promise<ProjectPublic[]> {
  const res = await apiClient.get<{ items: ProjectPublic[] }>('/projects/public-list')
  return res.data.items
}

export async function getProjects(): Promise<Project[]> {
  const res = await apiClient.get<{ items: Project[]; total: number }>('/projects')
  return res.data.items
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  const res = await apiClient.post<Project>('/projects', data)
  return res.data
}

export async function updateProject(id: string, data: ProjectUpdate): Promise<Project> {
  const res = await apiClient.put<Project>(`/projects/${id}`, data)
  return res.data
}

export async function closeProject(id: string): Promise<{ id: string; status: string }> {
  const res = await apiClient.post<{ id: string; status: string }>(`/projects/${id}/close`)
  return res.data
}

export async function reopenProject(id: string): Promise<{ id: string; status: string }> {
  const res = await apiClient.post<{ id: string; status: string }>(`/projects/${id}/reopen`)
  return res.data
}

export async function suggestColors(query: string): Promise<ColorSuggestResponse> {
  const res = await apiClient.post<ColorSuggestResponse>('/projects/suggest-colors', { query })
  return res.data
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await apiClient.get<{ items: ProjectMember[]; total: number }>(`/projects/${projectId}/members`)
  return res.data.items
}

export async function addProjectMember(
  projectId: string,
  memberId: string,
): Promise<{ member_id: string; project_id: string; joined_at: string }> {
  const res = await apiClient.post(`/projects/${projectId}/members`, { member_id: memberId })
  return res.data
}

export async function removeProjectMember(projectId: string, memberId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/members/${memberId}`)
}

export async function switchProject(projectId: string): Promise<{
  access_token: string
  token_type: string
  role: string
  project_id: string
}> {
  const res = await apiClient.post('/auth/switch-project', { project_id: projectId })
  return res.data
}
