import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUploadReceipt, type OCRDraft } from '../../api/tickets'

const MAX_SIZE_MB = 10
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

interface UploadStepProps {
  onSuccess: (draft: OCRDraft) => void
  onManual: () => void
}

function validateFile(file: File, t: (k: string) => string): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return t('upload.invalidType')
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return t('upload.fileTooLarge')
  return null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadStep({ onSuccess, onManual }: UploadStepProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const { mutateAsync: uploadReceipt, isPending } = useUploadReceipt()

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const errors: string[] = []
    const valid: File[] = []
    for (const f of Array.from(incoming)) {
      const err = validateFile(f, t)
      if (err) errors.push(`${f.name}: ${err}`)
      else valid.push(f)
    }
    if (errors.length) { setClientError(errors.join('\n')); return }
    setClientError(null)
    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...valid.filter(f => !names.has(f.name))]
    })
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function handleUpload() {
    if (!selectedFiles.length) return
    setClientError(null)
    try {
      const draft = await uploadReceipt(selectedFiles)
      onSuccess(draft)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? ''
      if (detail.toLowerCase().includes('does not appear to be a receipt')) {
        setClientError(t('upload.notAReceipt'))
      } else {
        setClientError(t('upload.error'))
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !isPending && fileInputRef.current?.click()}
        className={`
          w-full max-w-lg border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-pt-green bg-green-50' : 'border-gray-300 hover:border-pt-green hover:bg-gray-50'}
          ${isPending ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <div className="text-5xl mb-4">📄</div>
        {isPending ? (
          <div>
            <div className="text-gray-600 font-medium mb-2">{t('upload.uploading')}</div>
            <div className="h-1 w-32 mx-auto bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-pt-green rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-700 font-medium">{t('upload.dragDrop')}</p>
            <p className="text-gray-400 text-sm mt-1">{t('upload.fileTypes')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('upload.maxSize')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('upload.multipleHint')}</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          multiple
          onChange={onInputChange}
          className="hidden"
          aria-label="Upload receipt"
        />
      </div>

      {selectedFiles.length > 0 && !isPending && (
        <div className="w-full max-w-lg flex flex-col gap-2">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">📎</span>
                <span className="truncate text-gray-700">{f.name}</span>
                <span className="text-gray-400 shrink-0">{formatBytes(f.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                aria-label={t('upload.removeFile')}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleUpload}
            className="mt-1 w-full py-2.5 bg-pt-green text-white rounded-lg font-medium hover:bg-green-800 transition-colors"
          >
            {selectedFiles.length === 1
              ? t('upload.uploadOne')
              : t('upload.uploadMany', { count: selectedFiles.length })}
          </button>
        </div>
      )}

      {clientError && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 w-full max-w-lg whitespace-pre-line">
          {clientError}
        </div>
      )}

      <div className="flex items-center gap-3 w-full max-w-lg">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400">{t('upload.or')}</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={onManual}
        className="text-sm text-pt-green hover:text-green-800 font-medium underline underline-offset-2"
      >
        {t('upload.enterManually')}
      </button>
    </div>
  )
}
