import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import i18n from '../../../src/i18n'
import UploadStep from '../../../src/components/tickets/UploadStep'
import type { OCRDraft } from '../../../src/api/tickets'

const BASE_URL = 'http://localhost:8000'

const mockDraft: OCRDraft = {
  store_name: 'Lidl',
  purchased_at: '2026-05-27T00:00:00Z',
  items: [{ name: 'Wine', price: '5.99', category_id: null }],
  discount_total: '0.00',
  total_price: '5.99',
}

// jsdom has no Canvas/Image — stub resizeImage to pass files through unchanged
vi.mock('../../../src/components/tickets/UploadStep', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../src/components/tickets/UploadStep')>()
  return mod
})

// Stub URL.createObjectURL / revokeObjectURL used by resizeImage
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
globalThis.URL.revokeObjectURL = vi.fn()

// Make Image immediately trigger onload without actually loading, so resizeImage
// resolves with the original file (naturalWidth=0 <= MAX_LONG_SIDE → no resize)
class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_: string) { Promise.resolve().then(() => this.onload?.()) }
  width = 0
  height = 0
}
// @ts-expect-error stub
globalThis.Image = MockImage

function renderUpload(onSuccess = vi.fn(), onManual = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <UploadStep onSuccess={onSuccess} onManual={onManual} />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

function uploadFile(input: HTMLElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], writable: true })
  fireEvent.change(input)
}

describe('UploadStep', () => {
  it('renders drag-and-drop zone', () => {
    renderUpload()
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument()
  })

  it('shows error for invalid file type', async () => {
    renderUpload()
    const input = screen.getByLabelText('Upload receipt')
    const file = new File(['content'], 'virus.exe', { type: 'application/x-msdownload' })
    uploadFile(input, file)
    await waitFor(() =>
      expect(screen.getByText(/only jpeg, png, webp, or pdf/i)).toBeInTheDocument(),
    )
  })

  it('shows error for oversized file', async () => {
    renderUpload()
    const input = screen.getByLabelText('Upload receipt')
    const bigContent = new Uint8Array(21 * 1024 * 1024)
    const file = new File([bigContent], 'big.jpg', { type: 'image/jpeg' })
    uploadFile(input, file)
    await waitFor(() =>
      expect(screen.getByText(/file exceeds/i)).toBeInTheDocument(),
    )
  })

  it('calls onSuccess with OCRDraft on valid upload', async () => {
    server.use(
      http.post(`${BASE_URL}/tickets/upload`, () => HttpResponse.json(mockDraft)),
    )
    const onSuccess = vi.fn()
    renderUpload(onSuccess)
    const input = screen.getByLabelText('Upload receipt')
    const file = new File(['jpeg-content'], 'receipt.jpg', { type: 'image/jpeg' })
    uploadFile(input, file)
    const uploadBtn = await screen.findByRole('button', { name: /upload/i })
    await act(async () => { fireEvent.click(uploadBtn) })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(mockDraft), { timeout: 5000 })
  })

  it('shows upload error when API fails', async () => {
    server.use(
      http.post(`${BASE_URL}/tickets/upload`, () => HttpResponse.json({ detail: 'fail' }, { status: 500 })),
    )
    renderUpload()
    const input = screen.getByLabelText('Upload receipt')
    const file = new File(['content'], 'receipt.jpg', { type: 'image/jpeg' })
    uploadFile(input, file)
    const uploadBtn = await screen.findByRole('button', { name: /upload/i })
    await act(async () => { fireEvent.click(uploadBtn) })
    await waitFor(() => expect(screen.getByText(/upload failed/i)).toBeInTheDocument(), { timeout: 5000 })
  })
})
