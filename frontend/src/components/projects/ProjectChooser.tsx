import { ProjectPublic } from '../../api/projects'

interface ProjectChooserProps {
  projects: ProjectPublic[]
  value: string
  onChange: (projectId: string) => void
  className?: string
}

export default function ProjectChooser({ projects, value, onChange, className = '' }: ProjectChooserProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--project-bg,#006600)] ${className}`}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id} style={{ backgroundColor: p.bg_color }}>
          {p.status === 'closed' ? `🔒 ${p.name}` : p.name}
        </option>
      ))}
    </select>
  )
}
