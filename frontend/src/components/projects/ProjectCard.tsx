import { useTranslation } from 'react-i18next'
import { Project } from '../../api/projects'

interface ProjectCardProps {
  project: Project
  isAdmin: boolean
  onEdit: (project: Project) => void
  onClose: (project: Project) => void
  onReopen: (project: Project) => void
}

export default function ProjectCard({ project, isAdmin, onEdit, onClose, onReopen }: ProjectCardProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-xl shadow border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                project.status === 'open'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {project.status === 'open' ? t('projects.open') : `🔒 ${t('projects.closed')}`}
            </span>
            <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
              {project.default_language.toUpperCase()}
            </span>
          </div>

          {/* Colour swatches */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">{t('projects.colorScheme')}:</span>
            <span
              className="w-5 h-5 rounded border border-gray-200 inline-block"
              style={{ backgroundColor: project.bg_color }}
              title={`Background: ${project.bg_color}`}
            />
            <span
              className="w-5 h-5 rounded border border-gray-200 inline-block"
              style={{ backgroundColor: project.text_color }}
              title={`Text: ${project.text_color}`}
            />
            <span
              className="w-5 h-5 rounded border border-gray-200 inline-block"
              style={{ backgroundColor: project.accent_color }}
              title={`Accent: ${project.accent_color}`}
            />
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(project)}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t('common.edit')}
            </button>
            {project.status === 'open' ? (
              <button
                onClick={() => onClose(project)}
                className="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                {t('projects.close')}
              </button>
            ) : (
              <button
                onClick={() => onReopen(project)}
                className="text-sm text-green-700 hover:text-green-900 px-3 py-1 rounded-lg hover:bg-green-50 transition-colors"
              >
                {t('projects.reopen')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
