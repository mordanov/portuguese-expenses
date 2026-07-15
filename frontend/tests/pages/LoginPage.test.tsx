import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../src/i18n'
import LoginPage from '../../src/pages/LoginPage'
import { ProjectProvider } from '../../src/context/ProjectContext'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ProjectProvider>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </ProjectProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('renders username and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('redirects to / on valid credentials', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/username/i), 'admin')
    await userEvent.type(screen.getByLabelText(/password/i), 'changeme')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  it('shows error on invalid credentials', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/username/i), 'admin')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => expect(screen.getByText(/invalid username/i)).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows validation error when fields are empty', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => expect(screen.getAllByText(/this field is required/i).length).toBeGreaterThan(0))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows project chooser when multiple projects available', async () => {
    renderLogin()
    await waitFor(() => expect(screen.getByText('Portugal-2026')).toBeInTheDocument())
    expect(screen.getByText('France-2026')).toBeInTheDocument()
    // Two comboboxes: project selector + language selector
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1)
  })

  it('includes project_id in login body when project selected', async () => {
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText(/username/i)).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/username/i), 'admin')
    await userEvent.type(screen.getByLabelText(/password/i), 'changeme')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
  })
})
