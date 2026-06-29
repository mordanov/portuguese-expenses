import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uploadReceiptFile, type OCRDraft } from '../../api/tickets'

const MAX_SIZE_MB = 20
const MAX_LONG_SIDE = 1500
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

async function resizeImage(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { width, height } = img
      const longSide = Math.max(width, height)
      if (longSide <= MAX_LONG_SIDE) { resolve(file); return }
      const scale = MAX_LONG_SIDE / longSide
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.88,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

function mergeDrafts(drafts: OCRDraft[]): OCRDraft {
  if (drafts.length === 1) return drafts[0]
  const seen = new Set<string>()
  const items: OCRDraft['items'] = []
  for (const draft of drafts) {
    for (const item of draft.items) {
      const key = `${item.name.toLowerCase().trim()}|${item.price}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }
  }
  const totalPrice = items.reduce((sum, it) => sum + parseFloat(it.price), 0).toFixed(2)
  const discountTotal = drafts.reduce((sum, d) => sum + parseFloat(d.discount_total), 0).toFixed(2)
  return {
    store_name: drafts[0].store_name,
    purchased_at: drafts[0].purchased_at,
    discount_total: discountTotal,
    total_price: totalPrice,
    raw_image_url: drafts[0].raw_image_url,
    items,
  }
}

type FileStatus = 'pending' | 'resizing' | 'uploading' | 'done' | 'error'

interface FileEntry {
  file: File
  status: FileStatus
}

export default function UploadStep({ onSuccess, onManual }: UploadStepProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const isProcessing = entries.some(e => e.status === 'resizing' || e.status === 'uploading')

  function setStatus(index: number, status: FileStatus) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, status } : e))
  }

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
    setEntries(prev => {
      const names = new Set(prev.map(e => e.file.name))
      const fresh = valid.filter(f => !names.has(f.name)).map(f => ({ file: f, status: 'pending' as FileStatus }))
      return [...prev, ...fresh]
    })
  }

  function removeFile(index: number) {
    setEntries(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (!entries.length || isProcessing) return
    setClientError(null)

    const drafts: OCRDraft[] = []

    for (let i = 0; i < entries.length; i++) {
      let file = entries[i].file
      try {
        setStatus(i, 'resizing')
        file = await resizeImage(file)
        setStatus(i, 'uploading')
        const draft = await uploadReceiptFile(file)
        drafts.push(draft)
        setStatus(i, 'done')
      } catch (err: unknown) {
        setStatus(i, 'error')
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? ''
        if (detail.toLowerCase().includes('does not appear to be a receipt')) {
          setClientError(`${entries[i].file.name}: ${t('upload.notAReceipt')}`)
        } else {
          setClientError(`${entries[i].file.name}: ${t('upload.error')}`)
        }
        return
      }
    }

    onSuccess(mergeDrafts(drafts))
  }

  const statusIcon: Record<FileStatus, string> = {
    pending: '📎',
    resizing: '🔄',
    uploading: '⬆️',
    done: '✅',
    error: '❌',
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`
          w-full max-w-lg border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-pt-green bg-green-50' : 'border-gray-300 hover:border-pt-green hover:bg-gray-50'}
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <div className="text-5xl mb-4">📄</div>
        <p className="text-gray-700 font-medium">{t('upload.dragDrop')}</p>
        <p className="text-gray-400 text-sm mt-1">{t('upload.fileTypes')}</p>
        <p className="text-gray-400 text-xs mt-1">{t('upload.maxSize')}</p>
        <p className="text-gray-400 text-xs mt-1">{t('upload.multipleHint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          multiple
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          className="hidden"
          aria-label="Upload receipt"
        />
      </div>

      {entries.length > 0 && (
        <div className="w-full max-w-lg flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{statusIcon[entry.status]}</span>
                <span className="truncate text-gray-700">{entry.file.name}</span>
                <span className="text-gray-400 shrink-0">{formatBytes(entry.file.size)}</span>
                {(entry.status === 'resizing' || entry.status === 'uploading') && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {entry.status === 'resizing' ? t('upload.resizing') : t('upload.uploading')}
                  </span>
                )}
              </div>
              {!isProcessing && entry.status !== 'uploading' && entry.status !== 'resizing' && (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  aria-label={t('upload.removeFile')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {!isProcessing && (
            <button
              type="button"
              onClick={handleUpload}
              className="mt-1 w-full py-2.5 bg-pt-green text-white rounded-lg font-medium hover:bg-green-800 transition-colors"
            >
              {entries.length === 1
                ? t('upload.uploadOne')
                : t('upload.uploadMany', { count: entries.length })}
            </button>
          )}
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
