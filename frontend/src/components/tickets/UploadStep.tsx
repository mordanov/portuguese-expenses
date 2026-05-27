import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUploadReceipt, type OCRDraft } from '../../api/tickets'

const MAX_SIZE_MB = 10
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

interface UploadStepProps {
  onSuccess: (draft: OCRDraft) => void
  onManual: () => void
}

export default function UploadStep({ onSuccess, onManual }: UploadStepProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { mutateAsync: uploadReceipt, isPending } = useUploadReceipt()

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return t('upload.invalidType')
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return t('upload.fileTooLarge')
    return null
  }

  async function handleFile(file: File) {
    const error = validateFile(file)
    if (error) { setClientError(error); return }
    setClientError(null)
    try {
      const draft = await uploadReceipt(file)
      onSuccess(draft)
    } catch {
      setClientError(t('upload.error'))
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
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
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={onInputChange}
          className="hidden"
          aria-label="Upload receipt"
        />
      </div>

      {clientError && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3 w-full max-w-lg">
          {clientError}
        </div>
      )}

      <div className="flex items-center gap-3 w-full max-w-lg">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={onManual}
        className="text-sm text-pt-green hover:text-green-800 font-medium underline underline-offset-2"
      >
        Enter ticket manually
      </button>
    </div>
  )
}
