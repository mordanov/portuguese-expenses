import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { switchProject as apiSwitchProject, getProjects } from '../api/projects'

export interface ActiveProject {
  id: string
  name: string
  bg_color: string
  text_color: string
  accent_color: string
  status: 'open' | 'closed'
}

interface ProjectContextValue {
  activeProject: ActiveProject | null
  setActiveProject: (project: ActiveProject | null) => void
  switchProject: (projectId: string) => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function applyCssVars(project: ActiveProject | null) {
  const root = document.documentElement
  if (project) {
    root.style.setProperty('--project-bg', project.bg_color)
    root.style.setProperty('--project-text', project.text_color)
    root.style.setProperty('--project-accent', project.accent_color)
  } else {
    root.style.removeProperty('--project-bg')
    root.style.removeProperty('--project-text')
    root.style.removeProperty('--project-accent')
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<ActiveProject | null>(() => {
    try {
      const stored = localStorage.getItem('active_project')
      return stored ? (JSON.parse(stored) as ActiveProject) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    applyCssVars(activeProject)
    if (activeProject) {
      localStorage.setItem('active_project', JSON.stringify(activeProject))
    } else {
      localStorage.removeItem('active_project')
    }
  }, [activeProject])

  function setActiveProject(project: ActiveProject | null) {
    setActiveProjectState(project)
  }

  async function switchProject(projectId: string) {
    const data = await apiSwitchProject(projectId)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('user_role', data.role)
    localStorage.setItem('active_project_id', data.project_id)
    // Fetch project details with the new token so CSS vars update before reload
    const projects = await getProjects()
    const project = projects.find((p) => p.id === data.project_id) ?? null
    if (project) {
      setActiveProject({
        id: project.id,
        name: project.name,
        bg_color: project.bg_color,
        text_color: project.text_color,
        accent_color: project.accent_color,
        status: project.status,
      })
    }
    window.location.reload()
  }

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject, switchProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
