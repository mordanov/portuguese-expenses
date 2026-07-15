import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../src/i18n'
import ProjectsPage from '../../src/pages/ProjectsPage'
import { ProjectProvider } from '../../src/context/ProjectContext'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <ProjectProvider>
          <MemoryRouter>
            <ProjectsPage />
          </MemoryRouter>
        </ProjectProvider>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('ProjectsPage', () => {
  it('renders project list', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Portugal-2026')).toBeInTheDocument())
  })

  it('shows member list when members panel is expanded', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Portugal-2026')).toBeInTheDocument())
    await userEvent.click(screen.getByText(/Members/i))
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
  })

  it('shows New Project button', async () => {
    renderPage()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })
})
