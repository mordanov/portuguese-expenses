import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Project, ProjectCreate, ProjectUpdate, suggestColors, suggestEmoji } from '../../api/projects'

const LANGUAGES = [
  { code: 'pt', label: 'Portuguese (pt)' },
  { code: 'fr', label: 'French (fr)' },
  { code: 'es', label: 'Spanish (es)' },
  { code: 'de', label: 'German (de)' },
  { code: 'en', label: 'English (en)' },
  { code: 'other', label: 'Other' },
]

const schema = z.object({
  name: z.string().min(1, 'required'),
  description: z.string().max(500).optional().nullable(),
  emoji: z.string().max(10).optional().nullable(),
  default_language: z.string().min(1, 'required'),
  bg_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid hex'),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid hex'),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid hex'),
})

type FormData = z.infer<typeof schema>

function hexToRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToRelativeLuminance(hex1)
  const l2 = hexToRelativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

interface ProjectFormProps {
  project?: Project
  onSubmit: (data: ProjectCreate | ProjectUpdate) => Promise<void>
  onCancel: () => void
}

export default function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const { t } = useTranslation()
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [suggestingEmoji, setSuggestingEmoji] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      emoji: project?.emoji ?? '',
      default_language: project?.default_language ?? 'pt',
      bg_color: project?.bg_color ?? '#006600',
      text_color: project?.text_color ?? '#FFFFFF',
      accent_color: project?.accent_color ?? '#FFD700',
    },
  })

  const bgColor = watch('bg_color')
  const textColor = watch('text_color')

  const contrast = (() => {
    try {
      return contrastRatio(bgColor, textColor)
    } catch {
      return null
    }
  })()

  const contrastWarning = contrast !== null && contrast < 4.5

  async function handleSuggestEmoji() {
    const name = watch('name')
    if (!name) return
    setSuggestingEmoji(true)
    try {
      const result = await suggestEmoji(name)
      setValue('emoji', result.emoji)
    } catch {
      // silent — user can type manually
    } finally {
      setSuggestingEmoji(false)
    }
  }

  async function handleSuggest() {
    const name = watch('name')
    if (!name) return
    setSuggesting(true)
    setSuggestError(null)
    try {
      const colors = await suggestColors(name)
      setValue('bg_color', colors.bg_color)
      setValue('text_color', colors.text_color)
      setValue('accent_color', colors.accent_color)
    } catch {
      setSuggestError(t('common.error'))
    } finally {
      setSuggesting(false)
    }
  }

  async function onFormSubmit(data: FormData) {
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} noValidate className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('projects.title')} *
        </label>
        <input
          {...register('name')}
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green text-sm"
          placeholder="France-2026"
        />
        {errors.name && <p className="text-red-600 text-xs mt-1">{t('auth.required')}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('projects.description', 'Description')}
        </label>
        <input
          {...register('description')}
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green text-sm"
          placeholder={t('projects.descriptionPlaceholder', 'Portuguese drunk sailors')}
        />
      </div>

      {/* Emoji */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            {t('projects.emoji', 'Emoji')}
          </label>
          <button
            type="button"
            onClick={handleSuggestEmoji}
            disabled={suggestingEmoji}
            className="text-xs text-pt-green hover:underline disabled:opacity-50"
          >
            {suggestingEmoji ? t('common.loading') : t('projects.suggestEmoji', 'Suggest flag')}
          </button>
        </div>
        <input
          {...register('emoji')}
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green text-sm"
          placeholder="🇵🇹"
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('projects.language')}
        </label>
        <select
          {...register('default_language')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green text-sm"
        >
          {LANGUAGES.map(({ code, label }) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>

      {/* Colours */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{t('projects.colorScheme')}</span>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting}
            className="text-xs text-pt-green hover:underline disabled:opacity-50"
          >
            {suggesting ? t('common.loading') : t('projects.suggestColors')}
          </button>
        </div>
        {suggestError && <p className="text-red-600 text-xs mb-2">{suggestError}</p>}
        <div className="grid grid-cols-3 gap-3">
          {(['bg_color', 'text_color', 'accent_color'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs text-gray-500 mb-1">
                {field === 'bg_color' ? 'Background' : field === 'text_color' ? 'Text' : 'Accent'}
              </label>
              <input
                {...register(field)}
                type="color"
                className="w-full h-10 rounded border border-gray-300 cursor-pointer"
              />
              {errors[field] && <p className="text-red-600 text-xs mt-1">Invalid</p>}
            </div>
          ))}
        </div>
        {contrastWarning && (
          <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
            ⚠️ Low contrast ratio ({contrast?.toFixed(1)}:1). WCAG AA requires 4.5:1 for normal text.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-pt-green text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
        >
          {isSubmitting ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </form>
  )
}
