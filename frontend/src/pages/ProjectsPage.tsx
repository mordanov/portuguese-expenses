import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getProjects,
  createProject,
  updateProject,
  closeProject,
  reopenProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  Project,
  ProjectCreate,
  ProjectUpdate,
} from '../api/projects'
import { Member } from '../api/members'
import apiClient from '../api/client'
import ProjectCard from '../components/projects/ProjectCard'
import ProjectForm from '../components/projects/ProjectForm'

function useAllMembers() {
  return useQuery({
    queryKey: ['members', { active_only: false }],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Member[]; total: number }>('/members')
      return res.data.items
    },
  })
}

function MembersPanel({ project }: { project: Project }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedMemberId, setSelectedMemberId] = useState('')

  const { data: projectMembers = [], isLoading } = useQuery({
    queryKey: ['project-members', project.id],
    queryFn: () => getProjectMembers(project.id),
  })

  const { data: allMembers = [] } = useAllMembers()

  const addMutation = useMutation({
    mutationFn: () => addProjectMember(project.id, selectedMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', project.id] })
      setSelectedMemberId('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeProjectMember(project.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', project.id] })
    },
  })

  const linkedIds = new Set(projectMembers.map((m) => m.id))
  const addableMembers = allMembers.filter((m) => !linkedIds.has(m.id))

  if (isLoading) {
    return <p className="text-sm text-gray-400 py-2">{t('common.loading')}</p>
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {t('projects.members')}
      </p>

      {projectMembers.length === 0 ? (
        <p className="text-sm text-gray-400 mb-2">{t('projects.members.empty', 'No members linked.')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2 mb-3">
          {projectMembers.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-sm"
            >
              <span>{m.name}</span>
              {project.status === 'open' && (
                <button
                  onClick={() => removeMutation.mutate(m.id)}
                  disabled={removeMutation.isPending}
                  className="text-gray-400 hover:text-red-500 ml-1 text-xs"
                  aria-label={t('projects.members.remove')}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {project.status === 'open' && addableMembers.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pt-green"
          >
            <option value="">— {t('projects.members.add')} —</option>
            {addableMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!selectedMemberId || addMutation.isPending}
            className="text-sm bg-pt-green text-white px-3 py-1 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
          >
            {t('projects.members.add')}
          </button>
          {addMutation.isError && (
            <span className="text-xs text-red-600">{t('common.error')}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) => updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingProject(null)
    },
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenProject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  function toggleMembers(projectId: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('projects.title')}</h1>
        <button
          onClick={() => { setEditingProject(null); setShowForm(true) }}
          className="bg-pt-green text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
        >
          + {t('projects.new')}
        </button>
      </div>

      {/* New project modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projects.new')}</h2>
            <ProjectForm
              onSubmit={(data) => createMutation.mutateAsync(data as ProjectCreate)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Edit project modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projects.edit')}</h2>
            <ProjectForm
              project={editingProject}
              onSubmit={(data) =>
                updateMutation.mutateAsync({ id: editingProject.id, data: data as ProjectUpdate })
              }
              onCancel={() => setEditingProject(null)}
            />
          </div>
        </div>
      )}

      {isLoading && (
        <p className="text-gray-500 text-sm">{t('common.loading')}</p>
      )}

      {!isLoading && projects.length === 0 && (
        <p className="text-gray-400 text-sm">{t('projects.empty', 'No projects yet.')}</p>
      )}

      <div className="space-y-4">
        {projects.map((project) => (
          <div key={project.id}>
            <ProjectCard
              project={project}
              isAdmin={true}
              onEdit={(p) => { setShowForm(false); setEditingProject(p) }}
              onClose={(p) => closeMutation.mutate(p.id)}
              onReopen={(p) => reopenMutation.mutate(p.id)}
            />
            <button
              onClick={() => toggleMembers(project.id)}
              className="text-xs text-gray-500 hover:text-pt-green mt-1 ml-1 transition-colors"
            >
              {expandedMembers.has(project.id) ? '▲' : '▼'} {t('projects.members')}
            </button>
            {expandedMembers.has(project.id) && <MembersPanel project={project} />}
          </div>
        ))}
      </div>
    </div>
  )
}
